/**
 * tab1-shots.js — 镜头截图 Tab
 */

function renderTab1(shots) {
  const tc = {};
  shots.forEach(s => {
    const t = s.shot_type || '其他';
    tc[t] = (tc[t] || 0) + 1;
  });

  let bar = '';
  let cards = '';
  shots.forEach((s, i) => {
    const cls = shotCls(s.shot_type);
    bar += '<div class="sb-seg bg-' + cls + '">' + esc(s.shot_type || '') + ' ' + s.time_start + '-' + s.time_end + 's</div>';

    const url = s.frame_url || '';
    const isFirst = s.product_visible && !shots.slice(0, i).some(x => x.product_visible);

    cards += '<div class="sc" onclick="' + (url ? "openLB('" + esc(url) + "')" : '') + '">' +
      '<div class="sc-img' + (isFirst ? ' fp-border' : '') + '">' +
        (url ? '<img src="' + esc(url) + '" alt="">' : '<div class="ph">🎬</div>') +
        '<span class="sn">#' + (s.shot_number || i + 1) + '</span>' +
        '<span class="st">' + (s.time_start ?? '') + 's</span>' +
        (isFirst ? '<span class="fpb">⭐ 产品首现</span>' : '') +
      '</div>' +
      '<div class="sc-tag"><span class="bg-' + cls + '">' + esc(s.shot_type || '镜头') + '</span></div>' +
    '</div>';
  });

  let stats = '';
  Object.entries(tc).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => {
    stats += '<div class="ss-item">' +
      '<div class="ssn">' + n + '</div>' +
      '<div class="ssl"><span class="bg-' + shotCls(t) + '">' + esc(t) + '</span></div>' +
    '</div>';
  });

  document.getElementById('t1').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div style="font-size:15px;font-weight:700">🎬 全部镜头（' + shots.length + '个分镜）</div>' +
      '<div style="font-size:12px;color:var(--text3)">点击镜头可放大查看 ⭐ 产品首现</div>' +
    '</div>' +
    '<div class="shot-bar">' + bar + '</div>' +
    '<div class="shot-scroll">' + cards + '</div>' +
    '<div class="shot-stats">' + stats + '</div>';
}

window.renderTab1 = renderTab1;
