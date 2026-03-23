/**
 * tab4-generate.js — AI 视频生成 Tab (V3.1 P0-3/4/5)
 * 
 * PRD 变更：
 * - 全局设置栏（白底图、发布平台、目标语言、布局模板）
 * - 镜头卡片：角色标签下拉、景别/光线/运镜/风格/构图下拉
 * - 移除 EN 原文折叠区（系统自动翻译拼装）
 * - Hook/CTA 融入镜头序列（作为角色标签）
 * - 底部操作栏：添加镜头、确认脚本、保存飞书、预览 Prompt
 * - 拖拽排序 + 编号跳转
 */

// ============== 布局模板配置 ==============

const LAYOUT_TEMPLATES = {
  tiktok_916:   { id: 'tiktok_916', name: 'TikTok 9:16 竖屏', platform: 'tiktok', ratio: '9:16' },
  ig_reels_916: { id: 'ig_reels_916', name: 'Instagram Reels 9:16', platform: 'instagram', ratio: '9:16' },
  ig_post_45:   { id: 'ig_post_45', name: 'Instagram 帖子 4:5', platform: 'instagram', ratio: '4:5' },
  ig_post_11:   { id: 'ig_post_11', name: 'Instagram 帖子 1:1', platform: 'instagram', ratio: '1:1' },
  douyin_916:   { id: 'douyin_916', name: '抖音 9:16 竖屏口播', platform: 'douyin', ratio: '9:16' },
  douyin_916p:  { id: 'douyin_916p', name: '抖音 9:16 产品展示', platform: 'douyin', ratio: '9:16' },
  xhs_34:       { id: 'xhs_34', name: '小红书 3:4', platform: 'xiaohongshu', ratio: '3:4' },
};

const PLATFORM_TEMPLATES = {
  tiktok: ['tiktok_916'],
  instagram: ['ig_reels_916', 'ig_post_45', 'ig_post_11'],
  douyin: ['douyin_916', 'douyin_916p'],
  xiaohongshu: ['xhs_34'],
};

// ============== 下拉选项配置 ==============

const ROLE_OPTIONS = ['停', '病', '药', '信', '买', '无'];
const SHOT_SIZE_OPTIONS = ['', '微距特写', '特写', '中景', '全景', '俯拍平铺'];
const LIGHTING_OPTIONS = ['自然光', '暖光', '冷光', '逆光轮廓光', '棚拍均匀光'];
const MOVEMENT_OPTIONS = ['', '固定', '推进', '后拉', '跟拍', '环绕'];
const STYLE_OPTIONS = ['', '写实场景', '产品广告', '科普图解', '情绪氛围', '真实Vlog'];
const COMPOSITION_OPTIONS = ['', '居中', '三分法左', '三分法右', '上方留白', '下方留白'];

// ============== 渲染入口 ==============

function renderTab4() {
  const panel = document.getElementById('t4');
  const rw = AppState.lastRewrite;

  if (!rw || !rw.rewritten_structure || rw.rewritten_structure.length === 0) {
    panel.innerHTML = '<div class="t4-no-data"><div class="nd-icon">✨</div>' +
      '<div class="nd-text">请先在「脚本结构分析」Tab 完成跨品类改编</div>' +
      '<div class="nd-hint">改编完成后回到此页，即可编辑脚本并生成视频</div></div>';
    return;
  }

  if (!AppState.t4Initialized || !AppState.t4RewriteData) {
    AppState.initT4FromRewrite(rw);
  }

  t4RenderEditor();
}

// ============== 全局设置栏 ==============

