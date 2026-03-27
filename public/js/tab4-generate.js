/**
 * tab4-generate.js — V3.6.0
 * 新增：关键帧生成（左右表格式布局），保留视频生成
 * 
 * UI 布局:
 * [全局设置栏]
 * [左右表格: 左边镜头描述可编辑 | 右边关键帧预览+生成按钮]
 * [底部操作栏]
 * [视频生成配置面板 + BGM]
 */

// ============== 布局模板配置 ==============

const LAYOUT_TEMPLATES = {
  tiktok_916:   { id: 'tiktok_916', name: 'TikTok 9:16', platform: 'tiktok', ratio: '9:16' },
  ig_reels_916: { id: 'ig_reels_916', name: 'IG Reels 9:16', platform: 'instagram', ratio: '9:16' },
  ig_post_45:   { id: 'ig_post_45', name: 'IG Post 4:5', platform: 'instagram', ratio: '4:5' },
  ig_post_11:   { id: 'ig_post_11', name: 'IG Post 1:1', platform: 'instagram', ratio: '1:1' },
  douyin_916:   { id: 'douyin_916', name: '抖音 9:16 口播', platform: 'douyin', ratio: '9:16' },
  douyin_916p:  { id: 'douyin_916p', name: '抖音 9:16 产品', platform: 'douyin', ratio: '9:16' },
  xhs_34:       { id: 'xhs_34', name: '小红书 3:4', platform: 'xiaohongshu', ratio: '3:4' },
};

const PLATFORM_TEMPLATES = {
  tiktok: ['tiktok_916'], instagram: ['ig_reels_916', 'ig_post_45', 'ig_post_11'],
  douyin: ['douyin_916', 'douyin_916p'], xiaohongshu: ['xhs_34'],
};

const ROLE_OPTIONS = ['停', '病', '药', '信', '买', '无'];
const SHOT_SIZE_OPTIONS = ['', '微距特写', '特写', '中景', '全景', '俯拍平铺'];
const LIGHTING_OPTIONS = ['自然光', '暖光', '冷光', '逆光轮廓光', '棚拍均匀光'];
const MOVEMENT_OPTIONS = ['', '固定', '推进', '后拉', '跟拍', '环绕'];
const STYLE_OPTIONS = ['', '写实场景', '产品广告', '科普图解', '情绪氛围', '真实Vlog'];
const COMPOSITION_OPTIONS = ['', '居中', '三分法左', '三分法右', '上方留白', '下方留白'];

// 关键帧状态
let t4KeyframeData = {}; // { shotIndex: { imageUrl, model, status } }
let t4ImageModels = null;

// ============== 渲染入口 ==============

function renderTab4() {
  const panel = document.getElementById('t4');
  const rw = AppState.lastRewrite;

  if (!rw || !rw.rewritten_structure || rw.rewritten_structure.length === 0) {
    panel.innerHTML = '<div class="t4-no-data"><div class="nd-icon">--</div>' +
      '<div class="nd-text">请先在「脚本结构分析」Tab 完成跨品类改编</div>' +
      '<div class="nd-hint">改编完成后回到此页，即可编辑脚本并生成关键帧和视频</div></div>';
    return;
  }

  if (!AppState.t4Initialized || !AppState.t4RewriteData) {
    AppState.initT4FromRewrite(rw);
  }

  t4RenderFull();
}

// ============== 全局设置栏 ==============

function t4RenderGlobalSettings() {
  const s = AppState.t4Settings;
  const imgPreview = s.productImage
    ? '<div class="t4-img-preview"><img src="' + s.productImage + '"><span onclick="t4ClearProductImage()" class="t4-img-x">x</span></div>'
    : '';

  const templates = PLATFORM_TEMPLATES[s.platform] || ['tiktok_916'];
  const templateOpts = templates.map(tid => {
    const t = LAYOUT_TEMPLATES[tid];
    return '<option value="' + tid + '"' + (s.layoutTemplate === tid ? ' selected' : '') + '>' + t.name + '</option>';
  }).join('');

  return '<div class="t4-global-bar">' +
    '<div class="t4-global-row">' +
      '<div class="t4-global-item"><label>产品白底图</label><div class="t4-img-upload">' + imgPreview +
        '<label class="btn-sm" style="padding:6px 12px;cursor:pointer">' + (s.productImage ? '替换' : '上传图片') +
        '<input type="file" accept="image/*" style="display:none" onchange="t4UploadProductImage(this)"></label></div></div>' +
      '<div class="t4-global-item"><label>发布平台</label><select class="t4-select t4-sel-sm" onchange="t4ChangePlatform(this.value)">' +
        '<option value="tiktok"' + (s.platform === 'tiktok' ? ' selected' : '') + '>TikTok</option>' +
        '<option value="instagram"' + (s.platform === 'instagram' ? ' selected' : '') + '>Instagram</option>' +
        '<option value="douyin"' + (s.platform === 'douyin' ? ' selected' : '') + '>抖音</option>' +
        '<option value="xiaohongshu"' + (s.platform === 'xiaohongshu' ? ' selected' : '') + '>小红书</option>' +
      '</select></div>' +
      '<div class="t4-global-item"><label>布局模板</label><select class="t4-select t4-sel-sm" id="t4-layout-select" onchange="t4ChangeLayout(this.value)">' + templateOpts + '</select></div>' +
      '<div class="t4-global-item"><label>目标语言</label><select class="t4-select t4-sel-sm" onchange="t4ChangeLanguage(this.value)">' +
        '<option value="EN"' + (s.language === 'EN' ? ' selected' : '') + '>英语</option>' +
        '<option value="CN"' + (s.language === 'CN' ? ' selected' : '') + '>中文</option>' +
        '<option value="ES"' + (s.language === 'ES' ? ' selected' : '') + '>西班牙语</option>' +
      '</select></div>' +
    '</div>' +
  '</div>';
}

