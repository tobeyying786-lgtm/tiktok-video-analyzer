/**
 * app.js — 主逻辑：上传流程、Tab 切换、工具函数、结果渲染
 */

// ============== 工具函数 ==============

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

function shotCls(t) {
  const r = (t || '').toLowerCase();
  if (r.includes('痛点') || r.includes('情绪')) return 'orange';
  if (r.includes('产品') || r.includes('展示')) return 'green';
  if (r.includes('场景') || r.includes('使用')) return 'blue';
  if (r.includes('特写') || r.includes('细节')) return 'purple';
  if (r.includes('对比') || r.includes('效果')) return 'amber';
  if (r.includes('行动') || r.includes('引导')) return 'red';
  if (r.includes('开箱')) return 'pink';
  if (r.includes('证明')) return 'amber';
  return 'slate';
}

function elemCls(e) {
  const r = (e || '').toLowerCase();
  if (r.includes('停')) return 'blue';
  if (r.includes('病')) return 'orange';
  if (r.includes('药')) return 'green';
  if (r.includes('信')) return 'amber';
  if (r.includes('买')) return 'red';
  return 'slate';
}

function showProg() {
  document.getElementById('prog').classList.add('on');
  document.getElementById('prog-list').innerHTML = '';
  document.getElementById('prog-msg').textContent = '分析中…';
}
function hideProg() { document.getElementById('prog').classList.remove('on'); }
function showErr(m) { document.getElementById('errMsg').textContent = m; document.getElementById('errBox').classList.add('on'); }
function hideErr() { document.getElementById('errBox').classList.remove('on'); }
function openLB(src) { document.getElementById('lb-img').src = src; document.getElementById('lb').classList.add('on'); }

// 导出工具函数到全局
window.esc = esc;
window.shotCls = shotCls;
window.elemCls = elemCls;
window.showProg = showProg;
window.hideProg = hideProg;
window.showErr = showErr;
window.hideErr = hideErr;
window.openLB = openLB;

// ============== 上传 & 文件选择 ==============

document.addEventListener('DOMContentLoaded', () => {
  const upzone = document.getElementById('upzone');
  const fileIn = document.getElementById('fileIn');

  upzone.addEventListener('click', () => fileIn.click());
  upzone.addEventListener('dragover', e => { e.preventDefault(); upzone.classList.add('drag'); });
  upzone.addEventListener('dragleave', () => upzone.classList.remove('drag'));
  upzone.addEventListener('drop', e => {
    e.preventDefault();
    upzone.classList.remove('drag');
    if (e.dataTransfer.files.length && e.dataTransfer.files[0].type.startsWith('video/')) {
      AppState.curFile = e.dataTransfer.files[0];
      showSel();
    }
  });
  fileIn.addEventListener('change', () => {
    if (fileIn.files.length) {
      AppState.curFile = fileIn.files[0];
      showSel();
    }
  });

  // ESC 关闭 lightbox
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('lb').classList.remove('on');
  });
});

function showSel() {
  const upzone = document.getElementById('upzone');
  upzone.innerHTML = '<div style="text-align:center">' +
    '<div style="font-size:40px;margin-bottom:10px">✅</div>' +
    '<div style="font-size:16px;font-weight:600;color:var(--accent2)">' + esc(AppState.curFile.name) + '</div>' +
    '<div style="font-size:13px;color:var(--text3)">' + (AppState.curFile.size / 1048576).toFixed(1) + ' MB</div>' +
  '</div><input type="file" id="fileIn" accept="video/*" style="display:none">';
  // 重新绑定 fileIn
  document.getElementById('fileIn').addEventListener('change', () => {
    if (document.getElementById('fileIn').files.length) {
      AppState.curFile = document.getElementById('fileIn').files[0];
      showSel();
    }
  });
}

// ============== 分析流程 ==============

