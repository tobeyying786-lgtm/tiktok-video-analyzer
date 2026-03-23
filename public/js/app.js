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

// ============== 飞书入库 ==============

async function saveToFeishu() {
  if (!AppState.analysisData) return showErr('请先完成视频拆解');
  const btn = document.getElementById('btn-feishu');
  btn.disabled = true;
  btn.textContent = '📝 写入中…';
  hideErr();

  const videoCode = prompt('请输入视频编码（可留空）：', '') || '';

  try {
    const analysis = AppState.analysisData?.analysis || AppState.analysisData;
    const videoUrl = AppState.analysisData?.videoUrl || '';
    const filename = AppState.curFile ? AppState.curFile.name : '';
    const data = await API.saveToFeishu(analysis, videoCode, videoUrl, filename);
    const saved = data.results?.saved?.length || 0;
    const errors = data.results?.errors?.length || 0;
    btn.textContent = '✅ 已写入 ' + saved + ' 条';
    if (errors > 0)
      showErr('部分写入失败：' + data.results.errors.map(e => e.table + ': ' + e.error).join('; '));
    setTimeout(() => { btn.textContent = '📝 写入飞书多维表格'; btn.disabled = false; }, 3000);
  } catch (e) {
    showErr('飞书写入失败: ' + e.message);
    btn.textContent = '📝 写入飞书多维表格';
    btn.disabled = false;
  }
}

// ============== 重置 ==============

function resetAll() {
  AppState.reset();
  document.getElementById('page-upload').style.display = '';
  document.getElementById('page-result').style.display = 'none';
  document.getElementById('btn-reset').style.display = 'none';
  document.getElementById('hdr-sub').textContent = 'AI驱动的视频结构分析';
  hideErr(); hideProg();

  const uz = document.getElementById('upzone');
  uz.innerHTML = '<span class="fb" onclick="event.stopPropagation();document.getElementById(\'fileIn\').click()">未选择任何文件</span>' +
    '<div class="up-arrow"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke="var(--text3)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
    '<div class="up-text">拖拽视频到这里，或点击上传</div>' +
    '<div class="up-hint">支持 MP4, MOV, AVI, WebM 格式，最大 200MB</div>' +
    '<input type="file" id="fileIn" accept="video/*" style="display:none">';
  document.getElementById('fileIn').addEventListener('change', () => {
    if (document.getElementById('fileIn').files.length) {
      AppState.curFile = document.getElementById('fileIn').files[0];
      showSel();
    }
  });
}

// 导出到全局
window.showSel = showSel;
window.startAnalysis = startAnalysis;
window.switchTab = switchTab;
window.saveToFeishu = saveToFeishu;
window.resetAll = resetAll;
