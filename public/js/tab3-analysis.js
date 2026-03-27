/**
 * tab3-analysis.js — V3.6.3
 * 改动：JSON解析加第五策略（正则提取blocks数组兜底）
 */

function renderTab3(a, ss, shots) {
  const bd = ss.structure_breakdown || [];

  bd.forEach(b => {
    (b.shots_included || []).forEach(sn => {
      const shot = shots.find(x => x.shot_number === sn);
      if (shot) shot._role = b.element;
    });
  });
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
      '<span class="sb-count">x' + sn.length + '</span>' +
      '<div class="sb-desc" style="margin-top:10px">' + sd.map(d => esc(d)).join('; ') + '</div>' +
      '<div class="sb-note">' + esc(b.description || '') + '</div>' +
    '</div>';
  });

  const filename = AppState.curFile ? AppState.curFile.name.replace(/\.[^.]+$/, '') : '';
  const framework = ss.framework || '未识别';
  const formula = ss.formula || '';
  const hookType = ss.hook_type || '';
  const isNewFramework = framework === '新框架';
  const newInfo = ss.new_framework_info || null;

  // 框架区域：可编辑+入库
  const frameworkSection =
    '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:16px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">' +
        '<span style="font-size:13px;font-weight:700;color:var(--text2)">框架匹配</span>' +
        '<span id="t3-framework-label" style="background:var(--accentBg);border:1px solid var(--accent);border-radius:8px;padding:4px 14px;font-size:13px;font-weight:700;color:var(--accent2)">' + esc(framework) + '</span>' +
        '<span style="font-size:13px;color:var(--text3);font-family:JetBrains Mono,monospace">' + esc(formula) + '</span>' +
        '<span style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:3px 12px;font-size:12px;color:var(--text3)">' + filename + '</span>' +
      '</div>' +
      // 可编辑区域
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">' +
        '<div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:2px">框架名称</label>' +
          '<input type="text" id="t3-fw-name" value="' + esc(isNewFramework && newInfo ? newInfo.name || '' : framework) + '" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;color:var(--text);font-family:inherit"></div>' +
        '<div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:2px">结构公式</label>' +
          '<input type="text" id="t3-fw-formula" value="' + esc(isNewFramework && newInfo ? newInfo.formula || formula : formula) + '" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;color:var(--text);font-family:inherit"></div>' +
        '<div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:2px">钩子类型</label>' +
          '<input type="text" id="t3-fw-hook" value="' + esc(isNewFramework && newInfo ? newInfo.hook_type || hookType : hookType) + '" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;color:var(--text);font-family:inherit"></div>' +
        '<div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:2px">难度</label>' +
          '<select id="t3-fw-diff" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;color:var(--text);font-family:inherit">' +
            '<option value="入门"' + ((newInfo?.difficulty || '') === '入门' ? ' selected' : '') + '>入门</option>' +
            '<option value="进阶"' + ((newInfo?.difficulty || '') === '进阶' ? ' selected' : '') + '>进阶</option>' +
            '<option value="高阶"' + ((newInfo?.difficulty || '') === '高阶' ? ' selected' : '') + '>高阶</option>' +
          '</select></div>' +
      '</div>' +
      '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:2px">核心逻辑</label>' +
        '<textarea id="t3-fw-logic" rows="5" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;color:var(--text);font-family:inherit;resize:vertical">' + esc(isNewFramework && newInfo ? newInfo.logic || '' : bd.map(b => '[' + b.element + '] ' + (b.description || '')).join('; ')) + '</textarea></div>' +
      '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:2px">适用场景</label>' +
        '<input type="text" id="t3-fw-scenario" value="' + esc(isNewFramework && newInfo ? newInfo.scenario || '' : '') + '" placeholder="适合什么品类/阶段使用" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;color:var(--text);font-family:inherit"></div>' +
      '<button class="btn-sm" id="btn-save-framework" onclick="saveNewFramework()" style="padding:6px 16px">' + (isNewFramework ? '入框架库（新框架）' : '更新到框架库') + '</button>' +
    '</div>';

  document.getElementById('t3').innerHTML =
    '<div class="str-layout">' +
      '<div class="str-left">' +
        '<div style="font-size:16px;font-weight:700;margin-bottom:12px">脚本结构分析</div>' +
        frameworkSection +
        blocks +
      '</div>' +
      '<div class="str-right" style="position:sticky;top:80px;align-self:start">' +
        '<div class="rw-panel">' +
          '<h3>跨品类仿写</h3>' +
          '<div class="rw-field"><label>新品类</label><input id="rw-cat" placeholder="婴儿服饰"></div>' +
          '<div class="rw-field"><label>产品名称</label><input id="rw-name" placeholder="有机棉连体衣"></div>' +
          '<div class="rw-field"><label>核心卖点（可选）</label><input id="rw-sell" placeholder="A类面料、无荧光剂、双向拉链"></div>' +
          '<button class="btn-rw" id="btn-rw" onclick="doRewrite()">生成板块仿写</button>' +
          '<div id="rw-result"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// ============== 板块级仿写 ==============