async function startAnalysis() {
  if (!AppState.curFile) return showErr('请先上传视频文件');
  hideErr();
  document.getElementById('btn-go').disabled = true;
  showProg();

  await API.analyze(
    AppState.curFile,
    // onStep
    (step, message) => onSSE({ step, message }),
    // onDone
    (data) => {
      AppState.analysisData = data;
      renderResult(data);
      document.getElementById('btn-go').disabled = false;
      setTimeout(hideProg, 300);
    },
    // onError
    (e) => {
      showErr('拆解失败: ' + e.message);
      document.getElementById('btn-go').disabled = false;
      setTimeout(hideProg, 300);
    }
  );
}

function onSSE(m) {
  const list = document.getElementById('prog-list');
  const msg = document.getElementById('prog-msg');
  if (m.step === -1) { showErr(m.message); return; }
  msg.textContent = m.message || '';
  let el = document.getElementById('ps-' + m.step);
  if (!el) {
    el = document.createElement('div');
    el.id = 'ps-' + m.step;
    el.className = 'ps on';
    el.innerHTML = '<span class="si">⏳</span>' + esc(m.message);
    list.appendChild(el);
  }
  list.querySelectorAll('.ps').forEach(p => {
    const id = parseFloat(p.id.replace('ps-', ''));
    if (id < m.step) { p.className = 'ps done'; p.querySelector('.si').textContent = '✓'; }
  });
  if (m.data) { el.className = 'ps done'; el.querySelector('.si').textContent = '✓'; }
}

// ============== 结果渲染 ==============

function renderResult(data) {
  const a = data.analysis || data;
  const ov = a.video_overview || {};
  const ss = a.script_structure || {};
  const shots = a.shots || [];

  document.getElementById('page-upload').style.display = 'none';
  document.getElementById('page-result').style.display = 'block';
  document.getElementById('btn-reset').style.display = '';
  document.getElementById('hdr-sub').textContent = '分析报告 - ' + (AppState.curFile ? AppState.curFile.name : '');

  // 指标卡
  document.getElementById('metrics').innerHTML =
    '<div class="mc"><div class="mv c-orange">' + (ov.product_first_appear_seconds || '--') + '秒</div><div class="ml">产品首次出现</div><div class="ms">黄金3秒内出现最佳</div></div>' +
    '<div class="mc"><div class="mv c-green">' + (ov.product_exposure_seconds || '--') + '秒</div><div class="ml">产品露出时长</div><div class="ms">建议占比30%以上</div></div>' +
    '<div class="mc"><div class="mv c-accent">' + (ov.product_exposure_ratio || '--') + '%</div><div class="ml">产品露出占比</div><div class="ms">高转化视频40%+</div></div>' +
    '<div class="mc"><div class="mv c-blue">' + (ov.total_duration_seconds || '--') + '秒</div><div class="ml">视频总时长</div><div class="ms">短视频15-60秒最佳</div></div>' +
    '<div class="mc"><div class="mv c-pink">' + (ov.total_shots || shots.length) + '个</div><div class="ml">镜头数量</div><div class="ms">平均2-3秒/镜头</div></div>';

  const fa = ov.product_first_appear_seconds;
  document.getElementById('tip-bar').innerHTML = fa
    ? '💡 优化建议：产品首现时间为' + fa + '秒，' + (fa > 5 ? '建议在5秒内展示产品' : '表现良好！')
    : '';

  // 渲染各 Tab
  renderTab1(shots);
  renderTab2(shots);
  renderTab3(a, ss, shots);
}

// ============== Tab 切换 ==============

function switchTab(id, el) {
  if (el.style.opacity === '0.5') return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(id).classList.add('active');
  // Tab 4 懒加载
  if (id === 't4') renderTab4();
}

// ============== 飞书入库（确认面板模式） ==============

// 素材库定义
const SAVE_LIBRARIES = {
  competitor: { name: '竞品爆款拆解库', color: 'pink' },
  cta: { name: '号召行动库 CTA', color: 'blue' },
  painpoint: { name: '痛点需求场景库', color: 'orange' },
  sellingpt: { name: '卖点画面库', color: 'green' },
  socialproof: { name: '社会证明库', color: 'amber' },
  benefit: { name: '权益库', color: 'red' },
  comment: { name: '爆款评论库', color: 'purple' },
  bgm: { name: 'BGM情绪库', color: 'slate' }
};

