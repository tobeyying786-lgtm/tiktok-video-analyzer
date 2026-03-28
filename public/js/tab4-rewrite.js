/**
 * tab4-rewrite.js — V3.7.0
 * Tab 4 仿写分析：纵向时间轴(停病药信买) + 横向左右对比 + 三维度(场景/画面/心理) + 标签系统
 */

const TAG_COLORS = { reused: '#1D9E75', adjusted: '#BA7517', new_addition: '#378ADD' };
const TAG_LABELS = { reused: '复用', adjusted: '调整', new_addition: '新增' };
const ELEM_COLORS = { '停': '#E24B4A', '病': '#BA7517', '药': '#1D9E75', '信': '#378ADD', '买': '#D4537E' };

function renderTab4Rewrite() {
  const panel = document.getElementById('t4');
  const a = AppState.analysisData?.analysis || AppState.analysisData;

  if (!a || !a.script_structure) {
    panel.innerHTML = '<div class="t4-no-data"><div class="nd-icon">--</div><div class="nd-text">请先在「镜头截图」Tab 完成视频拆解</div></div>';
    return;
  }

  const profile = AppState.productProfile;
  const rw = AppState.lastRewrite;

  // 顶部：用户输入区
  const inputHtml = '<div class="t4-card" style="margin-bottom:16px">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end">' +
      '<div>' +
        '<div style="font-size:13px;color:var(--text3);margin-bottom:4px">本次创作方向</div>' +
        '<input type="text" id="t4-direction" placeholder="如：针对健身人群的便携榨汁场景" value="' + esc(AppState._rwDirection || '') + '" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:14px;color:var(--text);font-family:inherit">' +
      '</div>' +
      '<div>' +
        '<div style="font-size:13px;color:var(--text3);margin-bottom:4px">核心要突出的功能</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;min-height:36px">' +
          t4RenderFeatureTags() +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:12px;display:flex;gap:8px">' +
      (profile ? '<span style="font-size:12px;color:var(--green);padding:4px 8px;background:var(--accentBg);border-radius:6px">已载入产品档案: ' + esc(profile.product_name || '') + '</span>' : '<span style="font-size:12px;color:var(--text3);padding:4px 8px;background:var(--bg3);border-radius:6px">未载入产品档案，请先完成 Tab 3</span>') +
      '<button class="btn-go" onclick="t4DoRewrite()" style="margin-left:auto;padding:8px 24px" id="btn-t4-rewrite">生成仿写分析</button>' +
    '</div>' +
  '</div>';

  // 主体：仿写结果
  let resultHtml = '';
  if (rw && rw.blocks && rw.blocks.length > 0) {
    resultHtml = t4RenderTimelineBlocks(rw, a);
  } else if (AppState._rwLoading) {
    resultHtml = '<div style="text-align:center;padding:40px;color:var(--text3)"><div class="spin" style="margin:0 auto 10px"></div>Claude 正在生成仿写分析...</div>';
  }

  // 底部
  const bottomHtml = (rw && rw.blocks && rw.blocks.length > 0) ?
    '<div style="display:flex;gap:12px;margin-top:16px">' +
      '<button class="btn-go" onclick="t4DoExpand()" id="btn-t4-expand" style="flex:1">生成分镜脚本 → Tab 5</button>' +
    '</div>' +
    '<div id="t4-expand-status"></div>' +
    // 图例
    '<div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap">' +
      '<span style="display:flex;align-items:center;gap:4px"><span style="background:#1D9E75;color:#fff;font-size:11px;padding:2px 8px;border-radius:4px">复用</span><span style="font-size:12px;color:var(--text3)">核心策略不要轻易改</span></span>' +
      '<span style="display:flex;align-items:center;gap:4px"><span style="background:#BA7517;color:#fff;font-size:11px;padding:2px 8px;border-radius:4px">调整</span><span style="font-size:12px;color:var(--text3)">细节适配品类</span></span>' +
      '<span style="display:flex;align-items:center;gap:4px"><span style="background:#378ADD;color:#fff;font-size:11px;padding:2px 8px;border-radius:4px">新增</span><span style="font-size:12px;color:var(--text3)">原视频没有的新元素</span></span>' +
    '</div>'
    : '';

  panel.innerHTML = inputHtml + '<div id="t4-result">' + resultHtml + '</div>' + bottomHtml;
}

// ============== 功能标签 ==============