function t4UploadProductImage(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { AppState.t4Settings.productImage = e.target.result; AppState.t4Settings.productImageName = file.name; t4RenderFull(); };
  reader.readAsDataURL(file);
}
function t4ClearProductImage() { AppState.t4Settings.productImage = null; AppState.t4Settings.productImageName = null; t4RenderFull(); }
function t4ChangePlatform(val) { AppState.t4Settings.platform = val; const t = PLATFORM_TEMPLATES[val] || ['tiktok_916']; AppState.t4Settings.layoutTemplate = t[0]; t4RenderFull(); }
function t4ChangeLayout(val) { AppState.t4Settings.layoutTemplate = val; }
function t4ChangeLanguage(val) { AppState.t4Settings.language = val; }

// ============== 左右表格式布局（核心新UI） ==============

function t4RenderShotTable() {
  const shots = AppState.t4RewriteData.rewritten_structure;
  let rows = '';

  shots.forEach((item, i) => {
    const roleCls = elemCls(item.role || item.element);
    const roleOpts = ROLE_OPTIONS.map(r => '<option value="' + r + '"' + ((item.role || item.element) === r ? ' selected' : '') + '>' + r + '</option>').join('');
    const kf = t4KeyframeData[i] || {};
    const kfStatus = kf.status || 'none'; // none / loading / done / error

    // 左侧：镜头描述
    const leftCell = '<div style="padding:12px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span style="background:var(--accentBg);color:var(--accent2);padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700">#' + (i + 1) + '</span>' +
        '<select class="t4-role-sel bg-' + roleCls + '" data-idx="' + i + '" onchange="t4UpdateRole(this)">' + roleOpts + '</select>' +
        '<span style="font-size:11px;color:var(--text3)">' + esc(item.time_ref || '') + '</span>' +
        '<span style="margin-left:auto;font-size:11px;color:var(--text3)"><button class="btn-sm" onclick="t4RemoveShot(' + i + ')" style="padding:2px 8px">删除</button></span>' +
      '</div>' +
      '<div style="margin-bottom:6px"><label style="font-size:11px;color:var(--text3);font-weight:600">画面描述</label>' +
        '<textarea rows="2" data-idx="' + i + '" data-field="scene_description_cn" oninput="t4UpdateShot(this)" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:13px;color:var(--text);font-family:inherit;resize:vertical">' + esc(item.scene_description_cn || '') + '</textarea></div>' +
      '<div style="margin-bottom:6px"><label style="font-size:11px;color:var(--text3);font-weight:600">口播文案</label>' +
        '<textarea rows="1" data-idx="' + i + '" data-field="voiceover_cn" oninput="t4UpdateShot(this)" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:13px;color:var(--text);font-family:inherit;resize:vertical">' + esc(item.voiceover_cn || '') + '</textarea></div>' +
      '<div style="margin-bottom:6px"><label style="font-size:11px;color:var(--text3);font-weight:600">拍摄建议</label>' +
        '<textarea rows="1" data-idx="' + i + '" data-field="shooting_notes" oninput="t4UpdateShot(this)" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:12px;color:var(--text2);font-family:inherit;resize:vertical">' + esc(item.shooting_notes || '') + '</textarea></div>' +
    '</div>';

    // 右侧：关键帧预览
    let rightContent = '';
    if (kfStatus === 'loading') {
      rightContent = '<div style="text-align:center;padding:30px 10px"><div class="spin" style="margin:0 auto 8px"></div><div style="font-size:12px;color:var(--text3)">生成中...</div></div>';
    } else if (kfStatus === 'done' && kf.imageUrl) {
      rightContent = '<div style="text-align:center;padding:8px">' +
        '<img src="' + kf.imageUrl + '" style="max-width:100%;max-height:200px;border-radius:8px;cursor:pointer" onclick="openLB(\'' + kf.imageUrl.replace(/'/g, "\\'") + '\')">' +
        '<div style="font-size:11px;color:var(--text3);margin-top:4px">' + esc(kf.model || '') + '</div>' +
        '<div style="display:flex;gap:6px;justify-content:center;margin-top:6px">' +
          '<button class="btn-sm" style="padding:3px 10px;font-size:11px" onclick="t4GenOneKeyframe(' + i + ')">重新生成</button>' +
          '<label class="btn-sm" style="padding:3px 10px;font-size:11px;cursor:pointer">上传参考图<input type="file" accept="image/*" style="display:none" onchange="t4UploadRef(' + i + ',this)"></label>' +
        '</div>' +
      '</div>';
    } else if (kfStatus === 'error') {
      rightContent = '<div style="text-align:center;padding:20px 10px">' +
        '<div style="font-size:13px;color:var(--red);margin-bottom:8px">' + esc(kf.error || '生成失败') + '</div>' +
        '<button class="btn-sm" style="padding:4px 12px" onclick="t4GenOneKeyframe(' + i + ')">重试</button>' +
      '</div>';
    } else {
      // 如果有原视频截帧，显示为默认
      const origFrame = item._original_frame || '';
      rightContent = '<div style="text-align:center;padding:12px 10px">' +
        (origFrame ? '<img src="' + origFrame + '" style="max-width:100%;max-height:160px;border-radius:8px;opacity:0.5;margin-bottom:6px"><div style="font-size:11px;color:var(--text3);margin-bottom:6px">原视频截帧</div>' : '<div style="width:120px;height:160px;background:var(--bg);border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;color:var(--text3);font-size:12px">待生成</div>') +
        '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn-sm" style="padding:4px 12px;font-size:12px" onclick="t4GenOneKeyframe(' + i + ')">生成关键帧</button>' +
          '<label class="btn-sm" style="padding:4px 12px;font-size:12px;cursor:pointer">上传参考图<input type="file" accept="image/*" style="display:none" onchange="t4UploadRef(' + i + ',this)"></label>' +
        '</div>' +
      '</div>';
    }

    const rightCell = '<div style="padding:8px;min-width:200px">' + rightContent + '</div>';

    rows += '<tr style="border-bottom:1px solid var(--border);vertical-align:top">' +
      '<td style="width:60%">' + leftCell + '</td>' +
      '<td style="width:40%;border-left:1px solid var(--border)">' + rightCell + '</td>' +
    '</tr>';
  });

  return '<table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:var(--r);overflow:hidden">' +
    '<thead><tr style="background:var(--bg3)">' +
      '<th style="padding:10px 12px;text-align:left;font-size:13px;font-weight:700;color:var(--text2)">镜头描述 (' + shots.length + ' 个)</th>' +
      '<th style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;color:var(--text2);border-left:1px solid var(--border)">关键帧预览</th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
  '</table>';
}

// ============== 关键帧生成控制栏 ==============

function t4RenderKeyframeControls() {
  const ASPECT_OPTIONS = ['9:16', '16:9', '4:3', '3:4', '4:5', '1:1', '2:3', '3:2', '5:4', '21:9'];
  const curAspect = AppState.t4KfAspectRatio || '9:16';
  const curSubtitle = AppState.t4KfSubtitle !== false; // 默认开启
  const aspectOpts = ASPECT_OPTIONS.map(a => '<option value="' + a + '"' + (a === curAspect ? ' selected' : '') + '>' + a + '</option>').join('');

  return '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
    '<span style="font-size:14px;font-weight:700;color:var(--text)">关键帧生成</span>' +
    '<select class="t4-sel-sm" id="t4-img-model" style="min-width:160px"><option value="">加载中...</option></select>' +
    '<select class="t4-sel-sm" id="t4-kf-aspect" onchange="t4ChangeKfAspect(this.value)" style="min-width:80px">' + aspectOpts + '</select>' +
    '<label style="font-size:13px;color:var(--text2);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="t4-kf-subtitle"' + (curSubtitle ? ' checked' : '') + ' onchange="t4ToggleKfSubtitle(this.checked)"> 带字幕</label>' +
    '<button class="btn-sm" style="padding:6px 16px;font-size:13px;background:var(--accentBg);border-color:var(--accent);color:var(--accent2)" onclick="t4GenAllKeyframes()">全部生成</button>' +
    '<span style="font-size:12px;color:var(--text3)" id="t4-kf-status"></span>' +
  '</div>';
}

// ============== 主渲染 ==============

function t4RenderFull() {
  const panel = document.getElementById('t4');
  const shots = AppState.t4RewriteData.rewritten_structure;

  t4MergeHookCta();

  const globalHtml = t4RenderGlobalSettings();
  const kfControls = t4RenderKeyframeControls();
  const shotTable = t4RenderShotTable();

  panel.innerHTML =
    '<div class="t4-title" style="font-size:17px;font-weight:700;margin-bottom:16px">脚本编辑器 + 关键帧生成 <span style="font-size:12px;color:var(--text3);font-weight:400">' + shots.length + ' 个镜头</span></div>' +
    globalHtml +
    kfControls +
    '<div style="overflow-x:auto;margin-bottom:16px">' + shotTable + '</div>' +
    // 底部操作栏
    '<div class="t4-bottom-bar">' +
      '<button class="btn-sm" style="padding:8px 16px" onclick="t4AddShot()">+ 添加镜头</button>' +
      '<button class="btn-sm" style="padding:8px 16px" onclick="t4ConfirmScript()">确认脚本</button>' +
      '<button class="btn-sm" style="padding:8px 16px" onclick="t4TogglePrompt()">预览 Prompt</button>' +
    '</div>' +
    '<div class="t4-prompt-preview" id="t4-prompt-preview"></div>' +
    // 视频生成面板（折叠）
    '<details style="margin-top:20px"><summary style="font-size:15px;font-weight:700;cursor:pointer;color:var(--text2);padding:12px 0">视频生成设置</summary>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px">' +
        '<div class="t4-panel">' +
          '<h3 style="font-size:15px;font-weight:700;margin-bottom:14px">视频生成配置</h3>' +
          '<div style="margin-bottom:14px"><div style="font-size:13px;color:var(--text3);margin-bottom:4px">生成模式</div>' +
            '<select class="t4-select" id="t4-gen-mode" onchange="t4UpdateCost()"><option value="single">整条生成</option><option value="pershot">逐镜头生成+拼接</option></select></div>' +
          '<div style="margin-bottom:14px"><div style="font-size:13px;color:var(--text3);margin-bottom:4px">生成平台</div>' +
            '<select class="t4-select" id="t4-platform" onchange="t4PlatformChange()"><option value="">加载中...</option></select></div>' +
          '<div style="margin-bottom:14px"><div style="font-size:13px;color:var(--text3);margin-bottom:4px">模型选择</div>' +
            '<select class="t4-select" id="t4-model" onchange="t4UpdateCost()"><option value="">先选平台</option></select></div>' +
          '<div style="margin-bottom:14px"><div style="font-size:13px;color:var(--text3);margin-bottom:4px">画面比例</div>' +
            '<div class="t4-radio"><label><input type="radio" name="t4ar" value="9:16" checked> 9:16</label><label><input type="radio" name="t4ar" value="16:9"> 16:9</label><label><input type="radio" name="t4ar" value="3:4"> 3:4</label><label><input type="radio" name="t4ar" value="1:1"> 1:1</label></div></div>' +
          '<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px">' +
            '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">费用预估</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--text3)">镜头数</span><span id="t4-cost-shots" style="font-weight:600">' + shots.length + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--text3)">生成次数</span><span id="t4-cost-count" style="font-weight:600">1</span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--text3)">预估费用</span><span id="t4-cost-credits" style="color:var(--orange);font-weight:600">~60 credits</span></div>' +
          '</div>' +
          '<button class="btn-gen" id="btn-gen" onclick="t4Generate()" disabled>生成视频</button>' +
          '<div class="gen-progress" id="gen-progress"><div class="gp-bar"><div class="gp-fill" id="gp-fill"></div></div><div class="gp-text" id="gp-text">准备中...</div></div>' +
          '<div class="gen-result" id="gen-result"><video id="gen-video" controls></video><div class="gr-actions"><a id="gen-download" class="btn-sm" style="padding:8px 16px;text-decoration:none" download>下载</a><button class="btn-sm" style="padding:8px 16px" onclick="t4Generate()">重新生成</button></div></div>' +
        '</div>' +
        '<div class="t4-panel"><h3 style="font-size:15px;font-weight:700;margin-bottom:14px">BGM 推荐</h3><div class="bgm-list" id="t4-bgm-list"><div style="text-align:center;padding:20px;color:var(--text3);font-size:13px"><div class="spin" style="margin:0 auto 8px"></div>加载 BGM 库...</div></div></div>' +
      '</div>' +
    '</details>';

  t4LoadPlatforms();
  t4LoadBgm();
  t4LoadImageModels();
}