function t4RenderGlobalSettings() {
  const s = AppState.t4Settings;
  const imgPreview = s.productImage
    ? '<div class="t4-img-preview"><img src="' + s.productImage + '"><span onclick="t4ClearProductImage()" class="t4-img-x">✕</span></div>'
    : '';

  // 根据当前平台生成模板选项
  const templates = PLATFORM_TEMPLATES[s.platform] || ['tiktok_916'];
  const templateOpts = templates.map(tid => {
    const t = LAYOUT_TEMPLATES[tid];
    return '<option value="' + tid + '"' + (s.layoutTemplate === tid ? ' selected' : '') + '>' + t.name + '</option>';
  }).join('');

  return '<div class="t4-global-bar">' +
    '<div class="t4-global-row">' +
      // 产品白底图
      '<div class="t4-global-item">' +
        '<label>🖼 产品白底图</label>' +
        '<div class="t4-img-upload">' +
          imgPreview +
          '<label class="btn-sm" style="padding:6px 12px;cursor:pointer">' +
            (s.productImage ? '替换' : '上传图片') +
            '<input type="file" accept="image/*" style="display:none" onchange="t4UploadProductImage(this)">' +
          '</label>' +
        '</div>' +
      '</div>' +
      // 发布平台
      '<div class="t4-global-item">' +
        '<label>📱 发布平台</label>' +
        '<select class="t4-select t4-sel-sm" onchange="t4ChangePlatform(this.value)">' +
          '<option value="tiktok"' + (s.platform === 'tiktok' ? ' selected' : '') + '>TikTok</option>' +
          '<option value="instagram"' + (s.platform === 'instagram' ? ' selected' : '') + '>Instagram</option>' +
          '<option value="douyin"' + (s.platform === 'douyin' ? ' selected' : '') + '>抖音</option>' +
          '<option value="xiaohongshu"' + (s.platform === 'xiaohongshu' ? ' selected' : '') + '>小红书</option>' +
        '</select>' +
      '</div>' +
      // 布局模板
      '<div class="t4-global-item">' +
        '<label>📐 布局模板</label>' +
        '<select class="t4-select t4-sel-sm" id="t4-layout-select" onchange="t4ChangeLayout(this.value)">' +
          templateOpts +
        '</select>' +
      '</div>' +
      // 目标语言
      '<div class="t4-global-item">' +
        '<label>🌐 目标语言</label>' +
        '<select class="t4-select t4-sel-sm" onchange="t4ChangeLanguage(this.value)">' +
          '<option value="EN"' + (s.language === 'EN' ? ' selected' : '') + '>英语</option>' +
          '<option value="CN"' + (s.language === 'CN' ? ' selected' : '') + '>中文</option>' +
          '<option value="ES"' + (s.language === 'ES' ? ' selected' : '') + '>西班牙语</option>' +
        '</select>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function t4UploadProductImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    AppState.t4Settings.productImage = e.target.result;
    AppState.t4Settings.productImageName = file.name;
    t4RenderEditor();
  };
  reader.readAsDataURL(file);
}

function t4ClearProductImage() {
  AppState.t4Settings.productImage = null;
  AppState.t4Settings.productImageName = null;
  t4RenderEditor();
}

function t4ChangePlatform(val) {
  AppState.t4Settings.platform = val;
  const templates = PLATFORM_TEMPLATES[val] || ['tiktok_916'];
  AppState.t4Settings.layoutTemplate = templates[0];
  t4RenderEditor();
}

function t4ChangeLayout(val) { AppState.t4Settings.layoutTemplate = val; }
function t4ChangeLanguage(val) { AppState.t4Settings.language = val; }

// ============== 镜头卡片渲染 ==============

