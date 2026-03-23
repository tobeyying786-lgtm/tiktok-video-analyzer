/**
 * tab3-analysis.js — 结构分析 + 板块级仿写 (V3.2)
 *
 * 左侧：脚本结构分析（停病药信买归类 + 框架匹配）
 * 右侧：板块级仿写（每个板块可编辑 textarea）→ 生成分镜脚本 → 传给 Tab 4
 */

// ============== 左侧：结构分析渲染 ==============

function renderTab3(a, ss, shots) {
  const bd = ss.structure_breakdown || [];

  // 给每个镜头标注角色（供 expand 使用）
  bd.forEach(b => {
    (b.shots_included || []).forEach(sn => {
      const shot = shots.find(x => x.shot_number === sn);
      if (shot) shot._role = b.element;
    });
  });
  // 存到 state 供后续使用
  AppState._analysisShots = shots;
  AppState._structureBreakdown = bd;

  let blocks = '';
  bd.forEach(b => {
    const cls = elemCls(b.element);
    const sn = b.shots_included || [];
    const sd = sn.map(n => {
      const s = shots.find(x => x.shot_number === n);
      return s ? s.scene_description : '';
    }).filter(Boolean);

    blocks += '<div class="str-block">' +
      '<span class="sb-tag bg-' + cls + '">' + esc(b.element) + '</span>' +
      '<span class="sb-time">' + esc(b.time_range || '') + '</span>' +
      '<span class="sb-count">x' + sn.length + ' 个镜头</span>' +
      '<div class="sb-desc" style="margin-top:10px">' + sd.map(d => esc(d)).join('；') + '</div>' +
      '<div class="sb-note">' + esc(b.description || '') + '</div>' +
    '</div>';
  });

  const filename = AppState.curFile ? AppState.curFile.name.replace(/\.[^.]+$/, '') : '';
  const framework = ss.framework || '未识别';
  const formula = ss.formula || '';

  document.getElementById('t3').innerHTML =
    '<div class="str-layout">' +
      '<div class="str-left">' +
        '<div style="font-size:16px;font-weight:700;margin-bottom:6px">📊 脚本结构分析</div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">' +
          '<span style="background:var(--accentBg);border:1px solid var(--accent);border-radius:8px;padding:4px 14px;font-size:13px;font-weight:700;color:var(--accent2)">' + esc(framework) + '</span>' +
          '<span style="font-size:13px;color:var(--text3);font-family:JetBrains Mono,monospace">' + esc(formula) + '</span>' +
          '<span style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px 12px;font-size:12px;color:var(--text3)">' + filename + '</span>' +
        '</div>' +
        blocks +
      '</div>' +
      '<div class="str-right" style="position:sticky;top:80px;align-self:start">' +
        '<div class="rw-panel">' +
          '<h3>✏️ 跨品类仿写</h3>' +
          '<div class="rw-field"><label>新品类</label><input id="rw-cat" placeholder="婴儿服饰"></div>' +
          '<div class="rw-field"><label>产品名称</label><input id="rw-name" placeholder="有机棉连体衣"></div>' +
          '<div class="rw-field"><label>核心卖点（可选）</label><input id="rw-sell" placeholder="A类面料、无荧光剂、双向拉链"></div>' +
          '<button class="btn-rw" id="btn-rw" onclick="doRewrite()">生成板块仿写</button>' +
          '<div id="rw-result"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// ============== 右侧：板块级仿写 ==============

async function doRewrite() {
  const cat = document.getElementById('rw-cat').value.trim();
  const name = document.getElementById('rw-name').value.trim();
  const sell = document.getElementById('rw-sell').value.trim();
  if (!cat || !name) return showErr('请填写新品类和产品名称');
  hideErr();

  // 存产品信息供 expand 使用
  AppState._rwCategory = cat;
  AppState._rwProductName = name;

  const btn = document.getElementById('btn-rw');
  btn.disabled = true;
  btn.textContent = '仿写中…';
  const re = document.getElementById('rw-result');
  re.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center"><div class="spin" style="margin:0 auto 10px"></div>Claude 正在生成板块仿写…</div>';

  try {
    const analysis = AppState.analysisData?.analysis || AppState.analysisData;
    const rw = await API.rewrite(analysis, cat, name, sell);
    renderRewriteBlocks(rw);
  } catch (e) {
    re.innerHTML = '<div style="color:var(--red);padding:12px">❌ ' + esc(e.message) + '</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = '生成板块仿写';
  }
}

function renderRewriteBlocks(rw) {
  // 存到全局状态
  AppState.lastRewrite = rw;
  AppState.t4Initialized = false;

  const re = document.getElementById('rw-result');

  if (rw.raw_response) {
    re.innerHTML = '<div style="background:var(--bg3);border-radius:var(--r);padding:16px;margin-top:16px;font-size:13px;color:var(--text2);white-space:pre-wrap;line-height:1.8">' + esc(rw.raw_response) + '</div>';
    return;
  }

  const blocks = rw.blocks || [];
  if (blocks.length === 0) {
    re.innerHTML = '<div style="color:var(--text3);padding:12px">未生成仿写内容</div>';
    return;
  }

  let h = '<div style="margin-top:16px">';
  blocks.forEach((b, i) => {
    const cls = elemCls(b.element);
    h += '<div class="rw-block-card">' +
      '<div class="rw-block-hdr">' +
        '<span class="sb-tag bg-' + cls + '">' + esc(b.element) + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">原视频镜头 ' + (b.original_shots || []).join(', ') + '</span>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text3);margin-bottom:6px">' + esc(b.original_description || '') + '</div>' +
      '<textarea class="rw-block-textarea" id="rw-block-' + i + '" rows="3" oninput="t3UpdateBlock(' + i + ',this.value)">' + esc(b.rewrite_direction || '') + '</textarea>' +
    '</div>';
  });
  h += '</div>';

  // 生成分镜脚本按钮
  h += '<button class="btn-rw" id="btn-expand" onclick="doExpand()" style="margin-top:16px;background:var(--accent);color:#fff;border-color:var(--accent)">📋 生成分镜脚本 → Tab 4</button>';
  h += '<div id="expand-status"></div>';

  re.innerHTML = h;
}

function t3UpdateBlock(idx, value) {
  if (AppState.lastRewrite && AppState.lastRewrite.blocks && AppState.lastRewrite.blocks[idx]) {
    AppState.lastRewrite.blocks[idx].rewrite_direction = value;
  }
}

// ============== 板块→镜头级脚本扩展 ==============

async function doExpand() {
  const rw = AppState.lastRewrite;
  if (!rw || !rw.blocks) return showErr('请先完成板块仿写');

  const btn = document.getElementById('btn-expand');
  const status = document.getElementById('expand-status');
  btn.disabled = true;
  btn.textContent = '生成中…';
  status.innerHTML = '<div style="color:var(--text3);padding:12px;text-align:center"><div class="spin" style="margin:0 auto 8px"></div>Claude 正在扩展为分镜脚本…</div>';

  try {
    // 给原始镜头标注角色
    const shots = AppState._analysisShots || [];
    const bd = AppState._structureBreakdown || [];
    bd.forEach(b => {
      (b.shots_included || []).forEach(sn => {
        const shot = shots.find(x => x.shot_number === sn);
        if (shot) shot._role = b.element;
      });
    });

    const result = await API.expand(
      shots,
      bd,
      rw.blocks,
      AppState._rwProductName || '',
      AppState._rwCategory || ''
    );

    if (result.raw_response) {
      status.innerHTML = '<div style="color:var(--red);padding:12px">AI 返回格式异常，请重试</div>';
      btn.disabled = false;
      btn.textContent = '📋 生成分镜脚本 → Tab 4';
      return;
    }

    // 把 expand 结果传给 Tab 4
    const expandData = {
      rewritten_structure: (result.shots || []).map(s => ({
        ...s,
        element: s.role || '无',
        camera: s.camera || { shot_size: '', lighting: [], movement: '', composition: '', style: '' }
      })),
      framework: rw.framework || '',
      formula: rw.formula || ''
    };

    AppState.lastRewrite = expandData;
    AppState.t4Initialized = false;

    status.innerHTML = '<div style="color:var(--green);padding:12px;text-align:center">✅ 已生成 ' + (result.shots || []).length + ' 个镜头的分镜脚本，切换到 Tab 4 查看编辑</div>';
    btn.textContent = '✅ 已生成';

    // 高亮 Tab 4
    const t4Tab = document.querySelector('[data-tab="t4"]');
    if (t4Tab) {
      t4Tab.style.background = 'var(--accentBg)';
      setTimeout(() => t4Tab.style.background = '', 3000);
    }
  } catch (e) {
    status.innerHTML = '<div style="color:var(--red);padding:12px">❌ ' + esc(e.message) + '</div>';
    btn.disabled = false;
    btn.textContent = '📋 生成分镜脚本 → Tab 4';
  }
}

// ============== 导出 ==============

window.renderTab3 = renderTab3;
window.doRewrite = doRewrite;
window.renderRewriteBlocks = renderRewriteBlocks;
window.t3UpdateBlock = t3UpdateBlock;
window.doExpand = doExpand;