function t4RenderFeatureTags() {
  const profile = AppState.productProfile;
  if (!profile || !profile.core_selling_points) return '<span style="font-size:12px;color:var(--text3)">先在 Tab 3 生成产品档案</span>';
  const selected = AppState._rwSelectedFeatures || [];
  return profile.core_selling_points.map((sp, i) => {
    const isSelected = selected.includes(sp);
    return '<span onclick="t4ToggleFeature(\'' + esc(sp).replace(/'/g, "\\'") + '\')" style="cursor:pointer;font-size:12px;padding:3px 10px;border-radius:6px;' +
      (isSelected ? 'background:var(--accentBg);color:var(--accent2);border:1px solid var(--accent)' : 'background:var(--bg3);color:var(--text3);border:1px solid var(--border)') +
      '">' + esc(sp) + '</span>';
  }).join('');
}

function t4ToggleFeature(feature) {
  if (!AppState._rwSelectedFeatures) AppState._rwSelectedFeatures = [];
  const idx = AppState._rwSelectedFeatures.indexOf(feature);
  if (idx >= 0) AppState._rwSelectedFeatures.splice(idx, 1);
  else AppState._rwSelectedFeatures.push(feature);
  renderTab4Rewrite();
}

// ============== 时间轴渲染 ==============

function t4RenderTimelineBlocks(rw, analysis) {
  const blocks = rw.blocks || [];

  return '<div style="position:relative;padding-left:36px">' +
    '<div style="position:absolute;left:16px;top:0;bottom:0;width:2px;background:var(--border)"></div>' +
    blocks.map((b, i) => {
      const elemColor = ELEM_COLORS[b.element] || '#888';
      const orig = b.original || {};
      const rewrite = b.rewrite || {};
      const tags = b.tags || {};

      // 左侧原视频卡片（只读）
      const origCard = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 16px">' +
        '<div style="font-size:12px;color:var(--text3);margin-bottom:10px;font-weight:700">原视频</div>' +
        t4DimensionRow('场景', orig.scene || '', null, true) +
        t4DimensionRow('画面', orig.visual || '', null, true) +
        t4DimensionRow('心理', orig.psychology || '', null, true) +
      '</div>';

      // 右侧仿写卡片（可编辑）
      const rwCard = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 16px">' +
        '<div style="font-size:12px;color:var(--text3);margin-bottom:10px;font-weight:700">仿写</div>' +
        t4DimensionRow('场景', rewrite.scene || '', tags.scene, false, i, 'scene') +
        t4DimensionRow('画面', rewrite.visual || '', tags.visual, false, i, 'visual') +
        t4DimensionRow('心理', rewrite.psychology || '', tags.psychology, false, i, 'psychology') +
      '</div>';

      return '<div style="margin-bottom:24px;position:relative">' +
        '<div style="position:absolute;left:-28px;width:24px;height:24px;border-radius:50%;background:' + elemColor + ';display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700">' + esc(b.element) + '</div>' +
        '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">原视频镜头 ' + (b.original_shots || []).join(', ') + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + origCard + rwCard + '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function t4DimensionRow(label, value, tag, readOnly, blockIdx, dimKey) {
  const tagHtml = tag ? '<span onclick="t4CycleTag(' + blockIdx + ',\'' + dimKey + '\')" style="cursor:pointer;background:' + (TAG_COLORS[tag] || '#888') + ';color:#fff;font-size:10px;padding:1px 6px;border-radius:4px">' + (TAG_LABELS[tag] || tag) + '</span>' : '';

  if (readOnly) {
    return '<div style="margin-bottom:8px">' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:2px">' + esc(label) + '</div>' +
      '<div style="font-size:13px;color:var(--text);line-height:1.6">' + esc(value) + '</div>' +
    '</div>';
  }

  return '<div style="margin-bottom:8px">' +
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
      '<div style="font-size:11px;color:var(--text3)">' + esc(label) + '</div>' +
      tagHtml +
    '</div>' +
    '<textarea rows="2" data-block="' + blockIdx + '" data-dim="' + dimKey + '" oninput="t4UpdateDim(this)" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:13px;color:var(--text);font-family:inherit;resize:vertical;line-height:1.6">' + esc(value) + '</textarea>' +
  '</div>';
}

// ============== 编辑操作 ==============

function t4UpdateDim(el) {
  const blockIdx = parseInt(el.dataset.block);
  const dimKey = el.dataset.dim;
  const rw = AppState.lastRewrite;
  if (rw && rw.blocks && rw.blocks[blockIdx]) {
    if (!rw.blocks[blockIdx].rewrite) rw.blocks[blockIdx].rewrite = {};
    rw.blocks[blockIdx].rewrite[dimKey] = el.value;
  }
}

function t4CycleTag(blockIdx, dimKey) {
  const rw = AppState.lastRewrite;
  if (!rw || !rw.blocks || !rw.blocks[blockIdx]) return;
  if (!rw.blocks[blockIdx].tags) rw.blocks[blockIdx].tags = {};
  const order = ['reused', 'adjusted', 'new_addition'];
  const current = rw.blocks[blockIdx].tags[dimKey] || 'reused';
  const nextIdx = (order.indexOf(current) + 1) % order.length;
  rw.blocks[blockIdx].tags[dimKey] = order[nextIdx];
  renderTab4Rewrite();
}

// ============== 仿写请求 ==============

async function t4DoRewrite() {
  const a = AppState.analysisData?.analysis || AppState.analysisData;
  if (!a) return alert('请先完成视频拆解');

  const direction = (document.getElementById('t4-direction')?.value || '').trim();
  AppState._rwDirection = direction;

  const profile = AppState.productProfile;
  const productName = profile?.product_name || AppState.productName || '';
  const category = profile?.category || AppState.productCategory || '';
  const sellingPoints = (AppState._rwSelectedFeatures || []).join('，') || AppState.productSellingPoints || '';

  if (!productName) return alert('请先在 Tab 3 填写产品信息');

  const btn = document.getElementById('btn-t4-rewrite');
  btn.disabled = true; btn.textContent = '仿写中...';
  AppState._rwLoading = true;
  renderTab4Rewrite();

  try {
    const rw = await API.rewrite(a, category, productName, sellingPoints, profile, direction);
    AppState.lastRewrite = rw;
    AppState._rewriteBlocks = rw;
    AppState.t4Initialized = false;
    AppState._rwLoading = false;
    renderTab4Rewrite();
  } catch (e) {
    AppState._rwLoading = false;
    document.getElementById('t4-result').innerHTML = '<div style="color:var(--red);padding:12px">' + esc(e.message) + '</div>';
  } finally {
    btn.disabled = false; btn.textContent = '生成仿写分析';
  }
}

// ============== 分镜扩展 ==============

async function t4DoExpand() {
  const rw = AppState._rewriteBlocks || AppState.lastRewrite;
  if (!rw || !rw.blocks) return alert('请先完成仿写分析');

  const a = AppState.analysisData?.analysis || AppState.analysisData;
  const shots = a?.shots || [];
  const bd = a?.script_structure?.structure_breakdown || [];
  const profile = AppState.productProfile;
  const productName = profile?.product_name || AppState.productName || '';
  const category = profile?.category || AppState.productCategory || '';

  // 把三维度合并为 rewrite_direction 给 expand 用
  const blocksForExpand = rw.blocks.map(b => ({
    element: b.element,
    original_shots: b.original_shots,
    rewrite_direction: [
      '场景: ' + (b.rewrite?.scene || ''),
      '画面: ' + (b.rewrite?.visual || ''),
      '心理: ' + (b.rewrite?.psychology || '')
    ].join('\n')
  }));

  const btn = document.getElementById('btn-t4-expand');
  const status = document.getElementById('t4-expand-status');
  btn.disabled = true; btn.textContent = '生成中...';
  status.innerHTML = '<div style="color:var(--text3);padding:12px;text-align:center"><div class="spin" style="margin:0 auto 8px"></div>Claude 正在扩展为分镜脚本...</div>';

  try {
    bd.forEach(b => { (b.shots_included || []).forEach(sn => { const shot = shots.find(x => x.shot_number === sn); if (shot) shot._role = b.element; }); });
    let result = await API.expand(shots, bd, blocksForExpand, productName, category);

    // JSON 前端补救
    if (result.raw_response) {
      let parsed = null;
      const raw = result.raw_response;
      try { const c = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s !== -1 && e > s) { const p = JSON.parse(c.substring(s, e + 1)); if (p.shots) parsed = p; } } catch (e) {}
      if (!parsed) { try { const s = raw.indexOf('{"'), e = raw.lastIndexOf('}'); if (s !== -1 && e > s) { const p = JSON.parse(raw.substring(s, e + 1)); if (p.shots) parsed = p; } } catch (e) {} }
      if (!parsed) { try { const c = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s !== -1 && e > s) { let j = c.substring(s, e + 1).replace(/,\s*([}\]])/g, '$1'); const p = JSON.parse(j); if (p.shots) parsed = p; } } catch (e) {} }
      if (parsed) { result = parsed; }
      else { status.innerHTML = '<div style="color:var(--red);padding:12px">分镜脚本解析失败，请重试</div>'; btn.disabled = false; btn.textContent = '生成分镜脚本 → Tab 5'; return; }
    }

    const expandData = {
      rewritten_structure: (result.shots || []).map(s => ({ ...s, element: s.role || '无', camera: s.camera || { shot_size: '', lighting: [], movement: '', composition: '', style: '' } })),
      framework: rw.framework || '', formula: rw.formula || ''
    };
    AppState.lastRewrite = expandData;
    AppState.t4Initialized = false;
    status.innerHTML = '<div style="color:var(--green);padding:12px;text-align:center">已生成 ' + (result.shots || []).length + ' 个镜头，切换到 Tab 5 查看</div>';
    btn.disabled = false; btn.textContent = '重新生成分镜脚本';
    const t5Tab = document.querySelector('[data-tab="t5"]');
    if (t5Tab) { t5Tab.style.background = 'var(--accentBg)'; setTimeout(() => t5Tab.style.background = '', 3000); }
  } catch (e) {
    status.innerHTML = '<div style="color:var(--red);padding:12px">' + esc(e.message) + '</div>';
    btn.disabled = false; btn.textContent = '生成分镜脚本 → Tab 5';
  }
}

// ============== 导出 ==============

window.renderTab4Rewrite = renderTab4Rewrite;
window.t4ToggleFeature = t4ToggleFeature;
window.t4UpdateDim = t4UpdateDim;
window.t4CycleTag = t4CycleTag;
window.t4DoRewrite = t4DoRewrite;
window.t4DoExpand = t4DoExpand;