function t4RenderShotCard(item, i, total) {
  const roleCls = elemCls(item.role || item.element);
  const cam = item.camera || {};

  // 角色下拉
  const roleOpts = ROLE_OPTIONS.map(r =>
    '<option value="' + r + '"' + ((item.role || item.element) === r ? ' selected' : '') + '>' + r + '</option>'
  ).join('');

  // 景别下拉
  const shotSizeOpts = SHOT_SIZE_OPTIONS.map(o =>
    '<option value="' + o + '"' + (cam.shot_size === o ? ' selected' : '') + '>' + (o || '— 选择景别') + '</option>'
  ).join('');

  // 运镜下拉
  const moveOpts = MOVEMENT_OPTIONS.map(o =>
    '<option value="' + o + '"' + (cam.movement === o ? ' selected' : '') + '>' + (o || '— 选择运镜') + '</option>'
  ).join('');

  // 风格下拉
  const styleOpts = STYLE_OPTIONS.map(o =>
    '<option value="' + o + '"' + (cam.style === o ? ' selected' : '') + '>' + (o || '— 选择风格') + '</option>'
  ).join('');

  // 构图下拉
  const compOpts = COMPOSITION_OPTIONS.map(o =>
    '<option value="' + o + '"' + (cam.composition === o ? ' selected' : '') + '>' + (o || '— 选择构图') + '</option>'
  ).join('');

  // 光线多选（checkbox）
  const lightingChecks = LIGHTING_OPTIONS.map(o => {
    const checked = (cam.lighting || []).includes(o) ? ' checked' : '';
    return '<label class="t4-check-inline"><input type="checkbox" value="' + o + '"' + checked +
      ' onchange="t4UpdateLighting(' + i + ')">' + o + '</label>';
  }).join('');

  return '<div class="t4-shot" id="t4-shot-' + i + '" draggable="true" ondragstart="t4DragStart(event,' + i + ')" ondragover="t4DragOver(event)" ondrop="t4Drop(event,' + i + ')">' +
    // 卡片顶部：编号 + 角色下拉 + 镜头类型 + 跳转
    '<div class="shot-hdr">' +
      '<span class="shot-idx">#' + (i + 1) + '</span>' +
      '<select class="t4-role-sel bg-' + roleCls + '" data-idx="' + i + '" onchange="t4UpdateRole(this)">' + roleOpts + '</select>' +
      '<span style="font-size:11px;color:var(--text3)">' + esc(item.shot_type || '') + '</span>' +
      '<span style="margin-left:auto;font-size:11px;color:var(--text3)">移至 <input type="number" min="1" max="' + total + '" style="width:36px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);text-align:center;font-size:11px;padding:1px" onchange="t4JumpShot(' + i + ',this.value)"> 号</span>' +
    '</div>' +
    // 画面描述
    '<div class="shot-field">' +
      '<label>🎬 画面描述</label>' +
      '<textarea rows="2" data-idx="' + i + '" data-field="scene_description_cn" oninput="t4UpdateShot(this)">' + esc(item.scene_description_cn || '') + '</textarea>' +
    '</div>' +
    // 口播文案
    '<div class="shot-field">' +
      '<label>🎤 口播文案</label>' +
      '<textarea rows="2" data-idx="' + i + '" data-field="voiceover_cn" oninput="t4UpdateShot(this)">' + esc(item.voiceover_cn || '') + '</textarea>' +
    '</div>' +
    // 字幕文字
    '<div class="shot-field">' +
      '<label>📝 字幕文字</label>' +
      '<input type="text" data-idx="' + i + '" data-field="text_overlay" oninput="t4UpdateShot(this)" value="' + esc(item.text_overlay || '') + '">' +
    '</div>' +
    // 拍摄建议
    '<div class="shot-field">' +
      '<label>📸 拍摄建议</label>' +
      '<textarea rows="1" data-idx="' + i + '" data-field="shooting_notes" oninput="t4UpdateShot(this)">' + esc(item.shooting_notes || '') + '</textarea>' +
    '</div>' +
    // 摄影参数（可折叠）
    '<details class="t4-camera-details">' +
      '<summary>📷 摄影参数</summary>' +
      '<div class="t4-camera-grid">' +
        '<div class="t4-cam-item"><label>景别</label><select class="t4-sel-sm" data-idx="' + i + '" data-cam="shot_size" onchange="t4UpdateCam(this)">' + shotSizeOpts + '</select></div>' +
        '<div class="t4-cam-item"><label>运镜</label><select class="t4-sel-sm" data-idx="' + i + '" data-cam="movement" onchange="t4UpdateCam(this)">' + moveOpts + '</select></div>' +
        '<div class="t4-cam-item"><label>风格</label><select class="t4-sel-sm" data-idx="' + i + '" data-cam="style" onchange="t4UpdateCam(this)">' + styleOpts + '</select></div>' +
        '<div class="t4-cam-item"><label>构图</label><select class="t4-sel-sm" data-idx="' + i + '" data-cam="composition" onchange="t4UpdateCam(this)">' + compOpts + '</select></div>' +
        '<div class="t4-cam-item t4-cam-wide"><label>光线（可多选）</label><div class="t4-light-checks" id="t4-lights-' + i + '">' + lightingChecks + '</div></div>' +
      '</div>' +
    '</details>' +
    // 操作按钮
    '<div class="shot-actions" style="margin-top:8px">' +
      '<button class="btn-sm" onclick="t4RemoveShot(' + i + ')">🗑 删除</button>' +
      (i > 0 ? '<button class="btn-sm" onclick="t4MoveShot(' + i + ',-1)">↑</button>' : '') +
      (i < total - 1 ? '<button class="btn-sm" onclick="t4MoveShot(' + i + ',1)">↓</button>' : '') +
    '</div>' +
  '</div>';
}

// ============== 编辑器主渲染 ==============