// ============== 关键帧生成逻辑 ==============

async function t4LoadImageModels() {
  try {
    const models = await API.getImageGenModels();
    t4ImageModels = models;
    const sel = document.getElementById('t4-img-model');
    if (!sel) return;
    sel.innerHTML = models.map(m =>
      '<option value="' + m.id + '"' + (!m.available ? ' disabled' : '') + '>' + m.name + ' (' + m.tier + ' ' + m.price + ')' + (!m.available ? ' 未配置' : '') + '</option>'
    ).join('');
    // 默认选性价比
    const def = models.find(m => m.tier === '性价比' && m.available);
    if (def) sel.value = def.id;
  } catch (e) { console.error('图片模型加载失败:', e); }
}

function t4GetImagePrompt(shot, index) {
  const s = AppState.t4Settings;
  const cam = shot.camera || {};
  const includeSubtitle = AppState.t4KfSubtitle !== false;
  let p = 'TikTok short video keyframe. Shot #' + (index + 1) + ', role: ' + (shot.role || shot.element || '无') + '.\n';
  p += 'Scene: ' + (shot.scene_description_cn || '') + '\n';
  if (includeSubtitle && shot.voiceover_cn) p += 'Voiceover subtitle: ' + shot.voiceover_cn + '\n';
  if (includeSubtitle && shot.text_overlay) p += 'Text overlay: ' + shot.text_overlay + '\n';
  if (shot.shooting_notes) p += 'Camera notes: ' + shot.shooting_notes + '\n';
  if (cam.shot_size) p += 'Shot size: ' + cam.shot_size + '\n';
  if (cam.lighting && cam.lighting.length) p += 'Lighting: ' + cam.lighting.join(', ') + '\n';
  if (cam.style) p += 'Style: ' + cam.style + '\n';
  const kfAspect = AppState.t4KfAspectRatio || '9:16';
  p += 'Aspect ratio: ' + kfAspect;
  if (includeSubtitle && (shot.voiceover_cn || shot.text_overlay)) {
    p += '\nRender the subtitle text visually on the image in the style of a TikTok video.';
  }
  return p;
}