function saveToFeishu() {
  if (!AppState.analysisData) return showErr('请先完成视频拆解');
  hideErr();

  const a = AppState.analysisData?.analysis || AppState.analysisData;
  const em = a.extracted_materials || {};

  // 根据分析数据自动建议入哪些库
  const suggestions = [];
  suggestions.push({ lib: 'competitor', reason: '拆解分析本身就是竞品研究，记录视频结构和可复用点', checked: true });

  if ((em.hook_scripts || []).length > 0 || (em.cta_scripts || []).length > 0) {
    const hooks = (em.hook_scripts || []).map(h => h.text).join('；').substring(0, 60);
    suggestions.push({ lib: 'cta', reason: '提取到钩子/CTA话术：' + (hooks || '有促单话术'), checked: true });
  }
  if ((em.pain_points || []).length > 0) {
    const pts = (em.pain_points || []).map(p => p.user_pain || p.scene).join('；').substring(0, 60);
    suggestions.push({ lib: 'painpoint', reason: '提取到痛点场景：' + pts, checked: true });
  }
  if ((em.selling_points || []).length > 0) {
    suggestions.push({ lib: 'sellingpt', reason: '提取到卖点画面：' + (em.selling_points || []).length + '个', checked: true });
  }
  if ((em.social_proof || []).length > 0) {
    suggestions.push({ lib: 'socialproof', reason: '提取到社会证明素材：' + (em.social_proof || []).length + '条', checked: true });
  }
  if (em.bgm && em.bgm.mood) {
    suggestions.push({ lib: 'bgm', reason: 'BGM情绪：' + em.bgm.mood + ' - ' + (em.bgm.description || ''), checked: true });
  }

  AppState._saveSuggestions = suggestions;
  renderSavePanel(suggestions);
}

