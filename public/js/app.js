/**
 * app.js — V3.5.4
 * 改动：去emoji、CTA三段完整不截断、竞品摘要完整、权益默认不勾、飞书字段对齐
 */

function esc(t) { const d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }

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

function showProg() { document.getElementById('prog').classList.add('on'); document.getElementById('prog-list').innerHTML = ''; document.getElementById('prog-msg').textContent = '分析中...'; }
function hideProg() { document.getElementById('prog').classList.remove('on'); }
function showErr(m) { document.getElementById('errMsg').textContent = m; document.getElementById('errBox').classList.add('on'); }
function hideErr() { document.getElementById('errBox').classList.remove('on'); }
function openLB(src) { document.getElementById('lb-img').src = src; document.getElementById('lb').classList.add('on'); }

window.esc = esc; window.shotCls = shotCls; window.elemCls = elemCls;
window.showProg = showProg; window.hideProg = hideProg; window.showErr = showErr; window.hideErr = hideErr; window.openLB = openLB;

// ============== 上传 ==============
document.addEventListener('DOMContentLoaded', () => {
  const upzone = document.getElementById('upzone'), fileIn = document.getElementById('fileIn');
  upzone.addEventListener('click', () => fileIn.click());
  upzone.addEventListener('dragover', e => { e.preventDefault(); upzone.classList.add('drag'); });
  upzone.addEventListener('dragleave', () => upzone.classList.remove('drag'));
  upzone.addEventListener('drop', e => { e.preventDefault(); upzone.classList.remove('drag'); if (e.dataTransfer.files.length && e.dataTransfer.files[0].type.startsWith('video/')) { AppState.curFile = e.dataTransfer.files[0]; showSel(); } });
  fileIn.addEventListener('change', () => { if (fileIn.files.length) { AppState.curFile = fileIn.files[0]; showSel(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('lb').classList.remove('on'); });
});

function showSel() {
  const upzone = document.getElementById('upzone');
  upzone.innerHTML = '<div style="text-align:center"><div style="font-size:40px;margin-bottom:10px">OK</div><div style="font-size:16px;font-weight:600;color:var(--accent2)">' + esc(AppState.curFile.name) + '</div><div style="font-size:13px;color:var(--text3)">' + (AppState.curFile.size / 1048576).toFixed(1) + ' MB</div></div><input type="file" id="fileIn" accept="video/*" style="display:none">';
  document.getElementById('fileIn').addEventListener('change', () => { if (document.getElementById('fileIn').files.length) { AppState.curFile = document.getElementById('fileIn').files[0]; showSel(); } });
}

// ============== 分析 ==============
async function startAnalysis() {
  if (!AppState.curFile) return showErr('请先上传视频文件');
  hideErr(); document.getElementById('btn-go').disabled = true; showProg();
  const memoEl = document.getElementById('analyze-memo');
  const memo = memoEl ? memoEl.value.trim() : '';
  AppState._analyzeMemo = memo;
  await API.analyze(AppState.curFile, memo,
    (step, message) => onSSE({ step, message }),
    (data) => { AppState.analysisData = data; renderResult(data); document.getElementById('btn-go').disabled = false; setTimeout(hideProg, 300); },
    (e) => { showErr('拆解失败: ' + e.message); document.getElementById('btn-go').disabled = false; setTimeout(hideProg, 300); }
  );
}

function onSSE(m) {
  const list = document.getElementById('prog-list'), msg = document.getElementById('prog-msg');
  if (m.step === -1) { showErr(m.message); return; }
  msg.textContent = m.message || '';
  let el = document.getElementById('ps-' + m.step);
  if (!el) { el = document.createElement('div'); el.id = 'ps-' + m.step; el.className = 'ps on'; el.innerHTML = '<span class="si">...</span>' + esc(m.message); list.appendChild(el); }
  list.querySelectorAll('.ps').forEach(p => { const id = parseFloat(p.id.replace('ps-', '')); if (id < m.step) { p.className = 'ps done'; p.querySelector('.si').textContent = 'OK'; } });
  if (m.data) { el.className = 'ps done'; el.querySelector('.si').textContent = 'OK'; }
}

// ============== 结果渲染 ==============
function renderResult(data) {
  const a = data.analysis || data, ov = a.video_overview || {}, ss = a.script_structure || {}, shots = a.shots || [];
  document.getElementById('page-upload').style.display = 'none';
  document.getElementById('page-result').style.display = 'block';
  document.getElementById('btn-reset').style.display = '';
  document.getElementById('hdr-sub').textContent = '分析报告 - ' + (AppState.curFile ? AppState.curFile.name : '');
  document.getElementById('metrics').innerHTML =
    '<div class="mc"><div class="mv c-orange">' + (ov.product_first_appear_seconds || '--') + '秒</div><div class="ml">产品首次出现</div><div class="ms">黄金3秒内出现最佳</div></div>' +
    '<div class="mc"><div class="mv c-green">' + (ov.product_exposure_seconds || '--') + '秒</div><div class="ml">产品露出时长</div><div class="ms">建议占比30%以上</div></div>' +
    '<div class="mc"><div class="mv c-accent">' + (ov.product_exposure_ratio || '--') + '%</div><div class="ml">产品露出占比</div><div class="ms">高转化视频40%+</div></div>' +
    '<div class="mc"><div class="mv c-blue">' + (ov.total_duration_seconds || '--') + '秒</div><div class="ml">视频总时长</div><div class="ms">短视频15-60秒最佳</div></div>' +
    '<div class="mc"><div class="mv c-pink">' + (ov.total_shots || shots.length) + '个</div><div class="ml">镜头数量</div><div class="ms">平均2-3秒/镜头</div></div>';
  const fa = ov.product_first_appear_seconds;
  document.getElementById('tip-bar').innerHTML = fa ? '产品首现时间为' + fa + '秒，' + (fa > 5 ? '建议在5秒内展示产品' : '表现良好') : '';
  renderTab1(shots); renderTab2(shots); renderTab3(a, ss, shots);
}

// ============== Tab 切换 ==============
function switchTab(id, el) {
  if (el.style.opacity === '0.5') return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active'); document.getElementById(id).classList.add('active');
  if (id === 't4') renderTab4();
}

// ============== 飞书入库 V3.5.4 ==============
const SAVE_LIBRARIES = {
  cta_hook: { name: 'CTA - 开头钩子', color: 'blue', parent: 'cta' },
  cta_mid: { name: 'CTA - 中间引导', color: 'blue', parent: 'cta' },
  cta_end: { name: 'CTA - 结尾促单', color: 'blue', parent: 'cta' },
  painpoint: { name: '痛点需求场景库', color: 'orange' },
  sellingpt: { name: '卖点画面库', color: 'green' },
  socialproof: { name: '社会证明库', color: 'amber' },
  benefit: { name: '权益库', color: 'red' },
  bgm: { name: 'BGM情绪库', color: 'slate' }
};

function saveToFeishu() {
  if (!AppState.analysisData) return showErr('请先完成视频拆解');
  hideErr();
  const a = AppState.analysisData?.analysis || AppState.analysisData;
  const em = a.extracted_materials || {};
  const suggestions = [];
  const allCta = em.cta || [];

  // CTA 开头 — 完整显示，不截断
  const hooks = allCta.filter(c => c.stage && c.stage.includes('开头'));
  if (hooks.length > 0) {
    const detail = hooks.map(h =>
      '「' + (h.text_foreign || '') + '」（' + (h.action_type || '') + '）\n' +
      '逻辑: ' + (h.psychology || '') + '\n' +
      '画面: ' + (h.visual_pairing || '')
    ).join('\n\n');
    suggestions.push({ lib: 'cta_hook', reason: detail, checked: true, note: '' });
  }

  // CTA 中间
  const mids = allCta.filter(c => c.stage && c.stage.includes('中间'));
  if (mids.length > 0) {
    const detail = mids.map(h =>
      '「' + (h.text_foreign || '') + '」（' + (h.action_type || '') + '）\n' +
      '逻辑: ' + (h.psychology || '') + '\n' +
      '画面: ' + (h.visual_pairing || '')
    ).join('\n\n');
    suggestions.push({ lib: 'cta_mid', reason: detail, checked: true, note: '' });
  }

  // CTA 结尾
  const ends = allCta.filter(c => c.stage && c.stage.includes('结尾'));
  if (ends.length > 0) {
    const detail = ends.map(h =>
      '「' + (h.text_foreign || '') + '」（' + (h.action_type || '') + '）\n' +
      '逻辑: ' + (h.psychology || '') + '\n' +
      '画面: ' + (h.visual_pairing || '')
    ).join('\n\n');
    suggestions.push({ lib: 'cta_end', reason: detail, checked: true, note: '' });
  }

  // 痛点库
  if ((em.pain_points || []).length > 0) {
    const detail = (em.pain_points || []).map(p =>
      '-- ' + (p.scene_name || '') + '（' + (p.scene_category || '') + '）\n' +
      '痛点: ' + (p.user_pain || '') + '\n' +
      '情绪: ' + (p.emotion_keywords || []).join('、') + '\n' +
      '切入: ' + (p.product_solution || '') + '\n' +
      '角度: ' + (p.content_angle || '')
    ).join('\n\n');
    suggestions.push({ lib: 'painpoint', reason: detail, checked: true, note: '' });
  }

  // 卖点画面库
  if ((em.selling_visuals || []).length > 0) {
    const nums = ['(1)','(2)','(3)','(4)','(5)','(6)','(7)','(8)','(9)','(10)'];
    const detail = (em.selling_visuals || []).map((s, i) =>
      (nums[i] || (i+1)) + ' 「' + (s.visual_type || '') + '」\n' +
      '拍摄: ' + (s.shooting_notes || '') + '\n' +
      '作用: ' + (s.purpose || '')
    ).join('\n\n');
    suggestions.push({ lib: 'sellingpt', reason: detail, checked: true, note: '' });
  }

  // 社会证明库
  if ((em.social_proof || []).length > 0) {
    const detail = (em.social_proof || []).map(s =>
      '-- [' + (s.proof_type || '') + '] ' + (s.material_name || '') + ' (' + (s.trust_strength || '') + ')\n' +
      '用法: ' + (s.usage_scenario || '')
    ).join('\n\n');
    suggestions.push({ lib: 'socialproof', reason: detail, checked: true, note: '' });
  }

  // 权益库 — 默认不勾选
  if ((em.benefits || []).length > 0) {
    const detail = (em.benefits || []).map(b =>
      '-- ' + (b.benefit_name || '') + '（' + (b.benefit_type || '') + '）\n' +
      '描述: ' + (b.description || '') + '\n' +
      '成本: ' + (b.cost_level || '')
    ).join('\n\n');
    suggestions.push({ lib: 'benefit', reason: detail, checked: false, note: '' });
  }

  // BGM — 默认不勾选
  if (em.bgm && em.bgm.mood) {
    suggestions.push({ lib: 'bgm', reason: '情绪类型: ' + em.bgm.mood + '\n风格: ' + (em.bgm.description || '') + '\n注意: 曲名和音乐人需手动填写，AI无法识别具体曲目', checked: false, note: '' });
  }

  AppState._saveSuggestions = suggestions;
  renderSavePanel(suggestions);
}

function renderSavePanel(suggestions) {
  const panel = document.getElementById('save-panel');
  const memo = AppState._analyzeMemo || '';
  const memoHtml = memo ? '<div style="background:var(--accentBg);border:1px solid rgba(58,176,158,0.2);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--accent2)">分析时的入库备注: ' + esc(memo) + '</div>' : '';

  // 竞品拆解库 — 分段换行显示
  const a = AppState.analysisData?.analysis || AppState.analysisData;
  const ce = a.competitor_entry || {};
  const autoSaveHtml = '<div style="background:var(--pinkBg);border:1px solid rgba(236,72,153,0.2);border-radius:8px;padding:14px 16px;margin-bottom:16px;font-size:13px;color:var(--pink);line-height:1.8">' +
    '<div style="font-weight:700;margin-bottom:8px">竞品爆款拆解库 -- 每次拆解自动入库</div>' +
    (ce.title ? '<div style="margin-bottom:6px"><span style="color:var(--text3)">标题:</span> ' + esc(ce.title) + '</div>' : '') +
    (ce.hook_script ? '<div style="margin-bottom:6px"><span style="color:var(--text3)">钩子:</span> ' + esc(ce.hook_script) + '</div>' : '') +
    (ce.reusable_points ? '<div><span style="color:var(--text3)">可复用:</span> ' + esc(ce.reusable_points) + '</div>' : '') +
  '</div>';

  // 每条入库理由改为可编辑textarea + 加号新增行
  let libRows = suggestions.map((s, i) => {
    const lib = SAVE_LIBRARIES[s.lib];
    if (!lib) return '';
    return '<div class="save-lib-row">' +
      '<input type="checkbox" class="save-lib-check" data-idx="' + i + '"' + (s.checked ? ' checked' : '') + ' onchange="saveToggleLib(' + i + ',this.checked)">' +
      '<div class="save-lib-info">' +
        '<div class="save-lib-name"><span class="bg-' + lib.color + '" style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;margin-right:6px">' + esc(lib.name) + '</span></div>' +
        '<textarea class="save-lib-textarea" data-idx="' + i + '" oninput="saveUpdateReason(' + i + ',this.value)" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--text);font-family:inherit;line-height:1.7;resize:vertical;min-height:60px">' + esc(s.reason) + '</textarea>' +
        '<button class="btn-sm" style="margin-top:4px;padding:3px 10px;font-size:11px" onclick="saveAddLine(' + i + ')">+ 新增一行</button>' +
      '</div>' +
    '</div>';
  }).join('');

  const existingLibs = suggestions.map(s => s.lib);
  const missingLibs = Object.keys(SAVE_LIBRARIES).filter(k => !existingLibs.includes(k));
  let addOptions = '<option value="">-- 选择要添加的库 --</option>';
  missingLibs.forEach(k => { const v = SAVE_LIBRARIES[k]; if (v) addOptions += '<option value="' + k + '">' + v.name + '</option>'; });

  const checkedCount = suggestions.filter(s => s.checked).length + 1;

  panel.innerHTML = '<div class="archive-panel">' +
    '<h3>入库确认</h3>' +
    memoHtml + autoSaveHtml +
    '<div style="font-size:13px;color:var(--text3);margin-bottom:12px">以下素材库由 AI 分析建议，可勾选/取消/添加/写理由:</div>' +
    '<div id="save-lib-list">' + libRows + '</div>' +
    (missingLibs.length > 0 ? '<div class="save-add-row"><select class="t4-select" style="width:auto;min-width:200px" id="save-add-select">' + addOptions + '</select><input type="text" placeholder="入库理由" id="save-add-reason" style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--text);font-family:inherit"><button class="btn-sm" style="padding:6px 14px" onclick="saveAddLib()">添加</button></div>' : '') +
    '<div class="archive-actions"><button class="btn-go" style="flex:1" id="btn-save-confirm" onclick="saveConfirm()">确认入库（' + checkedCount + ' 个库）</button><button class="btn-sec" onclick="savePanelClose()">取消</button></div>' +
    '<div id="save-status"></div></div>';

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveToggleLib(idx, checked) {
  if (AppState._saveSuggestions[idx]) {
    AppState._saveSuggestions[idx].checked = checked;
    const count = AppState._saveSuggestions.filter(s => s.checked).length + 1;
    const btn = document.getElementById('btn-save-confirm');
    if (btn) btn.textContent = '确认入库（' + count + ' 个库）';
  }
}
function saveUpdateReason(idx, value) {
  if (AppState._saveSuggestions[idx]) AppState._saveSuggestions[idx].reason = value;
}

function saveAddLine(idx) {
  const textarea = document.querySelector('.save-lib-textarea[data-idx="' + idx + '"]');
  if (textarea) {
    textarea.value += '\n';
    textarea.focus();
    textarea.selectionStart = textarea.value.length;
  }
}

function saveAddLib() {
  const sel = document.getElementById('save-add-select'), reason = document.getElementById('save-add-reason');
  const libKey = sel ? sel.value : '', reasonText = reason ? reason.value.trim() : '';
  if (!libKey) return;
  AppState._saveSuggestions.push({ lib: libKey, reason: reasonText || '手动添加', note: '', checked: true });
  renderSavePanel(AppState._saveSuggestions);
}

async function saveConfirm() {
  const selected = AppState._saveSuggestions.filter(s => s.checked);
  const btn = document.getElementById('btn-save-confirm'), status = document.getElementById('save-status');
  btn.disabled = true; btn.textContent = '写入中...';
  status.innerHTML = '<div style="color:var(--text3);padding:12px;text-align:center"><div class="spin" style="margin:0 auto 8px"></div>正在写入...</div>';
  try {
    const analysis = AppState.analysisData?.analysis || AppState.analysisData;
    const videoUrl = AppState.analysisData?.videoUrl || '';
    const filename = AppState.curFile ? AppState.curFile.name : '';
    const libs = [{ lib: 'competitor', note: AppState._analyzeMemo || '' }];
    selected.forEach(s => { libs.push({ lib: SAVE_LIBRARIES[s.lib]?.parent || s.lib, note: s.note || '', subtype: s.lib }); });
    const data = await API.saveToFeishu(analysis, '', videoUrl, filename, libs);
    const saved = data.results?.saved?.length || 0, errors = data.results?.errors || [];
    let html = '<div style="padding:12px;text-align:center">';
    if (saved > 0) html += '<div style="color:var(--green);font-weight:700;margin-bottom:8px">成功写入 ' + saved + ' 条记录</div>';
    if (errors.length > 0) html += '<div style="color:var(--red);font-size:13px">' + errors.map(e => e.table + ': ' + e.error).join('<br>') + '</div>';
    html += '</div>';
    status.innerHTML = html;
    btn.textContent = '入库完成';
    setTimeout(() => { btn.disabled = false; btn.textContent = '确认入库'; }, 3000);
  } catch (e) {
    status.innerHTML = '<div style="color:var(--red);padding:12px">' + esc(e.message) + '</div>';
    btn.disabled = false; btn.textContent = '确认入库';
  }
}

function savePanelClose() { document.getElementById('save-panel').style.display = 'none'; }

window.showSel = showSel; window.startAnalysis = startAnalysis; window.switchTab = switchTab;
window.saveToFeishu = saveToFeishu; window.saveToggleLib = saveToggleLib; window.saveUpdateReason = saveUpdateReason;
window.saveAddLine = saveAddLine; window.saveAddLib = saveAddLib; window.saveConfirm = saveConfirm; window.savePanelClose = savePanelClose;
window.resetAll = resetAll;