async function t4GenOneKeyframe(idx) {
  const shots = AppState.t4RewriteData?.rewritten_structure;
  if (!shots || !shots[idx]) return;

  const sel = document.getElementById('t4-img-model');
  const modelId = sel ? sel.value : '';
  if (!modelId) { alert('请选择关键帧生成模型'); return; }

  const shot = shots[idx];
  const prompt = t4GetImagePrompt(shot, idx);
  const ratio = AppState.t4KfAspectRatio || '9:16';
  const refImg = t4KeyframeData[idx]?.referenceImage || null;

  t4KeyframeData[idx] = { status: 'loading', imageUrl: null, model: '', referenceImage: refImg };
  t4RenderShotTable_Update();

  try {
    const result = await API.generateKeyframe(prompt, modelId, ratio, refImg);
    t4KeyframeData[idx] = { status: 'done', imageUrl: result.imageUrl, model: result.model, referenceImage: refImg };
  } catch (e) {
    t4KeyframeData[idx] = { status: 'error', error: e.message, referenceImage: refImg };
  }
  t4RenderShotTable_Update();
}

async function t4GenAllKeyframes() {
  const shots = AppState.t4RewriteData?.rewritten_structure;
  if (!shots || shots.length === 0) return;

  const sel = document.getElementById('t4-img-model');
  const modelId = sel ? sel.value : '';
  if (!modelId) { alert('请选择关键帧生成模型'); return; }

  const statusEl = document.getElementById('t4-kf-status');
  let done = 0;

  for (let i = 0; i < shots.length; i++) {
    if (statusEl) statusEl.textContent = '生成中 ' + (done + 1) + '/' + shots.length + '...';
    t4KeyframeData[i] = { status: 'loading', imageUrl: null, referenceImage: t4KeyframeData[i]?.referenceImage || null };
    t4RenderShotTable_Update();

    try {
      const prompt = t4GetImagePrompt(shots[i], i);
      const ratio = AppState.t4KfAspectRatio || '9:16';
      const refImg = t4KeyframeData[i]?.referenceImage || null;
      const result = await API.generateKeyframe(prompt, modelId, ratio, refImg);
      t4KeyframeData[i] = { status: 'done', imageUrl: result.imageUrl, model: result.model, referenceImage: refImg };
    } catch (e) {
      t4KeyframeData[i] = { status: 'error', error: e.message };
    }
    done++;
    t4RenderShotTable_Update();
  }
  if (statusEl) statusEl.textContent = '全部完成 ' + done + '/' + shots.length;
}