async function doRewrite() {
  const cat = document.getElementById('rw-cat').value.trim();
  const name = document.getElementById('rw-name').value.trim();
  const sell = document.getElementById('rw-sell').value.trim();
  if (!cat || !name) return showErr('请填写新品类和产品名称');
  hideErr();
  AppState._rwCategory = cat;
  AppState._rwProductName = name;
  const btn = document.getElementById('btn-rw');
  btn.disabled = true; btn.textContent = '仿写中...';
  const re = document.getElementById('rw-result');
  re.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center"><div class="spin" style="margin:0 auto 10px"></div>Claude 正在生成板块仿写...</div>';
  try {
    const analysis = AppState.analysisData?.analysis || AppState.analysisData;
    const rw = await API.rewrite(analysis, cat, name, sell);
    renderRewriteBlocks(rw);
  } catch (e) { re.innerHTML = '<div style="color:var(--red);padding:12px">' + esc(e.message) + '</div>'; }
  finally { btn.disabled = false; btn.textContent = '生成板块仿写'; }
}

function renderRewriteBlocks(rw) {
  const re = document.getElementById('rw-result');

  // ★ V3.6.1: 加强 JSON 解析，多种清理策略
  if (rw.raw_response) {
    let parsed = null;
    const raw = rw.raw_response;

    // 策略1: 去 markdown 代码块标记
    try {
      const c1 = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const s1 = c1.indexOf('{'), e1 = c1.lastIndexOf('}');
      if (s1 !== -1 && e1 > s1) { const p = JSON.parse(c1.substring(s1, e1 + 1)); if (p.blocks) parsed = p; }
    } catch (e) {}

    // 策略2: 找所有可能的JSON块，逐个尝试
    if (!parsed) {
      try {
        const jsonBlocks = raw.match(/\{[\s\S]*?\}(?=\s*$|\s*```)/g) || [];
        for (const block of jsonBlocks) {
          try { const p = JSON.parse(block); if (p.blocks) { parsed = p; break; } } catch (e) {}
        }
      } catch (e) {}
    }

    // 策略3: 去掉所有非JSON前缀后缀文字
    if (!parsed) {
      try {
        const s3 = raw.indexOf('{"');
        const e3 = raw.lastIndexOf('}');
        if (s3 !== -1 && e3 > s3) {
          const p = JSON.parse(raw.substring(s3, e3 + 1));
          if (p.blocks) parsed = p;
        }
      } catch (e) {}
    }

    // 策略4: 修复常见JSON错误（尾部多余逗号）
    if (!parsed) {
      try {
        let c4 = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const s4 = c4.indexOf('{'), e4 = c4.lastIndexOf('}');
        if (s4 !== -1 && e4 > s4) {
          let jsonStr = c4.substring(s4, e4 + 1);
          jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1'); // 去尾部逗号
          const p = JSON.parse(jsonStr);
          if (p.blocks) parsed = p;
        }
      } catch (e) {}
    }

    // 策略5: 正则直接提取 blocks 数组，绕过外层大括号parse失败
    if (!parsed) {
      try {
        const m = raw.match(/"blocks"\s*:\s*(\[[\s\S]*\])\s*[,}]/);
        if (m) {
          let arrStr = m[1].replace(/,\s*([}\]])/g, '$1');
          const blocks = JSON.parse(arrStr);
          if (Array.isArray(blocks) && blocks.length > 0) {
            const fw = (raw.match(/"framework"\s*:\s*"([^"]*)"/) || [])[1] || '';
            const fo = (raw.match(/"formula"\s*:\s*"([^"]*)"/) || [])[1] || '';
            parsed = { framework: fw, formula: fo, blocks };
          }
        }
      } catch (e) {}
    }

    if (parsed) {
      rw = parsed;
    } else {
      // 所有策略都失败，显示原文并提供重试按钮
      re.innerHTML = '<div style="background:var(--redBg);border:1px solid var(--redBd);border-radius:var(--r);padding:16px;margin-top:16px">' +
        '<div style="font-size:14px;font-weight:700;color:#fca5a5;margin-bottom:8px">仿写结果解析失败，请重试</div>' +
        '<div style="font-size:13px;color:var(--text2);white-space:pre-wrap;line-height:1.8;max-height:200px;overflow-y:auto">' + esc(raw.substring(0, 500)) + '</div>' +
        '<button class="btn-sm" style="margin-top:10px;padding:6px 16px" onclick="doRewrite()">重新生成</button>' +
      '</div>';
      return;
    }
  }

  AppState.lastRewrite = rw;
  AppState._rewriteBlocks = rw;
  AppState.t4Initialized = false;
  const blocks = rw.blocks || [];
  if (blocks.length === 0) { re.innerHTML = '<div style="color:var(--text3);padding:12px">未生成仿写内容</div>'; return; }
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
  h += '<button class="btn-rw" id="btn-expand" onclick="doExpand()" style="margin-top:16px;background:var(--accent);color:#fff;border-color:var(--accent)">生成分镜脚本 -> Tab 4</button>';
  h += '<div id="expand-status"></div>';
  re.innerHTML = h;
}

function t3UpdateBlock(idx, value) {
  const rw = AppState._rewriteBlocks || AppState.lastRewrite;
  if (rw && rw.blocks && rw.blocks[idx]) rw.blocks[idx].rewrite_direction = value;
}

// ============== 板块->镜头级脚本 ==============

async function doExpand() {
  const rw = AppState._rewriteBlocks || AppState.lastRewrite;
  if (!rw || !rw.blocks) return showErr('请先完成板块仿写');
  const btn = document.getElementById('btn-expand');
  const status = document.getElementById('expand-status');
  btn.disabled = true; btn.textContent = '生成中...';
  status.innerHTML = '<div style="color:var(--text3);padding:12px;text-align:center"><div class="spin" style="margin:0 auto 8px"></div>Claude 正在扩展为分镜脚本...</div>';
  try {
    const shots = AppState._analysisShots || [];
    const bd = AppState._structureBreakdown || [];
    bd.forEach(b => { (b.shots_included || []).forEach(sn => { const shot = shots.find(x => x.shot_number === sn); if (shot) shot._role = b.element; }); });
    let result = await API.expand(shots, bd, rw.blocks, AppState._rwProductName || '', AppState._rwCategory || '');

    // ★ V3.6.2: 前端多策略 JSON 补救（跟 renderRewriteBlocks 一致）
    if (result.raw_response) {
      let parsed = null;
      const raw = result.raw_response;
      // 策略1: 去markdown代码块
      try { const c = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s !== -1 && e > s) { const p = JSON.parse(c.substring(s, e + 1)); if (p.shots) parsed = p; } } catch (e) {}
      // 策略2: 从 {" 开始
      if (!parsed) { try { const s = raw.indexOf('{"'), e = raw.lastIndexOf('}'); if (s !== -1 && e > s) { const p = JSON.parse(raw.substring(s, e + 1)); if (p.shots) parsed = p; } } catch (e) {} }
      // 策略3: 修复尾部逗号
      if (!parsed) { try { const c = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s !== -1 && e > s) { let j = c.substring(s, e + 1).replace(/,\s*([}\]])/g, '$1'); const p = JSON.parse(j); if (p.shots) parsed = p; } } catch (e) {} }
      if (parsed) { result = parsed; }
      else {
        status.innerHTML = '<div style="background:var(--redBg);border:1px solid var(--redBd);border-radius:var(--r);padding:16px">' +
          '<div style="font-size:14px;font-weight:700;color:#fca5a5;margin-bottom:8px">分镜脚本生成解析失败，请重试</div>' +
          '<div style="font-size:12px;color:var(--text2);white-space:pre-wrap;max-height:150px;overflow-y:auto">' + esc(raw.substring(0, 400)) + '</div>' +
          '<button class="btn-sm" style="margin-top:10px;padding:6px 16px" onclick="doExpand()">重新生成</button></div>';
        btn.disabled = false; btn.textContent = '生成分镜脚本 -> Tab 4';
        return;
      }
    }

    const expandData = {
      rewritten_structure: (result.shots || []).map(s => ({ ...s, element: s.role || '无', camera: s.camera || { shot_size: '', lighting: [], movement: '', composition: '', style: '' } })),
      framework: rw.framework || '', formula: rw.formula || ''
    };
    AppState._rewriteBlocks = rw;
    AppState.lastRewrite = expandData;
    AppState.t4Initialized = false;
    status.innerHTML = '<div style="color:var(--green);padding:12px;text-align:center">已生成 ' + (result.shots || []).length + ' 个镜头的分镜脚本，切换到 Tab 4 查看编辑</div>';
    btn.disabled = false; btn.textContent = '重新生成分镜脚本';
    const t4Tab = document.querySelector('[data-tab="t4"]');
    if (t4Tab) { t4Tab.style.background = 'var(--accentBg)'; setTimeout(() => t4Tab.style.background = '', 3000); }
  } catch (e) { status.innerHTML = '<div style="color:var(--red);padding:12px">' + esc(e.message) + '</div>'; btn.disabled = false; btn.textContent = '生成分镜脚本 -> Tab 4'; }
}

// ============== 框架入库（可编辑后入库） ==============

async function saveNewFramework() {
  const name = (document.getElementById('t3-fw-name')?.value || '').trim();
  const formula = (document.getElementById('t3-fw-formula')?.value || '').trim();
  const hookType = (document.getElementById('t3-fw-hook')?.value || '').trim();
  const logic = (document.getElementById('t3-fw-logic')?.value || '').trim();
  const scenario = (document.getElementById('t3-fw-scenario')?.value || '').trim();
  const difficulty = (document.getElementById('t3-fw-diff')?.value || '').trim();

  if (!name || !formula) return showErr('框架名称和公式不能为空');
  hideErr();

  const btn = document.getElementById('btn-save-framework');
  btn.disabled = true; btn.textContent = '入库中...';

  try {
    await API.createFramework(name, formula, hookType, logic, scenario, difficulty);
    btn.textContent = '已入库';
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green)';
    // 更新顶部标签
    const label = document.getElementById('t3-framework-label');
    if (label) label.textContent = name;
  } catch (e) {
    btn.disabled = false; btn.textContent = '入框架库';
    showErr('框架入库失败: ' + e.message);
  }
}

window.renderTab3 = renderTab3;
window.doRewrite = doRewrite;
window.renderRewriteBlocks = renderRewriteBlocks;
window.t3UpdateBlock = t3UpdateBlock;
window.doExpand = doExpand;
window.saveNewFramework = saveNewFramework;