function renderSavePanel(suggestions) {
  const panel = document.getElementById('save-panel');

  // 库列表
  let libRows = suggestions.map((s, i) => {
    const lib = SAVE_LIBRARIES[s.lib];
    return '<div class="save-lib-row">' +
      '<input type="checkbox" class="save-lib-check" data-idx="' + i + '"' + (s.checked ? ' checked' : '') + ' onchange="saveToggleLib(' + i + ',this.checked)">' +
      '<div class="save-lib-info">' +
        '<div class="save-lib-name"><span class="bg-' + lib.color + '" style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;margin-right:6px">' + esc(lib.name) + '</span></div>' +
        '<div class="save-lib-reason">' + esc(s.reason) + '</div>' +
        '<div class="save-lib-note"><input type="text" placeholder="补充备注（可选）" data-idx="' + i + '" oninput="saveUpdateNote(' + i + ',this.value)" value="' + esc(s.note || '') + '"></div>' +
      '</div>' +
    '</div>';
  }).join('');

  // 添加遗漏库的下拉
  const existingLibs = suggestions.map(s => s.lib);
  const missingLibs = Object.entries(SAVE_LIBRARIES).filter(([k]) => !existingLibs.includes(k));
  let addOptions = '<option value="">— 选择要添加的库 —</option>';
  missingLibs.forEach(([k, v]) => {
    addOptions += '<option value="' + k + '">' + v.name + '</option>';
  });

  panel.innerHTML = '<div class="archive-panel">' +
    '<h3>📝 入库确认</h3>' +
    '<div style="font-size:13px;color:var(--text3);margin-bottom:16px">AI 根据分析结果建议入以下素材库，你可以勾选/取消/添加/写备注</div>' +
    '<div id="save-lib-list">' + libRows + '</div>' +
    (missingLibs.length > 0 ? '<div class="save-add-row">' +
      '<select class="t4-select" style="width:auto;min-width:200px" id="save-add-select">' + addOptions + '</select>' +
      '<input type="text" placeholder="入库理由" id="save-add-reason" style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--text);font-family:inherit">' +
      '<button class="btn-sm" style="padding:6px 14px" onclick="saveAddLib()">添加</button>' +
    '</div>' : '') +
    '<div class="archive-actions">' +
      '<button class="btn-go" style="flex:1" id="btn-save-confirm" onclick="saveConfirm()">✅ 确认入库（' + suggestions.filter(s => s.checked).length + ' 个库）</button>' +
      '<button class="btn-sec" onclick="savePanelClose()">取消</button>' +
    '</div>' +
    '<div id="save-status"></div>' +
  '</div>';

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveToggleLib(idx, checked) {
  if (AppState._saveSuggestions[idx]) {
    AppState._saveSuggestions[idx].checked = checked;
    const count = AppState._saveSuggestions.filter(s => s.checked).length;
    const btn = document.getElementById('btn-save-confirm');
    if (btn) btn.textContent = '✅ 确认入库（' + count + ' 个库）';
  }
}

function saveUpdateNote(idx, value) {
  if (AppState._saveSuggestions[idx]) {
    AppState._saveSuggestions[idx].note = value;
  }
}

function saveAddLib() {
  const sel = document.getElementById('save-add-select');
  const reason = document.getElementById('save-add-reason');
  const libKey = sel ? sel.value : '';
  const reasonText = reason ? reason.value.trim() : '';
  if (!libKey) return;

  AppState._saveSuggestions.push({
    lib: libKey,
    reason: reasonText || '手动添加',
    note: '',
    checked: true
  });
  renderSavePanel(AppState._saveSuggestions);
}

async function saveConfirm() {
  const selected = AppState._saveSuggestions.filter(s => s.checked);
  if (selected.length === 0) return showErr('请至少选择一个库');

  const btn = document.getElementById('btn-save-confirm');
  const status = document.getElementById('save-status');
  btn.disabled = true;
  btn.textContent = '⏳ 写入中…';
  status.innerHTML = '<div style="color:var(--text3);padding:12px;text-align:center"><div class="spin" style="margin:0 auto 8px"></div>正在写入 ' + selected.length + ' 个库…</div>';

  try {
    const analysis = AppState.analysisData?.analysis || AppState.analysisData;
    const videoUrl = AppState.analysisData?.videoUrl || '';
    const filename = AppState.curFile ? AppState.curFile.name : '';
    const libs = selected.map(s => ({ lib: s.lib, note: s.note || '' }));

    const data = await API.saveToFeishu(analysis, '', videoUrl, filename, libs);
    const saved = data.results?.saved?.length || 0;
    const errors = data.results?.errors || [];

    let resultHtml = '<div style="padding:12px;text-align:center">';
    if (saved > 0) resultHtml += '<div style="color:var(--green);font-weight:700;margin-bottom:8px">✅ 成功写入 ' + saved + ' 条记录</div>';
    if (errors.length > 0) resultHtml += '<div style="color:var(--red);font-size:13px">' + errors.map(e => e.table + ': ' + e.error).join('<br>') + '</div>';
    resultHtml += '</div>';
    status.innerHTML = resultHtml;

    btn.textContent = '✅ 入库完成';
    setTimeout(() => { btn.disabled = false; btn.textContent = '✅ 确认入库（' + selected.length + ' 个库）'; }, 3000);
  } catch (e) {
    status.innerHTML = '<div style="color:var(--red);padding:12px">❌ ' + esc(e.message) + '</div>';
    btn.disabled = false;
    btn.textContent = '✅ 确认入库';
  }
}

function savePanelClose() {
  document.getElementById('save-panel').style.display = 'none';
}

// 导出到全局
window.showSel = showSel;
window.startAnalysis = startAnalysis;
window.switchTab = switchTab;
window.saveToFeishu = saveToFeishu;
window.saveToggleLib = saveToggleLib;
window.saveUpdateNote = saveUpdateNote;
window.saveAddLib = saveAddLib;
window.saveConfirm = saveConfirm;
window.savePanelClose = savePanelClose;
window.resetAll = resetAll;