function t4UploadRef(idx, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    if (!t4KeyframeData[idx]) t4KeyframeData[idx] = {};
    t4KeyframeData[idx].referenceImage = e.target.result;
    // 立刻用参考图生成
    t4GenOneKeyframe(idx);
  };
  reader.readAsDataURL(file);
}

// 局部刷新表格（不重渲染整个 Tab4）
function t4RenderShotTable_Update() {
  const container = document.querySelector('#t4 table tbody');
  if (container) {
    // 重建tbody内容
    const tableHtml = t4RenderShotTable();
    const temp = document.createElement('div');
    temp.innerHTML = tableHtml;
    const newTbody = temp.querySelector('tbody');
    if (newTbody) container.innerHTML = newTbody.innerHTML;
  }
}

// ============== Hook/CTA 融入 ==============

function t4MergeHookCta() {
  const data = AppState.t4RewriteData;
  if (!data) return;
  if (data.hook_suggestion && data.rewritten_structure.length > 0) {
    const first = data.rewritten_structure[0];
    if (first.role !== '停' && first.element !== '停') {
      data.rewritten_structure.unshift({ role: '停', element: '停', shot_type: '开头钩子', scene_description_cn: '', voiceover_cn: data.hook_suggestion, text_overlay: '', shooting_notes: '', camera: { shot_size: '', lighting: [], movement: '', composition: '', style: '' } });
    }
    delete data.hook_suggestion;
  }
  if (data.cta_suggestion && data.rewritten_structure.length > 0) {
    const last = data.rewritten_structure[data.rewritten_structure.length - 1];
    if (last.role !== '买' && last.element !== '买') {
      data.rewritten_structure.push({ role: '买', element: '买', shot_type: '结尾促单', scene_description_cn: '', voiceover_cn: data.cta_suggestion, text_overlay: '', shooting_notes: '', camera: { shot_size: '', lighting: [], movement: '', composition: '', style: '' } });
    }
    delete data.cta_suggestion;
  }
}