function t4RenderEditor() {
  const panel = document.getElementById('t4');
  const shots = AppState.t4RewriteData.rewritten_structure;
  const shotCount = shots.length;

  // 如果有 hook/cta 独立字段，融入镜头序列
  t4MergeHookCta();

  const globalHtml = t4RenderGlobalSettings();
  const shotsHtml = shots.map((item, i) => t4RenderShotCard(item, i, shotCount)).join('');

  const singleCost = 60;

  panel.innerHTML = '<div class="t4-layout">' +
    '<div class="t4-editor">' +
      '<div class="t4-title">✏️ 脚本编辑器 <span style="font-size:12px;color:var(--text3);font-weight:400">' + shotCount + ' 个镜头 · 拖拽排序 · 角色标签可改</span></div>' +
      globalHtml +
      '<div id="t4-shots">' + shotsHtml + '</div>' +
      // 底部操作栏
      '<div class="t4-bottom-bar">' +
        '<button class="btn-sm" style="padding:8px 16px" onclick="t4AddShot()">＋ 添加镜头</button>' +
        '<button class="btn-sm t4-btn-confirm" style="padding:8px 16px" onclick="t4ConfirmScript()">✅ 确认脚本</button>' +
        '<button class="btn-sm" style="padding:8px 16px" onclick="t4TogglePrompt()">👁 预览 Prompt</button>' +
      '</div>' +
      '<div class="t4-prompt-preview" id="t4-prompt-preview"></div>' +
    '</div>' +
    '<div class="t4-sidebar">' +
      // 生成配置面板
      '<div class="t4-panel">' +
        '<h3>🎬 视频生成设置</h3>' +
        '<div style="margin-bottom:14px">' +
          '<div class="t4-opt"><span class="opt-label">生成模式</span></div>' +
          '<select class="t4-select" id="t4-gen-mode" onchange="t4UpdateCost()">' +
            '<option value="single">整条生成（一个 prompt → 一条 8s 视频）</option>' +
            '<option value="pershot">逐镜头生成 + 拼接（每镜头独立生成）</option>' +
          '</select>' +
        '</div>' +
        '<div style="margin-bottom:14px">' +
          '<div class="t4-opt"><span class="opt-label">生成平台</span></div>' +
          '<select class="t4-select" id="t4-platform" onchange="t4PlatformChange()"><option value="">加载中...</option></select>' +
        '</div>' +
        '<div style="margin-bottom:14px">' +
          '<div class="t4-opt"><span class="opt-label">模型选择</span></div>' +
          '<select class="t4-select" id="t4-model" onchange="t4UpdateCost()"><option value="">先选平台</option></select>' +
        '</div>' +
        '<div style="margin-bottom:14px">' +
          '<div class="t4-opt"><span class="opt-label">画面比例</span></div>' +
          '<div class="t4-radio">' +
            '<label><input type="radio" name="t4ar" value="9:16" checked> 9:16</label>' +
            '<label><input type="radio" name="t4ar" value="16:9"> 16:9</label>' +
            '<label><input type="radio" name="t4ar" value="3:4"> 3:4</label>' +
            '<label><input type="radio" name="t4ar" value="1:1"> 1:1</label>' +
            '<label><input type="radio" name="t4ar" value="4:5"> 4:5</label>' +
          '</div>' +
        '</div>' +
        // 费用预估
        '<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px">' +
          '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">📊 预估</div>' +
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--text3)">镜头数</span><span style="color:var(--text);font-weight:600" id="t4-cost-shots">' + shotCount + ' 个</span></div>' +
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--text3)">生成次数</span><span style="color:var(--text);font-weight:600" id="t4-cost-count">1 次</span></div>' +
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--text3)">预估费用</span><span style="color:var(--orange);font-weight:600" id="t4-cost-credits">~' + singleCost + ' credits</span></div>' +
          '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--text3)">预估耗时</span><span style="color:var(--text);font-weight:600" id="t4-cost-time">1-3 分钟</span></div>' +
        '</div>' +
        '<button class="btn-gen" id="btn-gen" onclick="t4Generate()" disabled>⚡ 生成视频</button>' +
        '<div class="gen-progress" id="gen-progress">' +
          '<div class="gp-bar"><div class="gp-fill" id="gp-fill"></div></div>' +
          '<div class="gp-text" id="gp-text">准备中...</div>' +
        '</div>' +
        '<div class="gen-result" id="gen-result">' +
          '<video id="gen-video" controls></video>' +
          '<div class="gr-actions">' +
            '<a id="gen-download" class="btn-sm" style="padding:8px 16px;text-decoration:none" download>⬇ 下载</a>' +
            '<button class="btn-sm" style="padding:8px 16px" onclick="t4Generate()">🔄 重新生成</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      // BGM 推荐
      '<div class="t4-panel">' +
        '<h3>🎵 BGM 推荐</h3>' +
        '<div class="bgm-list" id="t4-bgm-list"><div style="text-align:center;padding:20px;color:var(--text3);font-size:13px"><div class="spin" style="margin:0 auto 8px"></div>加载 BGM 库...</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';

  t4LoadPlatforms();
  t4LoadBgm();
}

// ============== Hook/CTA 融入镜头序列 ==============

