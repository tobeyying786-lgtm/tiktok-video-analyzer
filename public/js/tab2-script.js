/**
 * tab2-script.js — 分镜脚本表格 Tab
 */

function renderTab2(shots) {
  let rows = '';
  shots.forEach((s, i) => {
    const url = s.frame_url || '';
    const cls = shotCls(s.shot_type);
    rows += '<tr>' +
      '<td style="font-weight:600">#' + (s.shot_number || i + 1) + '</td>' +
      '<td style="font-family:JetBrains Mono,monospace;font-size:12px;white-space:nowrap">' + s.time_start + '-' + s.time_end + 's</td>' +
      '<td><span class="type-tag bg-' + cls + '">' + esc(s.shot_type || '') + '</span></td>' +
      '<td style="max-width:300px;line-height:1.6">' + esc(s.scene_description || '') + '</td>' +
      '<td class="td-img">' + (url ? '<img src="' + esc(url) + '" onclick="openLB(\'' + esc(url) + '\')">' : '<div class="ph">🎬</div>') + '</td>' +
      '<td style="max-width:260px;font-size:12px;line-height:1.6">' +
        (s.voiceover ? '<strong>口播：</strong>' + esc(s.voiceover) + '<br>' : '') +
        (s.text_overlay ? '<strong>字幕：</strong>' + esc(s.text_overlay) : '') +
      '</td>' +
      '<td style="text-align:center">' + (s.product_visible ? '<span class="c-red" style="font-size:18px">✕</span>' : '') + '</td>' +
    '</tr>';
  });

  document.getElementById('t2').innerHTML =
    '<div class="sb-top">' +
      '<h3>分镜脚本表格</h3>' +
      '<button class="btn-copy" onclick="copyTable()">📋 复制表格</button>' +
    '</div>' +
    '<div style="overflow-x:auto">' +
      '<table class="sb-table" id="sb-table"><thead><tr>' +
        '<th>镜头</th><th>时间</th><th>类型</th><th>画面描述</th><th>镜头截图</th><th>文案/口播</th><th>产品</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '</div>';
}

function copyTable() {
  const t = document.getElementById('sb-table');
  if (!t) return;
  const r = document.createRange();
  r.selectNode(t);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(r);
  document.execCommand('copy');
  window.getSelection().removeAllRanges();
  const b = document.querySelector('.btn-copy');
  b.textContent = '✓ 已复制';
  setTimeout(() => b.textContent = '📋 复制表格', 2000);
}

window.renderTab2 = renderTab2;
window.copyTable = copyTable;