// ============== 编辑操作 ==============

function t4UpdateShot(el) {
  const idx = parseInt(el.dataset.idx), field = el.dataset.field;
  if (AppState.t4RewriteData?.rewritten_structure[idx]) { AppState.t4RewriteData.rewritten_structure[idx][field] = el.value; AppState.t4Dirty = true; }
}

function t4UpdateRole(el) {
  const idx = parseInt(el.dataset.idx);
  if (AppState.t4RewriteData?.rewritten_structure[idx]) {
    AppState.t4RewriteData.rewritten_structure[idx].role = el.value;
    AppState.t4RewriteData.rewritten_structure[idx].element = el.value;
    AppState.t4Dirty = true;
    el.className = 't4-role-sel bg-' + elemCls(el.value);
  }
}

function t4RemoveShot(idx) {
  if (!AppState.t4RewriteData) return;
  if (!confirm('确定删除镜头 #' + (idx + 1) + '?')) return;
  AppState.t4RewriteData.rewritten_structure.splice(idx, 1);
  delete t4KeyframeData[idx];
  // 重新索引keyframe data
  const newKf = {};
  Object.keys(t4KeyframeData).forEach(k => { const ki = parseInt(k); if (ki > idx) newKf[ki - 1] = t4KeyframeData[ki]; else if (ki < idx) newKf[ki] = t4KeyframeData[ki]; });
  t4KeyframeData = newKf;
  AppState.t4Dirty = true;
  t4RenderFull();
}

function t4AddShot() {
  if (!AppState.t4RewriteData) return;
  AppState.t4RewriteData.rewritten_structure.push({ role: '药', element: '药', shot_type: '产品展示', scene_description_cn: '', voiceover_cn: '', text_overlay: '', shooting_notes: '', camera: { shot_size: '', lighting: [], movement: '', composition: '', style: '' } });
  AppState.t4Dirty = true;
  t4RenderFull();
}

// ============== 确认脚本 + Prompt ==============

function t4ConfirmScript() {
  t4UpdateCost();
  AppState.t4Dirty = false;
}

function t4TogglePrompt() {
  const el = document.getElementById('t4-prompt-preview');
  if (el.classList.contains('on')) { el.classList.remove('on'); return; }
  el.textContent = JSON.stringify(t4BuildJsonPrompt(), null, 2);
  el.classList.add('on');
}

function t4BuildJsonPrompt() {
  if (!AppState.t4RewriteData) return {};
  const shots = AppState.t4RewriteData.rewritten_structure || [];
  const s = AppState.t4Settings;
  const arEl = document.querySelector('input[name="t4ar"]:checked');
  return { platform: s.platform, aspect_ratio: arEl ? arEl.value : '9:16', layout_template: s.layoutTemplate, language: s.language, product_image: s.productImage ? '(attached)' : null, framework: AppState.t4RewriteData.framework || '', shots: shots.map((shot, i) => ({ index: i + 1, role: shot.role || shot.element || '无', scene_description: shot.scene_description_cn || '', voiceover: shot.voiceover_cn || '', subtitle: shot.text_overlay || '', shooting_notes: shot.shooting_notes || '', camera: shot.camera || {} })) };
}

function t4BuildPrompt() { return JSON.stringify(t4BuildJsonPrompt()); }
function t4BuildShotPrompt(shot) { const desc = shot.scene_description_cn || ''; const vo = shot.voiceover_cn || ''; let p = 'TikTok product video shot. ' + desc; if (vo) p += ' Voiceover: "' + vo + '"'; if (shot.shooting_notes) p += ' Camera: ' + shot.shooting_notes; return p; }

// ============== 费用预估 ==============

function t4UpdateCost() {
  const modeEl = document.getElementById('t4-gen-mode'), mode = modeEl ? modeEl.value : 'single';
  const modelEl = document.getElementById('t4-model'), model = modelEl ? modelEl.value : '';
  const shotCount = AppState.t4RewriteData ? AppState.t4RewriteData.rewritten_structure.length : 0;
  const isQuality = model.indexOf('fast') === -1 && model.indexOf('veo3') !== -1;
  const baseCost = isQuality ? 400 : 60;
  const count = mode === 'pershot' ? shotCount : 1;
  const el = id => document.getElementById(id);
  if (el('t4-cost-shots')) el('t4-cost-shots').textContent = shotCount;
  if (el('t4-cost-count')) el('t4-cost-count').textContent = count;
  if (el('t4-cost-credits')) el('t4-cost-credits').textContent = '~' + (baseCost * count) + ' credits';
}

// ============== 平台 & BGM ==============

