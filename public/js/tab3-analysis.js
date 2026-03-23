/**
 * tab3-analysis.js — 结构分析 + 改写 Tab
 */

function renderTab3(a, ss, shots) {
  const bd = ss.structure_breakdown || [];
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
      '<div class="sb-desc" style="margin-top:10px">' + sd.map(d => esc(d)).join('；') + '</div>' +
      '<div class="sb-note">+' + esc(b.description || '') + '</div>' +
    '</div>';
  });

  const filename = AppState.curFile ? AppState.curFile.name.replace(/\.[^.]+$/, '') : '';

  document.getElementById('t3').innerHTML =
    '<div class="str-layout">' +
      '<div class="str-left">' +
        '<div style="font-size:16px;font-weight:700;margin-bottom:6px">📊 脚本结构分析</div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
          '<span style="font-size:13px;color:var(--text3)">分析和拆解文案脚本结构</span>' +
          '<span style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px 12px;font-size:12px;color:var(--text3);font-family:JetBrains Mono,monospace">' + filename + '</span>' +
        '</div>' +
        blocks +
      '</div>' +
      '<div class="str-right" style="position:sticky;top:80px;align-self:start">' +
        '<div class="rw-panel">' +
          '<h3>✏️ 将文案脚本进行跨类目复刻</h3>' +
          '<div class="rw-field"><label>新品类</label><input id="rw-cat" placeholder="宠物用品"></div>' +
          '<div class="rw-field"><label>产品名称</label><input id="rw-name" placeholder="猫咪自动饮水机"></div>' +
          '<div class="rw-field"><label>核心卖点（可选）</label><input id="rw-sell" placeholder="静音水泵、四重过滤、2L大容量"></div>' +
          '<button class="btn-rw" id="btn-rw" onclick="doRewrite()">开始跨品类改编</button>' +
          '<div class="rw-result" id="rw-result"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

async function doRewrite() {
  const cat = document.getElementById('rw-cat').value.trim();
  const name = document.getElementById('rw-name').value.trim();
  const sell = document.getElementById('rw-sell').value.trim();
  if (!cat || !name) return showErr('请填写新品类和产品名称');
  hideErr();

  const btn = document.getElementById('btn-rw');
  btn.disabled = true;
  btn.textContent = '改编中…';
  const re = document.getElementById('rw-result');
  re.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center"><div class="spin" style="margin:0 auto 10px"></div>Claude 正在改编脚本…</div>';

  try {
    const analysis = AppState.analysisData?.analysis || AppState.analysisData;
    const rw = await API.rewrite(analysis, cat, name, sell);
    renderRewrite(rw);
  } catch (e) {
    re.innerHTML = '<div style="color:var(--red);padding:12px">❌ ' + esc(e.message) + '</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = '开始跨品类改编';
  }
}

function renderRewrite(rw) {
  // 存储改写数据到全局状态（供 Tab 4 使用）
  AppState.lastRewrite = rw;
  AppState.t4RewriteData = null;
  AppState.t4Initialized = false;

  const items = rw.rewritten_structure || [];
  const re = document.getElementById('rw-result');

  if (rw.raw_response) {
    re.innerHTML = '<div style="background:var(--bg3);border-radius:var(--r);padding:16px;margin-top:16px;font-size:13px;color:var(--text2);white-space:pre-wrap;line-height:1.8">' + esc(rw.raw_response) + '</div>';
    return;
  }

  let h = items.map(it => {
    const cls = elemCls(it.element);
    return '<div class="rw-item">' +
      '<button class="btn-cp" onclick="navigator.clipboard.writeText(this.parentElement.innerText)">复制</button>' +
      '<span class="rw-tag bg-' + cls + '">' + esc(it.element) + '</span>' +
      '<div class="rw-en">' + esc(it.scene_description_en || it.voiceover_en || '') + '</div>' +
      '<div class="rw-cn">' + esc(it.scene_description_cn || it.voiceover_cn || '') + '</div>' +
      (it.shooting_notes ? '<div class="rw-note">推荐镜头：' + esc(it.shooting_notes) + '</div>' : '') +
    '</div>';
  }).join('');

  if (rw.hook_suggestion)
    h += '<div class="rw-item"><span class="rw-tag bg-blue">Hook</span><div class="rw-en">' + esc(rw.hook_suggestion) + '</div></div>';
  if (rw.cta_suggestion)
    h += '<div class="rw-item"><span class="rw-tag bg-red">CTA</span><div class="rw-en">' + esc(rw.cta_suggestion) + '</div></div>';

  re.innerHTML = h;
}

window.renderTab3 = renderTab3;
window.doRewrite = doRewrite;
window.renderRewrite = renderRewrite;