function t4MergeHookCta() {
  const data = AppState.t4RewriteData;
  if (!data) return;
  // 如果有独立的 hook_suggestion 且第一个镜头不是「停」角色，插入到开头
  if (data.hook_suggestion && data.rewritten_structure.length > 0) {
    const first = data.rewritten_structure[0];
    if (first.role !== '停' && first.element !== '停') {
      data.rewritten_structure.unshift({
        role: '停', element: '停', shot_type: '开头钩子',
        scene_description_cn: '', voiceover_cn: data.hook_suggestion,
        text_overlay: '', shooting_notes: '',
        camera: { shot_size: '', lighting: [], movement: '', composition: '', style: '' }
      });
    }
    delete data.hook_suggestion;
  }
  // CTA 同理，插入到结尾
  if (data.cta_suggestion && data.rewritten_structure.length > 0) {
    const last = data.rewritten_structure[data.rewritten_structure.length - 1];
    if (last.role !== '买' && last.element !== '买') {
      data.rewritten_structure.push({
        role: '买', element: '买', shot_type: '结尾促单',
        scene_description_cn: '', voiceover_cn: data.cta_suggestion,
        text_overlay: '', shooting_notes: '',
        camera: { shot_size: '', lighting: [], movement: '', composition: '', style: '' }
      });
    }
    delete data.cta_suggestion;
  }
}

// ============== 编辑操作 ==============

function t4UpdateShot(el) {
  const idx = parseInt(el.dataset.idx);
  const field = el.dataset.field;
  if (AppState.t4RewriteData && AppState.t4RewriteData.rewritten_structure[idx]) {
    AppState.t4RewriteData.rewritten_structure[idx][field] = el.value;
    AppState.t4Dirty = true;
  }
}

function t4UpdateRole(el) {
  const idx = parseInt(el.dataset.idx);
  if (AppState.t4RewriteData && AppState.t4RewriteData.rewritten_structure[idx]) {
    AppState.t4RewriteData.rewritten_structure[idx].role = el.value;
    AppState.t4RewriteData.rewritten_structure[idx].element = el.value;
    AppState.t4Dirty = true;
    // 只更新下拉框的颜色样式，不重新渲染整个编辑器
    const cls = elemCls(el.value);
    el.className = 't4-role-sel bg-' + cls;
  }
}

function t4UpdateCam(el) {
  const idx = parseInt(el.dataset.idx);
  const field = el.dataset.cam;
  const shot = AppState.t4RewriteData?.rewritten_structure[idx];
  if (shot) {
    if (!shot.camera) shot.camera = {};
    shot.camera[field] = el.value;
    AppState.t4Dirty = true;
  }
}

function t4UpdateLighting(idx) {
  const shot = AppState.t4RewriteData?.rewritten_structure[idx];
  if (!shot) return;
  if (!shot.camera) shot.camera = {};
  const container = document.getElementById('t4-lights-' + idx);
  const checks = container.querySelectorAll('input[type=checkbox]');
  shot.camera.lighting = Array.from(checks).filter(c => c.checked).map(c => c.value);
  AppState.t4Dirty = true;
}

function t4RemoveShot(idx) {
  if (!AppState.t4RewriteData) return;
  if (!confirm('确定删除镜头 #' + (idx + 1) + '？')) return;
  AppState.t4RewriteData.rewritten_structure.splice(idx, 1);
  AppState.t4Dirty = true;
  t4RenderEditor();
}