async function t4LoadPlatforms() {
  try {
    const platforms = await API.getVideoGenPlatforms();
    AppState.t4Platforms = platforms;
    const sel = document.getElementById('t4-platform');
    if (!sel) return;
    let html = '<option value="">-- 选择生成平台 --</option>';
    platforms.forEach(p => { html += '<option value="' + p.id + '"' + (!p.available ? ' disabled' : '') + '>' + p.name + (!p.available ? ' (未配置)' : '') + '</option>'; });
    sel.innerHTML = html;
    const first = platforms.find(p => p.available);
    if (first) { sel.value = first.id; t4PlatformChange(); }
  } catch (e) { console.error('平台加载失败:', e); }
}

function t4PlatformChange() {
  const pidEl = document.getElementById('t4-platform'), pid = pidEl ? pidEl.value : '';
  const msel = document.getElementById('t4-model'), btn = document.getElementById('btn-gen');
  if (!pid || !AppState.t4Platforms) { msel.innerHTML = '<option value="">先选平台</option>'; btn.disabled = true; return; }
  const p = AppState.t4Platforms.find(x => x.id === pid);
  if (!p || !p.available) { msel.innerHTML = '<option value="">不可用</option>'; btn.disabled = true; return; }
  msel.innerHTML = p.models.map(m => '<option value="' + m.id + '">' + m.name + ' - ' + m.price + '</option>').join('');
  btn.disabled = false;
  t4UpdateCost();
}

