/**
 * tab4-generate.js — AI 视频生成 Tab
 * 包含：脚本编辑器、生成配置、BGM推荐
 */

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

  // 只在首次或新改写时克隆数据
  if (!AppState.t4Initialized || !AppState.t4RewriteData) {
    AppState.initT4FromRewrite(rw);
  }

  t4RenderEditor();
}

// ============== 编辑器渲染 ==============

function t4RenderEditor() {
  const panel = document.getElementById('t4');
  const shots = AppState.t4RewriteData.rewritten_structure;

  const shotsHtml = shots.map((item, i) => {
    const cls = elemCls(item.element);
    return '<div class="t4-shot" id="t4-shot-' + i + '">' +
      '<div class="shot-hdr">' +
        '<span class="shot-idx">#' + (i + 1) + '</span>' +
        '<span class="shot-elem bg-' + cls + '">' + esc(item.element) + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">' + esc(item.shot_type || '') + '</span>' +
      '</div>' +
      '<div class="shot-field">' +
        '<label>🎬 画面描述</label>' +
        '<textarea rows="2" data-idx="' + i + '" data-field="scene_description_cn" oninput="t4UpdateShot(this)">' + esc(item.scene_description_cn || '') + '</textarea>' +
      '</div>' +
      '<div class="shot-field">' +
        '<label>🎤 口播文案</label>' +
        '<textarea rows="2" data-idx="' + i + '" data-field="voiceover_cn" oninput="t4UpdateShot(this)">' + esc(item.voiceover_cn || '') + '</textarea>' +
      '</div>' +
      '<div class="shot-field">' +
        '<label>📝 字幕文字</label>' +
        '<input type="text" data-idx="' + i + '" data-field="text_overlay" oninput="t4UpdateShot(this)" value="' + esc(item.text_overlay || '') + '">' +
      '</div>' +
      '<div class="shot-field">' +
        '<label>📸 拍摄建议</label>' +
        '<textarea rows="1" data-idx="' + i + '" data-field="shooting_notes" oninput="t4UpdateShot(this)">' + esc(item.shooting_notes || '') + '</textarea>' +
      '</div>' +
      '<div style="border-top:1px dashed var(--border);margin-top:10px;padding-top:10px">' +
        '<details style="font-size:12px;color:var(--text3)">' +
          '<summary style="cursor:pointer">EN 原文（供视频生成 API 使用，可修改）</summary>' +
          '<div class="shot-field" style="margin-top:8px">' +
            '<label>Scene (EN)</label>' +
            '<textarea rows="2" data-idx="' + i + '" data-field="scene_description_en" oninput="t4UpdateShot(this)">' + esc(item.scene_description_en || '') + '</textarea>' +
          '</div>' +
          '<div class="shot-field">' +
            '<label>Voiceover (EN)</label>' +
            '<textarea rows="2" data-idx="' + i + '" data-field="voiceover_en" oninput="t4UpdateShot(this)">' + esc(item.voiceover_en || '') + '</textarea>' +
          '</div>' +
        '</details>' +
      '</div>' +
      '<div class="shot-actions" style="margin-top:8px">' +
        '<button class="btn-sm" onclick="t4RemoveShot(' + i + ')">删除</button>' +
        (i > 0 ? '<button class="btn-sm" onclick="t4MoveShot(' + i + ',-1)">↑</button>' : '') +
        (i < shots.length - 1 ? '<button class="btn-sm" onclick="t4MoveShot(' + i + ',1)">↓</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  // Hook & CTA 特殊卡片
  let extraHtml = '';
  if (AppState.t4RewriteData.hook_suggestion) {
    extraHtml += '<div class="t4-shot" style="border-color:var(--blue)">' +
      '<div class="shot-hdr"><span class="shot-elem bg-blue">Hook</span><span style="font-size:11px;color:var(--text3)">开头钩子</span></div>' +
      '<div class="shot-field"><label>🪝 钩子话术</label>' +
      '<textarea rows="2" id="t4-hook" oninput="AppState.t4RewriteData.hook_suggestion=this.value">' + esc(AppState.t4RewriteData.hook_suggestion) + '</textarea></div>' +
    '</div>';
  }
  if (AppState.t4RewriteData.cta_suggestion) {
    extraHtml += '<div class="t4-shot" style="border-color:var(--red)">' +
      '<div class="shot-hdr"><span class="shot-elem bg-red">CTA</span><span style="font-size:11px;color:var(--text3)">结尾促单</span></div>' +
      '<div class="shot-field"><label>🛒 促单话术</label>' +
      '<textarea rows="2" id="t4-cta" oninput="AppState.t4RewriteData.cta_suggestion=this.value">' + esc(AppState.t4RewriteData.cta_suggestion) + '</textarea></div>' +
    '</div>';
  }

  const shotCount = shots.length;
  const singleCost = 60;

  panel.innerHTML = '<div class="t4-layout">' +
    '<div class="t4-editor">' +
      '<div class="t4-title">✏️ 仿写脚本编辑器 <span style="font-size:12px;color:var(--text3);font-weight:400">每个镜头均可编辑 · 展开可修改 EN 原文</span></div>' +
      extraHtml +
      '<div id="t4-shots">' + shotsHtml + '</div>' +
      '<button class="btn-sm" style="margin-top:12px;padding:8px 16px" onclick="t4AddShot()">+ 添加镜头</button>' +
      '<div style="margin-top:16px">' +
        '<button class="btn-sm" style="padding:8px 16px" onclick="t4TogglePrompt()">👁 预览发送给 AI 的 Prompt</button>' +
        '<div class="t4-prompt-preview" id="t4-prompt-preview"></div>' +
      '</div>' +
    '</div>' +
    '<div class="t4-sidebar">' +
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
            '<label><input type="radio" name="t4ar" value="9:16" checked> 9:16 竖屏</label>' +
            '<label><input type="radio" name="t4ar" value="16:9"> 16:9 横屏</label>' +
            '<label><input type="radio" name="t4ar" value="1:1"> 1:1</label>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:14px">' +
          '<label class="t4-check"><input type="checkbox" id="t4-subtitle" checked> 在 prompt 中包含字幕提示</label>' +
        '</div>' +
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
            '<a id="gen-download" class="btn-sm" style="padding:8px 16px;text-decoration:none" download>⬇ 下载视频</a>' +
            '<button class="btn-sm" style="padding:8px 16px" onclick="t4Generate()">🔄 重新生成</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="t4-panel">' +
        '<h3>🎵 BGM 推荐</h3>' +
        '<div class="bgm-list" id="t4-bgm-list"><div style="text-align:center;padding:20px;color:var(--text3);font-size:13px"><div class="spin" style="margin:0 auto 8px"></div>加载 BGM 库...</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';

  t4LoadPlatforms();
  t4LoadBgm();
}

// ============== 编辑操作 ==============

function t4UpdateShot(el) {
  const idx = parseInt(el.dataset.idx);
  const field = el.dataset.field;
  if (AppState.t4RewriteData && AppState.t4RewriteData.rewritten_structure[idx]) {
    AppState.t4RewriteData.rewritten_structure[idx][field] = el.value;
  }
}

function t4RemoveShot(idx) {
  if (!AppState.t4RewriteData) return;
  AppState.t4RewriteData.rewritten_structure.splice(idx, 1);
  t4RenderEditor();
}

function t4MoveShot(idx, dir) {
  if (!AppState.t4RewriteData) return;
  const arr = AppState.t4RewriteData.rewritten_structure;
  const ni = idx + dir;
  if (ni < 0 || ni >= arr.length) return;
  [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
  t4RenderEditor();
}

function t4AddShot() {
  if (!AppState.t4RewriteData) return;
  AppState.t4RewriteData.rewritten_structure.push({
    element: '药', shot_type: '产品展示',
    scene_description_cn: '', scene_description_en: '',
    voiceover_cn: '', voiceover_en: '',
    text_overlay: '', shooting_notes: ''
  });
  t4RenderEditor();
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

// ============== Prompt 构建 ==============

function t4TogglePrompt() {
  const el = document.getElementById('t4-prompt-preview');
  if (el.classList.contains('on')) { el.classList.remove('on'); return; }
  el.textContent = t4BuildPrompt();
  el.classList.add('on');
}

function t4BuildPrompt() {
  if (!AppState.t4RewriteData) return '';
  const shots = AppState.t4RewriteData.rewritten_structure || [];
  const subtitleEl = document.getElementById('t4-subtitle');
  const subtitle = subtitleEl ? subtitleEl.checked : false;
  const arEl = document.querySelector('input[name="t4ar"]:checked');
  const ar = arEl ? arEl.value : '9:16';
  const orient = ar === '9:16' ? 'vertical portrait 9:16' : ar === '16:9' ? 'landscape 16:9' : 'square 1:1';

  let prompt = 'TikTok e-commerce product video. ' + orient + ' format. Fast-paced, engaging, bright visuals.\n\n';

  if (AppState.t4RewriteData.hook_suggestion) {
    prompt += '[HOOK - First 3 seconds]: ' + AppState.t4RewriteData.hook_suggestion + '\n\n';
  }

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const desc = s.scene_description_en || s.scene_description_cn || '';
    const vo = s.voiceover_en || s.voiceover_cn || '';
    prompt += '[Shot ' + (i + 1) + ' - ' + (s.element || 'Scene') + ']: ' + desc;
    if (vo) prompt += ' Voiceover: "' + vo + '"';
    if (s.shooting_notes) prompt += ' Camera: ' + s.shooting_notes;
    if (subtitle && s.text_overlay) prompt += ' Text overlay: "' + s.text_overlay + '"';
    prompt += '\n\n';
  }

  if (AppState.t4RewriteData.cta_suggestion) {
    prompt += '[CTA - Closing]: ' + AppState.t4RewriteData.cta_suggestion + '\n';
  }
  return prompt.trim();
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
      html += '<option value="' + p.id + '"' + (!p.available ? ' disabled' : '') + '>' + p.name + (!p.available ? ' (未配置 API Key)' : '') + '</option>';
    });
    sel.innerHTML = html;
    const first = platforms.find(p => p.available);
    if (first) { sel.value = first.id; t4PlatformChange(); }
  } catch (e) {
    console.error('平台加载失败:', e);
  }
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
    html += '<option value="' + m.id + '">' + m.name + ' — ' + m.price + ' · ' + m.speed + '</option>';
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
      const moodCls = (b.mood || '').indexOf('紧张') !== -1 ? 'mood-tight' :
                       (b.mood || '').indexOf('爽') !== -1 ? 'mood-cool' :
                       (b.mood || '').indexOf('治愈') !== -1 || (b.mood || '').indexOf('轻松') !== -1 ? 'mood-chill' : 'mood-trend';
      html += '<div class="bgm-item" onclick="t4SelectBgm(this,' + i + ')">' +
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

// ============== 视频生成 ==============

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

  if (genMode === 'pershot') {
    t4GeneratePerShot(platform, model, ar);
  } else {
    t4GenerateSingle(platform, model, ar);
  }
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
  } catch (e) {
    alert('生成失败: ' + e.message);
    t4ResetGenUI();
  }
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
    const shotPrompt = t4BuildShotPrompt(shots[idx]);

    API.submitVideoGen(shotPrompt, platform, model, ar).then(d => {
      taskKeys.push(d.taskKey);
      idx++;
      submitNext();
    }).catch(e => {
      alert('生成失败: ' + e.message);
      t4ResetGenUI();
    });
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
    if (attempts > 120) {
      clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null;
      document.getElementById('gp-text').textContent = '⏰ 超时';
      t4ResetGenUI(); return;
    }
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
    if (attempts > 180) {
      clearInterval(AppState.t4PollTimer); AppState.t4PollTimer = null;
      document.getElementById('gp-text').textContent = '⏰ 超时';
      t4ResetGenUI(); return;
    }
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
      if (urls.length === 0) {
        document.getElementById('gp-text').textContent = '❌ 所有镜头生成失败';
      } else {
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

// 导出
window.renderTab4 = renderTab4;
window.t4UpdateShot = t4UpdateShot;
window.t4RemoveShot = t4RemoveShot;
window.t4MoveShot = t4MoveShot;
window.t4AddShot = t4AddShot;
window.t4UpdateCost = t4UpdateCost;
window.t4TogglePrompt = t4TogglePrompt;
window.t4PlatformChange = t4PlatformChange;
window.t4SelectBgm = t4SelectBgm;
window.t4Generate = t4Generate;