function t4MoveShot(idx, dir) {
  if (!AppState.t4RewriteData) return;
  const arr = AppState.t4RewriteData.rewritten_structure;
  const ni = idx + dir;
  if (ni < 0 || ni >= arr.length) return;
  [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
  AppState.t4Dirty = true;
  t4RenderEditor();
}

function t4JumpShot(fromIdx, toPos) {
  const pos = parseInt(toPos);
  if (!pos || pos < 1) return;
  const arr = AppState.t4RewriteData.rewritten_structure;
  const targetIdx = Math.min(pos - 1, arr.length - 1);
  if (targetIdx === fromIdx) return;
  const [item] = arr.splice(fromIdx, 1);
  arr.splice(targetIdx, 0, item);
  AppState.t4Dirty = true;
  t4RenderEditor();
}

function t4AddShot() {
  if (!AppState.t4RewriteData) return;
  AppState.t4RewriteData.rewritten_structure.push({
    role: '药', element: '药', shot_type: '产品展示',
    scene_description_cn: '', voiceover_cn: '',
    text_overlay: '', shooting_notes: '',
    camera: { shot_size: '', lighting: [], movement: '', composition: '', style: '' }
  });
  AppState.t4Dirty = true;
  t4RenderEditor();
  // 滚动到新镜头
  setTimeout(() => {
    const shots = document.querySelectorAll('.t4-shot');
    if (shots.length) shots[shots.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// ============== 拖拽排序 ==============

let t4DragIdx = null;

function t4DragStart(e, idx) {
  t4DragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.target.style.opacity = '0.5';
  setTimeout(() => { if (e.target) e.target.style.opacity = '1'; }, 200);
}

function t4DragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function t4Drop(e, targetIdx) {
  e.preventDefault();
  if (t4DragIdx === null || t4DragIdx === targetIdx) return;
  const arr = AppState.t4RewriteData.rewritten_structure;
  const [item] = arr.splice(t4DragIdx, 1);
  arr.splice(targetIdx, 0, item);
  t4DragIdx = null;
  AppState.t4Dirty = true;
  t4RenderEditor();
}

// ============== 确认脚本 ==============

function t4ConfirmScript() {
  // 确认后刷新右侧费用预估
  t4UpdateCost();
  AppState.t4Dirty = false;
  const btn = document.querySelector('.t4-btn-confirm');
  if (btn) {
    btn.textContent = '✅ 已确认';
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green)';
    setTimeout(() => { btn.textContent = '✅ 确认脚本'; btn.style.borderColor = ''; btn.style.color = ''; }, 2000);
  }
}

// ============== 费用预估 ==============

function t4UpdateCost() {
  const modeEl = document.getElementById('t4-gen-mode');
  const mode = modeEl ? modeEl.value : 'single';
  const modelEl = document.getElementById('t4-model');
  const model = modelEl ? modelEl.value : '';
  const shotCount = AppState.t4RewriteData ? AppState.t4RewriteData.rewritten_structure.length : 0;
  const isQuality = model.indexOf('fast') === -1 && model.indexOf('veo3') !== -1;
  const baseCost = isQuality ? 400 : 60;
  const count = mode === 'pershot' ? shotCount : 1;
  const cost = baseCost * count;
  const timeMin = mode === 'pershot' ? shotCount : 1;
  const timeMax = timeMin * 3;

  const el = id => document.getElementById(id);
  if (el('t4-cost-shots')) el('t4-cost-shots').textContent = shotCount + ' 个';
  if (el('t4-cost-count')) el('t4-cost-count').textContent = count + ' 次';
  if (el('t4-cost-credits')) el('t4-cost-credits').textContent = '~' + cost + ' credits';
  if (el('t4-cost-time')) el('t4-cost-time').textContent = timeMin + '-' + timeMax + ' 分钟';
}

// ============== Prompt 构建（JSON 格式） ==============

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
  const ar = arEl ? arEl.value : '9:16';
  const tpl = LAYOUT_TEMPLATES[s.layoutTemplate] || {};

  return {
    platform: s.platform,
    aspect_ratio: ar,
    layout_template: s.layoutTemplate,
    language: s.language,
    product_image: s.productImage ? '(base64 image attached)' : null,
    framework: AppState.t4RewriteData.framework || '',
    shots: shots.map((shot, i) => ({
      index: i + 1,
      role: shot.role || shot.element || '无',
      scene_description: shot.scene_description_cn || '',
      voiceover: shot.voiceover_cn || '',
      subtitle: shot.text_overlay || '',
      shooting_notes: shot.shooting_notes || '',
      camera: shot.camera || {}
    }))
  };
}

function t4BuildPrompt() {
  return JSON.stringify(t4BuildJsonPrompt());
}

function t4BuildShotPrompt(shot) {
  const desc = shot.scene_description_en || shot.scene_description_cn || '';
  const vo = shot.voiceover_en || shot.voiceover_cn || '';
  let p = 'TikTok product video shot. ' + desc;
  if (vo) p += ' Voiceover: "' + vo + '"';
  if (shot.shooting_notes) p += ' Camera: ' + shot.shooting_notes;
  if (shot.text_overlay) p += ' Text: "' + shot.text_overlay + '"';
  return p;
}

// ============== 平台 & BGM 加载 ==============

async function t4LoadPlatforms() {
  try {
    const platforms = await API.getVideoGenPlatforms();
    AppState.t4Platforms = platforms;
    const sel = document.getElementById('t4-platform');
    if (!sel) return;
    let html = '<option value="">— 选择生成平台 —</option>';
    platforms.forEach(p => {
      html += '<option value="' + p.id + '"' + (!p.available ? ' disabled' : '') + '>' + p.name + (!p.available ? ' (未配置)' : '') + '</option>';
    });
    sel.innerHTML = html;
    const first = platforms.find(p => p.available);
    if (first) { sel.value = first.id; t4PlatformChange(); }
  } catch (e) { console.error('平台加载失败:', e); }
}

function t4PlatformChange() {
  const pidEl = document.getElementById('t4-platform');
  const pid = pidEl ? pidEl.value : '';
  const msel = document.getElementById('t4-model');
  const btn = document.getElementById('btn-gen');
  if (!pid || !AppState.t4Platforms) { msel.innerHTML = '<option value="">先选平台</option>'; btn.disabled = true; return; }
  const p = AppState.t4Platforms.find(x => x.id === pid);
  if (!p || !p.available) { msel.innerHTML = '<option value="">平台不可用</option>'; btn.disabled = true; return; }
  let html = '';
  p.models.forEach(m => {
    html += '<option value="' + m.id + '">' + m.name + ' — ' + m.price + '</option>';
  });
  msel.innerHTML = html;
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
    let html = '';
    bgm.forEach((b, i) => {
      const moodCls = (b.mood || '').includes('紧张') ? 'mood-tight' : (b.mood || '').includes('爽') ? 'mood-cool' : (b.mood || '').includes('治愈') || (b.mood || '').includes('轻松') ? 'mood-chill' : 'mood-trend';
      html += '<div class="bgm-item" onclick="t4SelectBgm(this)">' +
        '<div class="bgm-name">' + esc(b.name) + '</div>' +
        '<span class="bgm-mood ' + moodCls + '">' + esc(b.mood) + '</span>' +
        (b.description ? '<div class="bgm-desc">' + esc(b.description) + '</div>' : '') +
      '</div>';
    });
    list.innerHTML = html;
  } catch (e) {
    console.error('BGM加载失败:', e);
    const list = document.getElementById('t4-bgm-list');
    if (list) list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">BGM 加载失败</div>';
  }
}

function t4SelectBgm(el) {
  document.querySelectorAll('.bgm-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
}

// ============== 视频生成（保持原有逻辑） ==============

function t4Generate() {
  const platformEl = document.getElementById('t4-platform');
  const platform = platformEl ? platformEl.value : '';
  const modelEl = document.getElementById('t4-model');
  const model = modelEl ? modelEl.value : '';
  const arEl = document.querySelector('input[name="t4ar"]:checked');
  const ar = arEl ? arEl.value : '9:16';
  const genModeEl = document.getElementById('t4-gen-mode');
  const genMode = genModeEl ? genModeEl.value : 'single';

  if (!platform || !model) { alert('请选择生成平台和模型'); return; }
  if (!AppState.t4RewriteData) { alert('请先完成脚本编辑'); return; }

  const btn = document.getElementById('btn-gen');
  const prog = document.getElementById('gen-progress');
  const fill = document.getElementById('gp-fill');
  const text = document.getElementById('gp-text');

  btn.disabled = true;
  btn.textContent = '⏳ 提交中…';
  prog.classList.add('on');
  document.getElementById('gen-result').classList.remove('on');
  fill.style.width = '5%';
  text.textContent = '正在提交生成任务…';

  if (genMode === 'pershot') { t4GeneratePerShot(platform, model, ar); }
  else { t4GenerateSingle(platform, model, ar); }
}

async function t4GenerateSingle(platform, model, ar) {
  const prompt = t4BuildPrompt();
  if (!prompt.trim()) { alert('脚本内容为空'); t4ResetGenUI(); return; }
  try {
    const d = await API.submitVideoGen(prompt, platform, model, ar);
    AppState.t4GenTaskKey = d.taskKey;
    document.getElementById('gp-fill').style.width = '15%';
    document.getElementById('gp-text').textContent = '任务已提交，等待生成… (通常 1-3 分钟)';
    document.getElementById('btn-gen').textContent = '⏳ 生成中…';
    t4StartPolling();
  } catch (e) { alert('生成失败: ' + e.message); t4ResetGenUI(); }
}

function t4GeneratePerShot(platform, model, ar) {
  const shots = AppState.t4RewriteData.rewritten_structure;
  const text = document.getElementById('gp-text');
  const fill = document.getElementById('gp-fill');
  const taskKeys = [];
  let idx = 0;
  function submitNext() {
    if (idx >= shots.length) {
      AppState.t4GenTaskKey = taskKeys;
      fill.style.width = '20%';
      text.textContent = '全部提交完成，等待 ' + shots.length + ' 个镜头生成…';
      document.getElementById('btn-gen').textContent = '⏳ 生成中…';
      t4StartPollingMulti(taskKeys);
      return;
    }
    fill.style.width = (5 + (idx / shots.length) * 15) + '%';
    text.textContent = '提交镜头 ' + (idx + 1) + '/' + shots.length + '…';
    API.submitVideoGen(t4BuildShotPrompt(shots[idx]), platform, model, ar).then(d => {
      taskKeys.push(d.taskKey); idx++; submitNext();
    }).catch(e => { alert('生成失败: ' + e.message); t4ResetGenUI(); });
  }
  submitNext();
}

function t4ResetGenUI() {
  document.getElementById('btn-gen').disabled = false;
  document.getElementById('btn-gen').textContent = '⚡ 生成视频';
  document.getElementById('gen-progress').classList.remove('on');
}

function t4StartPolling() {
  if (AppState.t4PollTimer) clearInterval(AppState.t4PollTimer);
  let attempts = 0;
  AppState.t4PollTimer = setInterval(() => {
    attempts++;
    if (attempts > 120) { clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null; document.getElementById('gp-text').textContent = '⏰ 超时'; t4ResetGenUI(); return; }
    document.getElementById('gp-fill').style.width = Math.min(15 + attempts * 0.67, 95) + '%';
    document.getElementById('gp-text').textContent = '生成中… 已等待 ' + (attempts * 5) + 's';
    API.getVideoGenStatus(AppState.t4GenTaskKey).then(d => {
      if (d.status === 'completed' && d.videoUrl) {
        clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null;
        document.getElementById('gp-fill').style.width = '100%';
        document.getElementById('gp-text').textContent = '✅ 生成完成！';
        document.getElementById('gen-video').src = d.videoUrl;
        document.getElementById('gen-download').href = d.videoUrl;
        document.getElementById('gen-result').classList.add('on');
        t4ResetGenUI();
        setTimeout(() => document.getElementById('gen-progress').classList.remove('on'), 2000);
      } else if (d.status === 'failed') {
        clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null;
        document.getElementById('gp-text').textContent = '❌ 生成失败，请重试';
        t4ResetGenUI();
      }
    }).catch(e => console.error('轮询失败:', e));
  }, 5000);
}

function t4StartPollingMulti(taskKeys) {
  if (AppState.t4PollTimer) clearInterval(AppState.t4PollTimer);
  let attempts = 0;
  const completed = taskKeys.map(() => false);
  const videoUrls = taskKeys.map(() => null);
  AppState.t4PollTimer = setInterval(() => {
    attempts++;
    if (attempts > 180) { clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null; document.getElementById('gp-text').textContent = '⏰ 超时'; t4ResetGenUI(); return; }
    const doneCount = completed.filter(Boolean).length;
    document.getElementById('gp-fill').style.width = Math.min(20 + (doneCount / taskKeys.length) * 75, 95) + '%';
    document.getElementById('gp-text').textContent = '逐镜头生成中… ' + doneCount + '/' + taskKeys.length + ' 完成 (' + (attempts * 5) + 's)';
    taskKeys.forEach((tk, i) => {
      if (completed[i]) return;
      API.getVideoGenStatus(tk).then(d => {
        if (d.status === 'completed' && d.videoUrl) { completed[i] = true; videoUrls[i] = d.videoUrl; }
        else if (d.status === 'failed') { completed[i] = true; }
      }).catch(() => {});
    });
    if (completed.every(Boolean)) {
      clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null;
      const urls = videoUrls.filter(Boolean);
      document.getElementById('gp-fill').style.width = '100%';
      if (urls.length === 0) { document.getElementById('gp-text').textContent = '❌ 所有镜头生成失败'; }
      else {
        document.getElementById('gp-text').textContent = '✅ ' + urls.length + '/' + taskKeys.length + ' 个镜头完成！';
        document.getElementById('gen-video').src = urls[0];
        document.getElementById('gen-download').href = urls[0];
        document.getElementById('gen-result').classList.add('on');
      }
      t4ResetGenUI();
      setTimeout(() => document.getElementById('gen-progress').classList.remove('on'), 3000);
    }
  }, 5000);
}

// ============== 导出 ==============

window.renderTab4 = renderTab4;
window.t4UpdateShot = t4UpdateShot;
window.t4UpdateRole = t4UpdateRole;
window.t4UpdateCam = t4UpdateCam;
window.t4UpdateLighting = t4UpdateLighting;
window.t4RemoveShot = t4RemoveShot;
window.t4MoveShot = t4MoveShot;
window.t4JumpShot = t4JumpShot;
window.t4AddShot = t4AddShot;
window.t4DragStart = t4DragStart;
window.t4DragOver = t4DragOver;
window.t4Drop = t4Drop;
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