async function t4LoadBgm() {
  try {
    const bgm = await API.getBgmList();
    AppState.t4BgmData = bgm;
    const list = document.getElementById('t4-bgm-list');
    if (!list) return;
    if (bgm.length === 0) { list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">BGM 库暂无数据</div>'; return; }
    list.innerHTML = bgm.map(b => {
      const moodCls = (b.mood || '').includes('紧张') ? 'mood-tight' : (b.mood || '').includes('爽') ? 'mood-cool' : (b.mood || '').includes('治愈') || (b.mood || '').includes('轻松') ? 'mood-chill' : 'mood-trend';
      return '<div class="bgm-item" onclick="t4SelectBgm(this)"><div class="bgm-name">' + esc(b.name) + '</div><span class="bgm-mood ' + moodCls + '">' + esc(b.mood) + '</span>' + (b.description ? '<div class="bgm-desc">' + esc(b.description) + '</div>' : '') + '</div>';
    }).join('');
  } catch (e) { const list = document.getElementById('t4-bgm-list'); if (list) list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3)">BGM 加载失败</div>'; }
}

function t4SelectBgm(el) { document.querySelectorAll('.bgm-item').forEach(i => i.classList.remove('selected')); el.classList.add('selected'); }

// ============== 视频生成（保持原有逻辑） ==============

function t4Generate() {
  const platformEl = document.getElementById('t4-platform'), platform = platformEl ? platformEl.value : '';
  const modelEl = document.getElementById('t4-model'), model = modelEl ? modelEl.value : '';
  const arEl = document.querySelector('input[name="t4ar"]:checked'), ar = arEl ? arEl.value : '9:16';
  const genModeEl = document.getElementById('t4-gen-mode'), genMode = genModeEl ? genModeEl.value : 'single';
  if (!platform || !model) { alert('请选择生成平台和模型'); return; }
  if (!AppState.t4RewriteData) { alert('请先完成脚本编辑'); return; }
  const btn = document.getElementById('btn-gen'), prog = document.getElementById('gen-progress'), fill = document.getElementById('gp-fill'), text = document.getElementById('gp-text');
  btn.disabled = true; btn.textContent = '提交中...'; prog.classList.add('on'); document.getElementById('gen-result').classList.remove('on'); fill.style.width = '5%'; text.textContent = '正在提交...';
  if (genMode === 'pershot') t4GeneratePerShot(platform, model, ar); else t4GenerateSingle(platform, model, ar);
}

async function t4GenerateSingle(platform, model, ar) {
  const prompt = t4BuildPrompt();
  try {
    const d = await API.submitVideoGen(prompt, platform, model, ar);
    AppState.t4GenTaskKey = d.taskKey;
    document.getElementById('gp-fill').style.width = '15%'; document.getElementById('gp-text').textContent = '任务已提交，等待生成...'; document.getElementById('btn-gen').textContent = '生成中...';
    t4StartPolling();
  } catch (e) { alert('失败: ' + e.message); t4ResetGenUI(); }
}

function t4GeneratePerShot(platform, model, ar) {
  const shots = AppState.t4RewriteData.rewritten_structure;
  const text = document.getElementById('gp-text'), fill = document.getElementById('gp-fill');
  const taskKeys = []; let idx = 0;
  function submitNext() {
    if (idx >= shots.length) { AppState.t4GenTaskKey = taskKeys; fill.style.width = '20%'; text.textContent = '全部提交完成'; document.getElementById('btn-gen').textContent = '生成中...'; t4StartPollingMulti(taskKeys); return; }
    fill.style.width = (5 + (idx / shots.length) * 15) + '%'; text.textContent = '提交镜头 ' + (idx + 1) + '/' + shots.length;
    API.submitVideoGen(t4BuildShotPrompt(shots[idx]), platform, model, ar).then(d => { taskKeys.push(d.taskKey); idx++; submitNext(); }).catch(e => { alert('失败: ' + e.message); t4ResetGenUI(); });
  }
  submitNext();
}

function t4ResetGenUI() { document.getElementById('btn-gen').disabled = false; document.getElementById('btn-gen').textContent = '生成视频'; document.getElementById('gen-progress').classList.remove('on'); }

function t4StartPolling() {
  if (AppState.t4PollTimer) clearInterval(AppState.t4PollTimer);
  let attempts = 0;
  AppState.t4PollTimer = setInterval(() => {
    attempts++;
    if (attempts > 120) { clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null; document.getElementById('gp-text').textContent = '超时'; t4ResetGenUI(); return; }
    document.getElementById('gp-fill').style.width = Math.min(15 + attempts * 0.67, 95) + '%';
    document.getElementById('gp-text').textContent = '生成中... ' + (attempts * 5) + 's';
    API.getVideoGenStatus(AppState.t4GenTaskKey).then(d => {
      if (d.status === 'completed' && d.videoUrl) {
        clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null;
        document.getElementById('gp-fill').style.width = '100%'; document.getElementById('gp-text').textContent = '生成完成';
        document.getElementById('gen-video').src = d.videoUrl; document.getElementById('gen-download').href = d.videoUrl;
        document.getElementById('gen-result').classList.add('on'); t4ResetGenUI();
      } else if (d.status === 'failed') { clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null; document.getElementById('gp-text').textContent = '生成失败'; t4ResetGenUI(); }
    }).catch(e => console.error('轮询失败:', e));
  }, 5000);
}

function t4StartPollingMulti(taskKeys) {
  if (AppState.t4PollTimer) clearInterval(AppState.t4PollTimer);
  let attempts = 0; const completed = taskKeys.map(() => false); const videoUrls = taskKeys.map(() => null);
  AppState.t4PollTimer = setInterval(() => {
    attempts++;
    if (attempts > 180) { clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null; document.getElementById('gp-text').textContent = '超时'; t4ResetGenUI(); return; }
    const doneCount = completed.filter(Boolean).length;
    document.getElementById('gp-fill').style.width = Math.min(20 + (doneCount / taskKeys.length) * 75, 95) + '%';
    document.getElementById('gp-text').textContent = '逐镜头 ' + doneCount + '/' + taskKeys.length + ' (' + (attempts * 5) + 's)';
    taskKeys.forEach((tk, i) => { if (completed[i]) return; API.getVideoGenStatus(tk).then(d => { if (d.status === 'completed' && d.videoUrl) { completed[i] = true; videoUrls[i] = d.videoUrl; } else if (d.status === 'failed') { completed[i] = true; } }).catch(() => {}); });
    if (completed.every(Boolean)) {
      clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null;
      const urls = videoUrls.filter(Boolean); document.getElementById('gp-fill').style.width = '100%';
      if (urls.length === 0) { document.getElementById('gp-text').textContent = '全部失败'; }
      else { document.getElementById('gp-text').textContent = urls.length + '/' + taskKeys.length + ' 完成'; document.getElementById('gen-video').src = urls[0]; document.getElementById('gen-download').href = urls[0]; document.getElementById('gen-result').classList.add('on'); }
      t4ResetGenUI();
    }
  }, 5000);
}

// ============== 关键帧控制函数 ==============

function t4ChangeKfAspect(val) { AppState.t4KfAspectRatio = val; }
function t4ToggleKfSubtitle(checked) { AppState.t4KfSubtitle = checked; }

// ============== 导出 ==============

window.renderTab4 = renderTab4;
window.t4UpdateShot = t4UpdateShot;
window.t4UpdateRole = t4UpdateRole;
window.t4RemoveShot = t4RemoveShot;
window.t4AddShot = t4AddShot;
window.t4ConfirmScript = t4ConfirmScript;
window.t4UpdateCost = t4UpdateCost;
window.t4TogglePrompt = t4TogglePrompt;
window.t4PlatformChange = t4PlatformChange;
window.t4SelectBgm = t4SelectBgm;
window.t4Generate = t4Generate;
window.t4UploadProductImage = t4UploadProductImage;
window.t4ClearProductImage = t4ClearProductImage;
window.t4ChangePlatform = t4ChangePlatform;
window.t4ChangeLayout = t4ChangeLayout;
window.t4ChangeLanguage = t4ChangeLanguage;
window.t4GenOneKeyframe = t4GenOneKeyframe;
window.t4GenAllKeyframes = t4GenAllKeyframes;
window.t4UploadRef = t4UploadRef;
window.t4ChangeKfAspect = t4ChangeKfAspect;
window.t4ToggleKfSubtitle = t4ToggleKfSubtitle;
