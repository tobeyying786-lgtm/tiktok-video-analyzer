require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai'); // ★ V3.6.7: 新SDK用于图片生成
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const KIE_API_KEY = process.env.KIE_API_KEY;
const FAL_API_KEY = process.env.FAL_API_KEY;

const FEISHU_CONFIG = {
  app_token: 'T7g4b0M4waf9OwsMc3pcJoqfnma',
  tables: {
    competitor: 'tblZQnvqkli68JUa', finished: 'tblpGj9b6S7rXrgb', framework: 'tblWiW6wv7gCf3O4',
    cta: 'tblGYDkGG3vfOedI', painpoint: 'tblzWvaA9nAZBq2W', comment: 'tbldmzhJ7UQxF9g9',
    sellingpt: 'tblUKBFDveaHCPYj', socialproof: 'tblSxNDEnz2Dz8yf', benefit: 'tblR4QQPyhRQm388', bgm: 'tblFqgaECRD1wfZn',
    scripts: 'tblcNi5sTHWPNHpO'
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => { const d = path.join(__dirname, 'uploads'); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); cb(null, d); },
  filename: (req, file, cb) => { cb(null, `${uuidv4()}${path.extname(file.originalname)}`); }
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ok = ['.mp4','.mov','.avi','.webm'].includes(path.extname(file.originalname).toLowerCase()); cb(ok ? null : new Error('不支持的格式'), ok); } });

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/frames', express.static(path.join(__dirname, 'frames')));

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

function getMimeType(f) { return { '.mp4':'video/mp4','.mov':'video/quicktime','.avi':'video/x-msvideo','.webm':'video/webm' }[path.extname(f).toLowerCase()] || 'video/mp4'; }

function ffprobeAnalyze(videoPath) {
  const result = { duration: null, sceneChanges: [], fps: null, resolution: null };
  try {
    const probeJson = execSync(`ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`, { timeout: 30000, stdio: 'pipe' }).toString();
    const probe = JSON.parse(probeJson);
    const fmt = probe.format || {};
    result.duration = parseFloat(fmt.duration) || null;
    const vs = (probe.streams || []).find(s => s.codec_type === 'video');
    if (vs) {
      result.resolution = `${vs.width}x${vs.height}`;
      if (vs.r_frame_rate) { const [num, den] = vs.r_frame_rate.split('/'); result.fps = den ? Math.round(parseInt(num) / parseInt(den)) : parseInt(num); }
    }
  } catch (e) { console.error('ffprobe 元数据获取失败:', e.message); }
  try {
    const sceneOutput = execSync(`ffmpeg -i "${videoPath}" -filter:v "select='gt(scene,0.3)',showinfo" -f null - 2>&1 | grep showinfo | grep pts_time`, { timeout: 60000, shell: true, stdio: 'pipe' }).toString();
    const timeRegex = /pts_time:(\d+\.?\d*)/g; let match;
    while ((match = timeRegex.exec(sceneOutput)) !== null) { result.sceneChanges.push(parseFloat(parseFloat(match[1]).toFixed(2))); }
  } catch (e) { console.log('ffmpeg scene detect: 无场景切换或命令失败'); }
  return result;
}

function extractFrames(videoPath, videoId, timePoints) {
  const dir = path.join(__dirname, 'frames', videoId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  for (let i = 0; i < timePoints.length; i++) {
    const t = timePoints[i], fn = `shot_${String(i+1).padStart(2,'0')}_${t.toFixed(1)}s.jpg`, out = path.join(dir, fn);
    try { execSync(`ffmpeg -y -ss ${t} -i "${videoPath}" -frames:v 1 -q:v 2 "${out}"`, { timeout: 15000, stdio: 'pipe' }); if (fs.existsSync(out)) frames.push({ index: i+1, time: t, url: `/frames/${videoId}/${fn}` }); } catch(e) {}
  }
  return frames;
}

function extractShotFrames(videoPath, videoId, shots) {
  return extractFrames(videoPath, videoId, shots.map(s => { const a = parseFloat(s.time_start)||0, b = parseFloat(s.time_end)||a; return parseFloat(((a+b)/2).toFixed(2)); }));
}

// === Feishu API ===
let feishuToken = { token: null, expires: 0 };
async function getFeishuToken() {
  if (feishuToken.token && Date.now() < feishuToken.expires) return feishuToken.token;
  const r = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }) });
  const d = await r.json();
  if (d.code !== 0) throw new Error('飞书认证失败: ' + d.msg);
  feishuToken = { token: d.tenant_access_token, expires: Date.now() + (d.expire - 300) * 1000 };
  return feishuToken.token;
}
async function feishuCreate(tableId, fields) {
  const token = await getFeishuToken();
  const r = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${tableId}/records`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ fields }) });
  const d = await r.json();
  if (d.code !== 0) throw new Error('飞书写入失败: ' + (d.msg || d.code));
  return d.data?.record;
}
async function feishuList(tableId, opts = {}) {
  const token = await getFeishuToken();
  const params = new URLSearchParams();
  if (opts.page_size) params.set('page_size', opts.page_size);
  if (opts.page_token) params.set('page_token', opts.page_token);
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${tableId}/records?${params}`;
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const d = await r.json();
  if (d.code !== 0) throw new Error('飞书读取失败: ' + (d.msg || d.code));
  return d.data;
}

// 飞书富文本字段提取纯文本
function feishuText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return val.map(x => (x && x.text) || '').join('').trim();
  return String(val).trim();
}

// === API: Analyze ===
app.post('/api/analyze', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传视频文件' });
    const videoPath = req.file.path, videoId = path.basename(videoPath, path.extname(videoPath));
    const userMemo = req.body.memo || '';
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    const send = (step, message, data = null) => { res.write(`data: ${JSON.stringify({ step, message, data })}\n\n`); };

    send(1, '视频上传成功');
    send(2, 'ffmpeg 正在预分析视频元数据...');
    const ffprobeData = ffprobeAnalyze(videoPath);
    const realDuration = ffprobeData.duration;
    const sceneChanges = ffprobeData.sceneChanges;
    console.log('[ffprobe]', JSON.stringify(ffprobeData));

    send(3, 'Gemini AI 正在分析视频结构...');

    // 动态读取飞书框架库
    let frameworkList = [];
    try {
      if (FEISHU_APP_ID && FEISHU_APP_SECRET) {
        if (frameworkCache.data && Date.now() < frameworkCache.expires) {
          frameworkList = frameworkCache.data;
        } else {
          const fdata = await feishuList(FEISHU_CONFIG.tables.framework, { page_size: 100 });
          frameworkList = (fdata.items || []).map(r => ({
            name: feishuText(r.fields['框架名称']),
            formula: feishuText(r.fields['短视频底层结构公式‼️'] || r.fields['短视频底层结构公式']),
            hookType: feishuText(r.fields['开头钩子类型']),
            logic: feishuText(r.fields['核心逻辑']),
            difficulty: feishuText(r.fields['难度']),
            level: feishuText(r.fields['内容层级']),
            scenario: feishuText(r.fields['适用场景'])
          })).filter(i => i.name);
          frameworkCache = { data: frameworkList, expires: Date.now() + 300000 };
        }
      }
    } catch (e) { console.error('框架库读取失败:', e.message); }

    // ★ V3.5.4b: 动态读取CTA行动类型选项
    let ctaActionTypes = '痛点共鸣/提问触发/结果前置/反常识/数字可信/场景代入/产品演示/对比引导/用户证言/稀缺促单/损失厌恶/社交证明/直接指令/权益利诱/对比锚定';
    try {
      if (FEISHU_APP_ID && FEISHU_APP_SECRET) {
        const token = await getFeishuToken();
        const fieldUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${FEISHU_CONFIG.tables.cta}/fields`;
        const fieldResp = await fetch(fieldUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        const fieldData = await fieldResp.json();
        if (fieldData.code === 0 && fieldData.data?.items) {
          const actionField = fieldData.data.items.find(f => f.field_name === '行动类型');
          if (actionField?.property?.options) {
            ctaActionTypes = actionField.property.options.map(o => o.name).join('/');
            console.log('[动态读取] CTA行动类型:', ctaActionTypes);
          }
        }
      }
    } catch (e) { console.error('CTA行动类型读取失败，使用默认值:', e.message); }

    // 框架注入：完整核心逻辑，不截断
    const frameworkRules = frameworkList.length > 0
      ? frameworkList.map(f => `### ${f.name}\n- 公式：${f.formula}\n- 钩子类型：${f.hookType}\n- 核心逻辑：${f.logic}\n- 适用场景：${f.scenario}\n- 难度：${f.difficulty} | 层级：${f.level}`).join('\n\n')
      : `### 经典痛点型\n- 公式：停->病->药->信->买\n### 效果前置型\n- 公式：药->停->病->药->信->买\n### 对比碾压型\n- 公式：停->A vs B->药->信->买\n### 多场景轰炸型\n- 公式：停->药->场景1->场景2->场景3->买\n### 开箱种草型\n- 公式：停(拆箱)->药->药->信->买\n### 好奇悬念型\n- 公式：停(好奇)->病->药->信->买\n### 社交证明型\n- 公式：停(他人反应)->药->病->信->买\n### 科普权威型\n- 公式：停(知识钩子)->病->药->信->买\n### 真实体验型\n- 公式：停(真实场景)->病->药->信->买\n### 剧情反转型\n- 公式：停(冲突)->病->反转->药->买`;

    const frameworkNames = frameworkList.length > 0
      ? frameworkList.map(f => f.name).join('/')
      : '经典痛点型/效果前置型/对比碾压型/多场景轰炸型/开箱种草型/好奇悬念型/社交证明型/科普权威型/真实体验型/剧情反转型';

    const videoBase64 = fs.readFileSync(videoPath).toString('base64');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const ffprobeHint = realDuration
      ? `\n## ffmpeg 预分析数据（真实值，请严格遵守）\n- 视频真实总时长：${realDuration.toFixed(2)} 秒（你输出的 total_duration_seconds 必须等于此值）\n- 视频分辨率：${ffprobeData.resolution || '未知'}\n- 帧率：${ffprobeData.fps || '未知'} fps\n- ffmpeg 检测到的场景切换时间点：${sceneChanges.length > 0 ? sceneChanges.join('s, ') + 's' : '未检测到明显场景切换'}\n`
      : '';

    const memoHint = userMemo
      ? `\n## 用户入库备注\n以下是用户的备注，仅作为分析时的关注要点提示，不要因此忽略视频其他部分的完整分析。每个库该提取的内容一个都不能少。\n备注内容：${userMemo}\n`
      : '';

    // ★★★ V3.5.4 核心 prompt ★★★
    const prompt = `你是一个专业的TikTok带货短视频拆解分析师。请对这个视频进行精确的逐镜头拆解分析，并按各素材库的填写标准提取可入库素材。

注意：输出中不要使用任何 emoji 符号。所有字段内容用纯文字。
${ffprobeHint}${memoHint}
## 关键约束
1. total_duration_seconds 必须等于 ffmpeg 检测到的真实时长（${realDuration ? realDuration.toFixed(2) : '请自行判断'}秒），不得偏差超过 0.5 秒
2. 所有镜头的 time_start/time_end 必须是精确数字，最后一个镜头的 time_end 必须等于视频总时长
3. 镜头之间不允许有时间空隙或重叠
4. 每个镜头都必须同样详细地描述，后半段不得简略
5. product_first_appear_seconds 精确到秒，未出现填 null

## 全局过滤规则
以下内容不属于视频创作内容，必须过滤：
- 平台水印：如"来抖音 发现更多创作者""抖音号:xxx""TikTok"等
- 平台强制贴片、开屏广告、推荐标签
- 非创作者主动添加的元素

## 框架判定规则（基于结构顺序而非内容品类）

${frameworkRules}

判定逻辑：看结构顺序（停病药信买的出现顺序），不看内容品类。分型归入母框架。全新结构填"新框架"。

## 公式格式规范
- 允许用括号标注步骤的变体方式，跟框架库一致，如：停(好奇)、停(真实场景)、停(冲突)
- 禁止用括号标注嵌套位置关系，如 信(in病) 是错误写法
- 如果某个步骤穿插在另一个步骤里（比如引用权威数据穿插在痛点阐述中），公式按实际出现的时间顺序写，在核心逻辑的文字描述中说明穿插关系

## ★★★ 核心概念：停病药信买 与 素材库的对应关系 ★★★

这是整个素材提取的核心逻辑，你必须严格按这个对应关系分类素材，绝对不要跨库：

| 视频步骤 | 含义 | 对应素材库 | 库里装什么 |
|---------|------|-----------|-----------|
| 停 | 前3秒让用户停下来 | CTA号召行动库（开头段） | 钩子话术 + 展示方式 + 心理机制 |
| 病 | 用户的痛在哪里 | 痛点需求场景库 | 用户侧的恐惧/焦虑/尴尬（不是产品功能） |
| 药 | 产品怎么治 | 卖点画面库 | 用什么画面证明产品好（视觉呈现方案） |
| 信 | 凭什么信你 | 社会证明库 | 第三方背书：用户评价、认证、数据（不是产品体验） |
| 买 | 促单收尾 | CTA号召行动库（结尾段）+ 权益库 | 促单话术 + 实际购买激励（折扣/赠品） |

分类判断口诀：
- 在讲用户有多惨/多焦虑/多尴尬？→ 病 → 痛点库
- 在展示产品效果/功能/使用过程？→ 药 → 卖点画面库
- 在展示第三方背书（评价/认证/数据）？→ 信 → 社会证明库
- "洗后有淡淡香气"是产品体验 → 药 → 卖点画面库（不是社会证明）
- "深层清洁"是产品功效 → 药 → 卖点画面库（不是权益）
- "买一送一"是购买激励 → 买 → 权益库
- "点击下方小黄车"是CTA话术 → 买 → CTA库结尾段（不是权益）

## 输出格式（严格 JSON，不要有多余文字）

{
  "video_overview": {
    "total_duration_seconds": 数字,
    "total_shots": 数字,
    "product_first_appear_seconds": 数字或null,
    "product_exposure_seconds": 数字,
    "product_exposure_ratio": 百分比数字
  },

  "shots": [{
    "shot_number": 数字,
    "time_start": 数字,
    "time_end": 数字,
    "shot_type": "痛点放大/产品展示/使用场景/细节特写/效果对比/行动引导/开箱展示/社交证明/情绪渲染",
    "scene_description": "详细中文画面描述（至少20字）",
    "text_overlay": "画面文字（没有则空字符串，过滤平台水印）",
    "voiceover": "口播内容（没有则空字符串）",
    "product_visible": true或false
  }],

  "script_structure": {
    "framework": "${frameworkNames}/新框架",
    "formula": "如：停->病->药->信->买",
    "hook_type": "钩子类型",
    "structure_breakdown": [{
      "element": "停/病/药/信/买",
      "time_range": "0.0-3.2s",
      "description": "具体做了什么",
      "shots_included": [编号数组]
    }],
    "new_framework_info": null
  },

  "extracted_materials": {

    "cta": [每段至少1条，三段必须都有],

    "pain_points": [对应「病」步骤],

    "selling_visuals": [对应「药」步骤],

    "social_proof": [对应「信」步骤，只有第三方背书才放这里],

    "benefits": [对应「买」步骤的权益部分，只有实际购买激励才放这里],

    "bgm": {}
  },

  "competitor_entry": {},

  "optimization_suggestions": "优化建议（至少2点）"
}

## 各素材库详细填写标准

### CTA 号召行动库（对应「停」和「买」，中间段对应「药」的话术层）
核心：话术内容 + 展示方式 + 心理机制的组合，不只是文字。
必须分三段提取，每段至少1条，不要因为用户备注提到了某一段就忽略其他段：

**开头（前3秒钩子）**：让用户停下来的话术
- 行动类型常用：痛点共鸣/提问触发/结果前置/反常识/数字可信/场景代入
- 话术逻辑要求：说明触发了什么心理反应
  正例："直说妈妈真实处境，触发'我也是'的代入感，3秒内留住人"
  反例："直接点出用户痛点，激发好奇心"（太泛，没说清心理机制）

**中间（卖点引导）**：引导用户理解产品价值的话术，通常有具体的视觉动作配合
- 行动类型常用：产品演示/对比引导/用户证言/反常识
- 话术逻辑要求：分析这段话+画面的组合为什么能说服用户，不要复述产品功效
  正例："真实对比测试，视觉证据无可辩驳，让品质可视化"
  正例："揭秘面料技术细节，建立专业感和信任，让妈妈觉得'学到了'"
  反例："通过展示产品的双重效果，满足用户期望"（这是复述功效不是分析心理机制）
- 配合画面要求：必须有具体视觉动作
  正例："分屏对比，一边起球缩水一边完好"
  正例："两种面料并排特写，手指触摸对比"
  反例："产品使用画面"（太泛）

**结尾（促单转化）**：促使用户下单的话术
- 行动类型常用：稀缺促单/损失厌恶/直接指令/权益利诱/社交证明/对比锚定
- 话术要求：必须是视频中实际出现的促单话术原文；如果视频结尾没有口播只有画面，就描述画面上的文字或视觉指令
- 话术逻辑要求：说明触发了什么购买心理
  正例："真实库存紧张制造紧迫感，'上次卖光'是最强社交证明"
  正例："触发妈妈保护焦虑，'不买=宝宝继续受苦'，保护本能驱动购买"
  反例："促使用户下单"（什么都没说）
- 如果结尾有配合权益（折扣/赠品/包邮等），在 benefit_pairing 字段写明

每条CTA格式：
{
  "text_foreign": "原始外文话术（口播或字幕原文，完整不截断）",
  "text_cn": "中文翻译",
  "stage": "开头（前3秒钩子） 或 中间（卖点引导） 或 结尾（促单转化）",
  "action_type": "${ctaActionTypes} 中选一个最匹配的",
  "psychology": "话术逻辑：为什么这句话有效，分析心理机制，不要复述话术内容",
  "visual_pairing": "配合画面：具体视觉动作描述，不要泛泛说'产品画面'",
  "benefit_pairing": "配合权益（仅结尾段需要，如'首单折扣码''90天无理由退款'，没有则空字符串）"
}
边界：
- 平台水印不是CTA
- 视频中每一段有话术的部分都要提取，不要只提取开头
- 三段都必须有，这是完整拆解一条带货视频的基本要求

### 痛点需求场景库（对应「病」）
核心：用户侧的恐惧/焦虑/尴尬，具体到行为级别。
每条格式：
{
  "scene_name": "具体行为级别场景名（如「穿脏衣服导致皮肤发痒」，不是「洗衣机脏」）",
  "scene_category": "居家日常/紧急换衣/出行遛娃/旅行出差/换季过渡/社交/约会/运动/健身/职场/办公/节日/送礼/紧急/突发/家庭/育儿",
  "user_pain": "用户真正害怕的事（穿了没洗的衣服导致皮肤发痒甚至皮肤病）",
  "emotion_keywords": ["发痒", "恶心", "担忧"],
  "product_solution": "产品如何解决这个痛点",
  "content_angle": "拍成什么类型的视频",
  "script_example": "话术示例：从视频口播或字幕中提取与这个痛点相关的原文（口播优先，口播通常更完整），什么语言就录什么语言",
  "script_example_cn": "中文翻译：如果原文是中文则与上一字段相同"
}
边界：
- 「洗衣机没清洁」不是痛点，这是产品要解决的问题
- 「穿了没洗的衣服导致皮肤病」才是痛点，这是用户害怕的后果
- 产品功效描述不归这里，归卖点画面库

### 卖点画面库（对应「药」）
核心：每个卖点该用什么画面来呈现，具体到镜头语言。
每条格式：
{
  "visual_type": "痛点视觉钩子/脏污可视化/细菌风险可视化/产品外观展示/产品使用演示/效果可视化/前后对比/极限测试/细节放大/真实反应镜头/场景演示/穿脱演示/认证展示",
  "shooting_notes": "具体镜头语言（如「微距镜头对准洗衣机内筒的黑色霉斑和水垢，慢速旋转展示污垢厚度，光线打侧光突出纹理」）",
  "purpose": "这个画面解决消费者什么心理障碍",
  "video_stage": "开头/中间/结尾/通用"
}
边界：
- 产品功效（深层清洁）、产品体验（洗后清香）都归这里，用画面呈现
- 不是文字描述产品好，是视觉上如何证明产品好

### 社会证明库（对应「信」）
核心：只有第三方背书才算。
每条格式：
{
  "proof_type": "用户好评/网红背书/权威认证/销量数据",
  "material_name": "素材名称（如「上海疾控中心调查数据」「好评截图」）",
  "usage_scenario": "具体怎么在视频里用",
  "trust_strength": "基础信任/中等信任/强信任"
}
边界：
- 「洗后有淡淡香气」是产品体验 → 归卖点画面库
- 「深层清洁杀菌」是产品功效 → 归卖点画面库
- 只有来自第三方的背书才归这里：机构数据、用户评价、认证证书、销量数字
- 如果视频里没有第三方背书，这个数组留空 []

### 权益库（对应「买」的辅助）
核心：视频中展示的实际购买激励。
每条格式：
{
  "benefit_name": "权益名称",
  "benefit_type": "折扣券/产品赠送/免费试用/专属赠品/包邮免运/延保售后/会员权益/独家内容/捆绑套装/抽奖福利",
  "description": "具体内容和价值说明",
  "script_example": "视频中的原文话术",
  "cost_level": "零成本/低成本/中成本/高成本"
}
边界：
- 「点击下方小黄车」是CTA话术，不是权益
- 「解决洗衣机脏污」是产品功效，不是权益
- 只有折扣/赠品/包邮/试用等实际购买激励才是权益
- 如果视频里没有实际购买激励，这个数组留空 []

### BGM 情绪库
{
  "mood": "紧张推进型/爽感共鸣型/轻松治愈型/流行趋势音",
  "description": "风格描述（节奏、情绪走势、配器特征，不要编造曲名或音乐人名）"
}

### 竞品爆款拆解库（competitor_entry）
{
  "title": "视频标题（直接使用视频中最显眼的标题文字或口播第一句话原文，不要自行概括改写）",
  "hook_script": "开头钩子话术完整原文（不截断，完整写出来）",
  "video_structure": "痛点揭露+解决方案/对比测试/穿搭变装/开箱展示/日常vlog/教程类/UGC买家秀/亲子互动",
  "reusable_points": "可复用亮点：必须写清「可复用模式 + 适用什么场景」（如「视觉错觉钩子+痛点强关联，开头利用与痛点相关的视觉错觉抓住注意力，可复用于任何需要强开头停留的品类」）"
}

重要：time_start 和 time_end 必须是纯数字。请先确定总时长和所有镜头切换点，再逐个填写。`;

    const result = await model.generateContent([ { text: prompt }, { inlineData: { mimeType: getMimeType(req.file.originalname), data: videoBase64 } } ]);
    const responseText = result.response.text();
    send(4, 'AI 分析完成，解析结果...');

    let analysisResult;
    try { const m = responseText.match(/\{[\s\S]*\}/); analysisResult = m ? JSON.parse(m[0]) : { raw_response: responseText, parse_error: true }; }
    catch(e) { console.error('JSON解析失败:', e.message); analysisResult = { raw_response: responseText, parse_error: true }; }

    // 后处理：时长校验
    if (analysisResult.video_overview && realDuration) {
      const aiDuration = analysisResult.video_overview.total_duration_seconds;
      if (!aiDuration || Math.abs(aiDuration - realDuration) > 1) {
        console.log(`[修正] AI时长 ${aiDuration}s -> ffprobe真实时长 ${realDuration.toFixed(2)}s`);
        analysisResult.video_overview.total_duration_seconds = parseFloat(realDuration.toFixed(2));
      }
    }

    // 产品露出占比自算
    if (analysisResult.video_overview) {
      const ov = analysisResult.video_overview;
      if (ov.total_duration_seconds > 0 && typeof ov.product_exposure_seconds === 'number') {
        ov.product_exposure_ratio = parseFloat((ov.product_exposure_seconds / ov.total_duration_seconds * 100).toFixed(1));
      }
    }

    if (!analysisResult.parse_error) analysisResult._ffprobe = ffprobeData;

    // ★ V3.5.6: 截断检测 — 检查关键字段是否完整
    if (!analysisResult.parse_error) {
      const em = analysisResult.extracted_materials || {};
      const truncationWarnings = [];
      if (!em.cta || em.cta.length === 0) truncationWarnings.push('CTA库为空');
      else {
        const stages = (em.cta || []).map(c => c.stage || '');
        if (!stages.some(s => s.includes('开头'))) truncationWarnings.push('CTA缺少开头段');
        if (!stages.some(s => s.includes('中间'))) truncationWarnings.push('CTA缺少中间段');
        if (!stages.some(s => s.includes('结尾'))) truncationWarnings.push('CTA缺少结尾段');
      }
      if (!em.pain_points || em.pain_points.length === 0) truncationWarnings.push('痛点库为空');
      if (!em.selling_visuals || em.selling_visuals.length === 0) truncationWarnings.push('卖点画面库为空');
      if (!analysisResult.competitor_entry || !analysisResult.competitor_entry.hook_script) truncationWarnings.push('竞品拆解库钩子为空');
      if (truncationWarnings.length > 0) {
        analysisResult._truncation_warning = '分析结果可能不完整: ' + truncationWarnings.join(', ') + '。建议重新分析。';
        console.log('[截断警告]', analysisResult._truncation_warning);
      }
    }

    send(5, '根据镜头时间点截帧...');
    if (analysisResult.shots && analysisResult.shots.length > 0) {
      const sf = extractShotFrames(videoPath, videoId, analysisResult.shots);
      for (let i = 0; i < analysisResult.shots.length; i++) { if (sf[i]) analysisResult.shots[i].frame_url = sf[i].url; }
    }

    send(6, '拆解完成！', { videoId, videoUrl: `/uploads/${req.file.filename}`, analysis: analysisResult });
    setTimeout(() => { try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); } catch(e){} }, 3600000);
    res.end();
  } catch (error) {
    console.error('分析失败:', error);
    if (!res.headersSent) res.status(500).json({ error: '分析失败: ' + error.message });
    else { res.write(`data: ${JSON.stringify({ step: -1, message: '分析失败: ' + error.message })}\n\n`); res.end(); }
  }
});

// === API: Rewrite ===
app.post('/api/rewrite', async (req, res) => {
  try {
    const { analysis, newCategory, productName, coreSellingPoints } = req.body;
    if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY 未配置' });
    if (!analysis || !newCategory || !productName) return res.status(400).json({ error: '缺少参数' });
    const sb = analysis.script_structure?.structure_breakdown || [];
    const shots = analysis.shots || [];
    const framework = analysis.script_structure?.framework || '未知';
    const formula = analysis.script_structure?.formula || '未知';

    const prompt = `你是TikTok带货短视频编导。基于以下爆款视频的结构分析，为新产品做板块级仿写。

## 原始视频结构
框架类型：${framework}
结构公式：${formula}
各板块分析：
${sb.map(b => `[${b.element}] ${b.time_range || ''}（${(b.shots_included || []).length}个镜头）: ${b.description || ''}`).join('\n')}

原始镜头列表（共${shots.length}个切镜）：
${shots.map(s => `#${s.shot_number} [${s.shot_type}] ${s.time_start}s-${s.time_end}s: ${s.scene_description || ''}`).join('\n')}

## 新产品信息
品类：${newCategory}
产品名称：${productName}
核心卖点：${coreSellingPoints || '无'}

## 任务
请按原视频的停病药信买板块结构，为新产品写出每个板块的仿写方向。

要求：
1. 保持原视频的板块顺序和板块数量
2. 每个板块只写概要方向（2-4句话），不要写逐镜头脚本
3. 概要方向要具体到画面
4. 全部用中文，不用emoji
5. 标注每个板块对应原视频的哪几个镜头编号

输出严格JSON：
{
  "framework": "${framework}",
  "formula": "${formula}",
  "blocks": [
    {
      "element": "停",
      "original_shots": [1, 2],
      "original_description": "原视频这个板块做了什么",
      "rewrite_direction": "新产品仿写方向（2-4句话）"
    }
  ]
}`;

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://tiktok-analyzer.zeabur.app', 'X-Title': 'TikTok Analyzer' },
      body: JSON.stringify({ model: 'anthropic/claude-sonnet-4', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
    const data = await r.json(), content = data.choices?.[0]?.message?.content || '';
    let rw;
    // ★ V3.6.1: 加强 JSON 清理，多种策略
    const cleanStrategies = [
      // 策略1: 去markdown代码块
      () => { const c = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s !== -1 && e > s) return JSON.parse(c.substring(s, e + 1)); return null; },
      // 策略2: 从 {" 开始
      () => { const s = content.indexOf('{"'), e = content.lastIndexOf('}'); if (s !== -1 && e > s) return JSON.parse(content.substring(s, e + 1)); return null; },
      // 策略3: 修复尾部逗号
      () => { const c = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s !== -1 && e > s) { let j = c.substring(s, e + 1).replace(/,\s*([}\]])/g, '$1'); return JSON.parse(j); } return null; }
    ];
    for (const strategy of cleanStrategies) {
      try { const result = strategy(); if (result && result.blocks) { rw = result; break; } } catch (e) {}
    }
    if (!rw) { console.error('rewrite JSON解析失败，原始内容前300字:', content.substring(0, 300)); rw = { raw_response: content }; }
    res.json({ success: true, rewrite: rw });
  } catch (error) { console.error('改写失败:', error); res.status(500).json({ error: '改写失败: ' + error.message }); }
});

// === API: Expand ===
app.post('/api/expand', async (req, res) => {
  try {
    const { originalShots, structureBreakdown, rewriteBlocks, productName, category } = req.body;
    if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY 未配置' });
    if (!originalShots || !rewriteBlocks) return res.status(400).json({ error: '缺少参数' });

    const prompt = `你是TikTok带货短视频编导。把板块级仿写方向扩展为逐镜头分镜脚本。

## 核心规则
1. 新脚本镜头数 = 原视频镜头数（${originalShots.length}个）
2. 每个镜头角色标签跟原视频一致
3. 时长比例参考原视频
4. 只替换画面内容

## 原视频镜头
${originalShots.map(s => `#${s.shot_number} [${s._role || '无'}] [${s.shot_type}] ${s.time_start}s-${s.time_end}s: ${s.scene_description || ''}`).join('\n')}

## 仿写方向
${rewriteBlocks.map(b => `[${b.element}]（镜头 ${(b.original_shots || []).join(',')}）:\n${b.rewrite_direction}`).join('\n\n')}

## 新产品
品类：${category || ''}
产品名称：${productName || ''}

全部中文，不用emoji，输出严格JSON：
{
  "shots": [
    {
      "index": 1,
      "role": "停/病/药/信/买",
      "scene_description_cn": "画面描述（至少15字）",
      "voiceover_cn": "口播文案",
      "text_overlay": "画面文字",
      "shooting_notes": "拍摄建议",
      "time_ref": "0-1.5s"
    }
  ]
}`;

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://tiktok-analyzer.zeabur.app', 'X-Title': 'TikTok Analyzer' },
      body: JSON.stringify({ model: 'anthropic/claude-sonnet-4', max_tokens: 8192, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
    const data = await r.json(), content = data.choices?.[0]?.message?.content || '';
    let result;
    const cleanStrats = [
      () => { const c = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s !== -1 && e > s) return JSON.parse(c.substring(s, e + 1)); return null; },
      () => { const s = content.indexOf('{"'), e = content.lastIndexOf('}'); if (s !== -1 && e > s) return JSON.parse(content.substring(s, e + 1)); return null; },
      () => { const c = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s !== -1 && e > s) { let j = c.substring(s, e + 1).replace(/,\s*([}\]])/g, '$1'); return JSON.parse(j); } return null; }
    ];
    for (const strat of cleanStrats) {
      try { const r = strat(); if (r && r.shots) { result = r; break; } } catch (e) {}
    }
    if (!result) { console.error('expand JSON解析失败，前300字:', content.substring(0, 300)); result = { raw_response: content }; }
    res.json({ success: true, expand: result });
  } catch (error) { console.error('扩展失败:', error); res.status(500).json({ error: '扩展失败: ' + error.message }); }
});

// === API: Feishu Save ★ V3.5.4 字段名全部对齐飞书实际表结构 ===
app.post('/api/save-to-feishu', async (req, res) => {
  try {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return res.status(500).json({ error: '飞书凭证未配置' });
    const { analysis, videoCode, videoUrl, filename, libs } = req.body;
    if (!analysis) return res.status(400).json({ error: '缺少分析数据' });
    const a = analysis, ov = a.video_overview||{}, ss = a.script_structure||{}, em = a.extracted_materials||{};
    const ce = a.competitor_entry || {};
    const results = { saved: [], errors: [] };
    const videoLink = videoUrl ? { link: videoUrl, text: videoUrl } : undefined;
    const source = filename || '未命名';

    const selectedLibs = (libs || []).map(l => l.lib);
    const shouldSave = (lib) => !libs || selectedLibs.includes(lib);
    const getNote = (lib) => { const l = (libs || []).find(x => x.lib === lib); return l ? l.note : ''; };

    // 1. 竞品爆款拆解库 — 自动入库
    // 飞书实际字段：视频标题/描述(文本), 钩子话术(文本), 视频结构(单选), 使用BGM(文本), 可复用点(文本), 适用品类(多选), 拆解状态(单选), 拆解时间(日期), 视频编码(文本), 视频文件地址(链接)
    if (shouldSave('competitor')) {
      try {
        const hookScript = ce.hook_script || '';
        const reuse = ce.reusable_points || '';
        const bgmDesc = em.bgm ? `${em.bgm.mood||''} - ${em.bgm.description||''}` : '';
        // 视频结构是单选，选项值必须匹配飞书里的选项
        const structureMap = { '经典痛点型': '痛点揭露+解决方案', '效果前置型': '痛点揭露+解决方案', '好奇悬念型': '教程类', '科普权威型': '教程类', '对比碾压型': '对比测试', '开箱种草型': '开箱展示', '真实体验型': '日常vlog', '社交证明型': 'UGC买家秀', '多场景轰炸型': '痛点揭露+解决方案', '剧情反转型': '痛点揭露+解决方案' };
        const videoStructure = ce.video_structure || structureMap[ss.framework] || '痛点揭露+解决方案';

        await feishuCreate(FEISHU_CONFIG.tables.competitor, {
          '视频标题/描述': ce.title || source,
          '视频编码': videoCode || '',
          '钩子话术': hookScript,
          '视频结构': videoStructure,
          '使用BGM': bgmDesc,
          '可复用点': reuse,
          '拆解状态': '已拆解',
          '拆解时间': Date.now(),
          ...(videoLink ? { '视频文件地址': videoLink } : {})
        });
        results.saved.push({ table: '竞品爆款拆解库' });
      } catch(e) { results.errors.push({ table: '竞品爆款拆解库', error: e.message }); }
    }

    // 2. CTA库
    // 飞书实际字段：CTA话术（外文）(文本), 中文翻译(文本), 视频阶段(单选), 行动类型(单选), 话术逻辑(文本), 配合权益(文本), 配合画面(文本), 适用品类(多选), 参考视频链接(链接)
    if (shouldSave('cta')) {
      for (const c of (em.cta || [])) {
        try {
          await feishuCreate(FEISHU_CONFIG.tables.cta, {
            'CTA话术（外文）': c.text_foreign || '',
            '中文翻译': c.text_cn || '',
            '视频阶段': c.stage || '开头（前3秒钩子）',
            '行动类型': c.action_type || '',
            '话术逻辑': c.psychology || '',
            '配合画面': c.visual_pairing || '',
            '配合权益': c.benefit_pairing || '',
            ...(videoLink ? { '参考视频链接': videoLink } : {})
          });
          results.saved.push({ table: 'CTA库' });
        } catch(e) { results.errors.push({ table: 'CTA库', error: e.message }); }
      }
    }

    // 3. 痛点库
    // 飞书实际字段：场景名称(文本), 场景分类(单选), 用户痛点(文本), 情绪关键词(多选!), 产品切入点(文本), 内容角度建议(文本), 话术示例（英文）(文本), 中文翻译(文本), 来源(单选), 关联视频链接(链接)
    if (shouldSave('painpoint')) {
      for (const p of (em.pain_points || [])) {
        try {
          const emotionArr = Array.isArray(p.emotion_keywords) ? p.emotion_keywords : [];
          await feishuCreate(FEISHU_CONFIG.tables.painpoint, {
            '场景名称': p.scene_name || '',
            '场景分类': p.scene_category || '',
            '用户痛点': p.user_pain || '',
            '情绪关键词': emotionArr,
            '产品切入点': p.product_solution || '',
            '内容角度建议': p.content_angle || '',
            '话术示例（英文）': p.script_example || '',
            '中文翻译': p.script_example_cn || '',
            '来源': 'TikTok爆款',
            ...(videoLink ? { '关联视频链接': videoLink } : {})
          });
          results.saved.push({ table: '痛点库' });
        } catch(e) { results.errors.push({ table: '痛点库', error: e.message }); }
      }
    }

    // 4. 卖点画面库
    // 飞书实际字段：拍摄说明(文本,主键), 画面类型(单选), 作用(文本), 配合视频阶段(单选), 适用品类(多选), 参考视频链接(链接)
    if (shouldSave('sellingpt')) {
      for (const s of (em.selling_visuals || [])) {
        try {
          await feishuCreate(FEISHU_CONFIG.tables.sellingpt, {
            '拍摄说明': s.shooting_notes || '',
            '画面类型': s.visual_type || '',
            '作用': s.purpose || '',
            '配合视频阶段': s.video_stage || '中间',
            ...(videoLink ? { '参考视频链接': videoLink } : {})
          });
          results.saved.push({ table: '卖点库' });
        } catch(e) { results.errors.push({ table: '卖点库', error: e.message }); }
      }
    }

    // 5. 社会证明库
    // 飞书实际字段：素材名称(文本,主键), 证明类型(单选), 素材来源(单选), 使用场景说明(文本), 信任强度(单选), 备注(文本)
    if (shouldSave('socialproof')) {
      for (const s of (em.social_proof || [])) {
        try {
          await feishuCreate(FEISHU_CONFIG.tables.socialproof, {
            '素材名称': s.material_name || '',
            '证明类型': s.proof_type || '',
            '使用场景说明': s.usage_scenario || '',
            '信任强度': s.trust_strength || ''
          });
          results.saved.push({ table: '社会证明库' });
        } catch(e) { results.errors.push({ table: '社会证明库', error: e.message }); }
      }
    }

    // 6. 权益库
    // 飞书实际字段：权益名称(文本,主键), 权益类型(单选), 权益描述(文本), 适用场景(多选), 成本等级(单选), 组合建议(文本), 话术示例(文本), 适用品类(多选)
    if (shouldSave('benefit')) {
      for (const b of (em.benefits || [])) {
        try {
          await feishuCreate(FEISHU_CONFIG.tables.benefit, {
            '权益名称': b.benefit_name || '',
            '权益类型': b.benefit_type || '',
            '权益描述': b.description || '',
            '话术示例': b.script_example || '',
            '成本等级': b.cost_level || '',
            '适用场景': ['竞品参考']
          });
          results.saved.push({ table: '权益库' });
        } catch(e) { results.errors.push({ table: '权益库', error: e.message }); }
      }
    }

    // 7. BGM情绪库
    // 飞书实际字段：BGM名称(文本,主键), 情绪类型(单选), 适用内容(文本), 特征(文本!不是特征描述), 关联视频链接(链接)
    if (shouldSave('bgm') && em.bgm && em.bgm.mood) {
      try {
        await feishuCreate(FEISHU_CONFIG.tables.bgm, {
          'BGM名称': '待识别（需手动填写）',
          '情绪类型': em.bgm.mood || '',
          '适用内容': ss.framework || '',
          '特征': em.bgm.description || '',
          ...(videoLink ? { '关联视频链接': videoLink } : {})
        });
        results.saved.push({ table: 'BGM库' });
      } catch(e) { results.errors.push({ table: 'BGM库', error: e.message }); }
    }

    res.json({ success: results.errors.length === 0, message: `写入完成：${results.saved.length}条成功${results.errors.length > 0 ? '，' + results.errors.length + '条失败' : ''}`, results });
  } catch (error) { console.error('飞书入库失败:', error); res.status(500).json({ error: '飞书入库失败: ' + error.message }); }
});

// === API: Feishu BGM ===
app.get('/api/feishu/bgm', async (req, res) => {
  try {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return res.status(500).json({ error: '飞书未配置' });
    const data = await feishuList(FEISHU_CONFIG.tables.bgm, { page_size: 100 });
    const items = (data.items || []).map(r => ({
      name: feishuText(r.fields['BGM名称']),
      mood: feishuText(r.fields['情绪类型']),
      content: feishuText(r.fields['适用内容']),
      description: feishuText(r.fields['特征'])
    })).filter(i => i.name);
    res.json({ success: true, bgm: items });
  } catch (e) { console.error('BGM读取失败:', e); res.status(500).json({ error: e.message }); }
});

// === API: 框架库 ===
let frameworkCache = { data: null, expires: 0 };
app.get('/api/feishu/frameworks', async (req, res) => {
  try {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return res.status(500).json({ error: '飞书未配置' });
    if (frameworkCache.data && Date.now() < frameworkCache.expires) return res.json({ success: true, frameworks: frameworkCache.data });
    const data = await feishuList(FEISHU_CONFIG.tables.framework, { page_size: 100 });
    const items = (data.items || []).map(r => ({
      name: feishuText(r.fields['框架名称']),
      formula: feishuText(r.fields['短视频底层结构公式‼️'] || r.fields['短视频底层结构公式']),
      hookType: feishuText(r.fields['开头钩子类型']),
      logic: feishuText(r.fields['核心逻辑']),
      difficulty: feishuText(r.fields['难度']),
      level: feishuText(r.fields['内容层级']),
      scenario: feishuText(r.fields['适用场景'])
    })).filter(i => i.name);
    frameworkCache = { data: items, expires: Date.now() + 300000 };
    res.json({ success: true, frameworks: items });
  } catch (e) { console.error('框架库读取失败:', e); res.status(500).json({ error: e.message }); }
});

app.post('/api/feishu/framework/create', async (req, res) => {
  try {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return res.status(500).json({ error: '飞书未配置' });
    const { name, formula, hookType, logic, scenario, difficulty, level } = req.body;
    if (!name || !formula) return res.status(400).json({ error: '缺少框架名称或公式' });
    const record = await feishuCreate(FEISHU_CONFIG.tables.framework, {
      '框架名称': name, '短视频底层结构公式‼️': formula, '开头钩子类型': hookType || '',
      '核心逻辑': logic || '', '适用场景': scenario || '', '难度': difficulty || '', '内容层级': level || ''
    });
    frameworkCache = { data: null, expires: 0 };
    res.json({ success: true, record });
  } catch (e) { console.error('框架入库失败:', e); res.status(500).json({ error: e.message }); }
});

// === Image Gen (关键帧生成) ★ V3.6.7: Nano Banana 走 Google 原生 API ===
const IMAGEGEN_MODELS = [
  { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', tier: '优质', price: '~$0.02-0.04/张', apiType: 'google', supportsRef: true },
  { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2', tier: '性价比', price: '~$0.01/张', apiType: 'google', supportsRef: true },
  { id: 'bytedance-seed/seedream-4.5', name: 'Seedream 4.5', tier: '廉价', price: '$0.04/张', apiType: 'openrouter', modalities: ['image'], supportsRef: false },
  { id: 'black-forest-labs/flux.2-klein-4b', name: 'FLUX.2 Klein', tier: '最快', price: '$0.014/MP', apiType: 'openrouter', modalities: ['image'], supportsRef: false }
];

app.get('/api/imagegen/models', (req, res) => {
  res.json({ success: true, models: IMAGEGEN_MODELS.map(m => ({
    ...m,
    available: m.apiType === 'google' ? !!GEMINI_API_KEY : !!OPENROUTER_API_KEY
  })) });
});

// Google 原生 SDK 图片生成
async function generateWithGoogle(prompt, modelId, aspectRatio, referenceImages) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // 构建 contents：文字 + 参考图
  const contents = [];
  // 先放参考图
  const refImgs = Array.isArray(referenceImages) ? referenceImages : [];
  for (const img of refImgs) {
    if (!img) continue;
    // 解析 base64 data URL
    const match = img.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      contents.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } });
    }
  }
  if (refImgs.length > 0) console.log('[ImageGen/Google] 注入参考图:', refImgs.length, '张');
  // 再放文字 prompt
  contents.push(prompt);

  const config = {
    responseModalities: ['TEXT', 'IMAGE'],
  };
  if (aspectRatio) {
    config.imageConfig = { aspectRatio: aspectRatio };
  }

  const response = await ai.models.generateContent({
    model: modelId,
    contents: contents,
    config: config
  });

  // 从 response 提取图片
  let imageUrl = null;
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }
  }
  return imageUrl;
}

// OpenRouter 图片生成（Seedream/FLUX）
async function generateWithOpenRouter(prompt, model, aspectRatio) {
  const body = {
    model: model.id,
    messages: [{ role: 'user', content: prompt }],
    modalities: model.modalities
  };
  if (aspectRatio) {
    body.image_config = { aspect_ratio: aspectRatio };
  }

  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://tiktok-analyzer.zeabur.app',
      'X-Title': 'TikTok Analyzer'
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error('图片生成失败: HTTP ' + r.status + ' ' + errText.substring(0, 100));
  }

  const data = await r.json();
  const choice = data.choices?.[0]?.message;
  let imageUrl = null;
  if (choice?.images?.length > 0) {
    imageUrl = choice.images[0].image_url?.url || choice.images[0].url || null;
  }
  if (!imageUrl && choice?.content) {
    const b64Match = (typeof choice.content === 'string' ? choice.content : '').match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
    if (b64Match) imageUrl = b64Match[0];
  }
  return imageUrl;
}

app.post('/api/imagegen/generate', async (req, res) => {
  try {
    const { prompt, modelId, aspectRatio, referenceImages } = req.body;
    if (!prompt) return res.status(400).json({ error: '缺少 prompt' });

    const model = IMAGEGEN_MODELS.find(m => m.id === modelId) || IMAGEGEN_MODELS[1];
    console.log('[ImageGen] 模型:', model.id, '路径:', model.apiType, '比例:', aspectRatio || '默认');

    let imageUrl = null;

    if (model.apiType === 'google') {
      if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY 未配置' });
      const refImgs = (Array.isArray(referenceImages) ? referenceImages : []).filter(Boolean);
      imageUrl = await generateWithGoogle(prompt, model.id, aspectRatio, refImgs);
    } else {
      if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY 未配置' });
      imageUrl = await generateWithOpenRouter(prompt, model, aspectRatio);
    }

    if (!imageUrl) {
      return res.json({ success: false, error: '模型未返回图片，请重试或换一个模型' });
    }

    res.json({ success: true, imageUrl, model: model.name });
  } catch (e) {
    console.error('图片生成失败:', e);
    res.status(500).json({ error: '图片生成失败: ' + e.message });
  }
});

// === Video Gen ===
app.get('/api/videogen/platforms', (req, res) => {
  res.json({ platforms: [
    { id: 'kie', name: 'Kie.ai', available: !!KIE_API_KEY, models: [{ id: 'veo3_fast', name: 'Veo 3.1 Fast', price: '~$0.30/8s', speed: '快', quality: '标准' }, { id: 'veo3', name: 'Veo 3.1 Quality', price: '~$2.00/8s', speed: '慢', quality: '高' }] },
    { id: 'fal', name: 'fal.ai', available: !!FAL_API_KEY, models: [{ id: 'fal-ai/veo3/fast', name: 'Veo 3 Fast', price: '~$0.10-0.15/s', speed: '快', quality: '标准' }, { id: 'fal-ai/veo3', name: 'Veo 3 Quality', price: '~$0.20-0.40/s', speed: '慢', quality: '高' }] }
  ] });
});
const videoTasks = new Map();
async function kieGenerate(prompt, model, aspectRatio) { const r = await fetch('https://api.kie.ai/api/v1/veo/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIE_API_KEY}` }, body: JSON.stringify({ prompt, model: model || 'veo3_fast', aspect_ratio: aspectRatio || '9:16', watermark: '', enableTranslation: true }) }); const d = await r.json(); if (d.code !== 200 && d.code !== 0) throw new Error('Kie.ai 提交失败: ' + (d.msg || JSON.stringify(d))); return { taskId: d.data?.task_id || d.task_id, platform: 'kie' }; }
async function kieGetStatus(taskId) { const r = await fetch(`https://api.kie.ai/api/v1/veo/record-detail?taskId=${taskId}`, { headers: { 'Authorization': `Bearer ${KIE_API_KEY}` } }); const d = await r.json(); const status = d.data?.status || d.data?.task_status || 'unknown'; const isComplete = status === 'completed' || status === 'success' || !!d.data?.video_url; const isFailed = status === 'failed' || status === 'error'; return { status: isComplete ? 'completed' : isFailed ? 'failed' : 'processing', videoUrl: d.data?.video_url || d.data?.output?.video_url || null, coverUrl: d.data?.image_url || d.data?.cover_url || null, raw: d.data }; }
async function falGenerate(prompt, model, aspectRatio) { const endpoint = model || 'fal-ai/veo3/fast'; const r = await fetch(`https://queue.fal.run/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${FAL_API_KEY}` }, body: JSON.stringify({ prompt, aspect_ratio: aspectRatio || '9:16', duration: '8s', resolution: '720p', generate_audio: true }) }); if (!r.ok) { const e = await r.text(); throw new Error('fal.ai 提交失败: ' + e); } const d = await r.json(); return { taskId: d.request_id, platform: 'fal', endpoint }; }
async function falGetStatus(taskId, endpoint) { const r = await fetch(`https://queue.fal.run/${endpoint}/requests/${taskId}/status`, { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }); const d = await r.json(); if (d.status === 'COMPLETED') { const rr = await fetch(`https://queue.fal.run/${endpoint}/requests/${taskId}`, { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }); const result = await rr.json(); return { status: 'completed', videoUrl: result.video?.url || null, coverUrl: null, raw: result }; } if (d.status === 'FAILED') return { status: 'failed', videoUrl: null, raw: d }; return { status: 'processing', videoUrl: null, raw: d }; }
app.post('/api/videogen/generate', async (req, res) => { try { const { prompt, platform, model, aspectRatio } = req.body; if (!prompt) return res.status(400).json({ error: '缺少 prompt' }); let result; if (platform === 'fal') { if (!FAL_API_KEY) return res.status(500).json({ error: 'FAL_API_KEY 未配置' }); result = await falGenerate(prompt, model, aspectRatio); } else { if (!KIE_API_KEY) return res.status(500).json({ error: 'KIE_API_KEY 未配置' }); result = await kieGenerate(prompt, model, aspectRatio); } const taskKey = `${result.platform}_${result.taskId}`; videoTasks.set(taskKey, { ...result, createdAt: Date.now(), prompt }); setTimeout(() => videoTasks.delete(taskKey), 7200000); res.json({ success: true, taskId: result.taskId, platform: result.platform, taskKey }); } catch (e) { console.error('视频生成提交失败:', e); res.status(500).json({ error: e.message }); } });
app.get('/api/videogen/status/:taskKey', async (req, res) => { try { const { taskKey } = req.params; const task = videoTasks.get(taskKey); if (!task) return res.status(404).json({ error: '任务不存在或已过期' }); let status; if (task.platform === 'fal') { status = await falGetStatus(task.taskId, task.endpoint); } else { status = await kieGetStatus(task.taskId); } res.json({ success: true, ...status, taskKey }); } catch (e) { console.error('状态查询失败:', e); res.status(500).json({ error: e.message }); } });

app.get('/api/health', (req, res) => {
  let ffmpeg = false; try { execSync('ffmpeg -version', { stdio:'pipe', timeout:5000 }); ffmpeg = true; } catch(e) {}
  res.json({ status: 'ok', timestamp: new Date().toISOString(), services: { gemini: !!GEMINI_API_KEY, openrouter: !!OPENROUTER_API_KEY, feishu: !!(FEISHU_APP_ID&&FEISHU_APP_SECRET), ffmpeg, kie: !!KIE_API_KEY, fal: !!FAL_API_KEY } });
});

app.listen(PORT, () => { console.log(`Server http://localhost:${PORT}  Gemini:${GEMINI_API_KEY?'OK':'NO'} OpenRouter:${OPENROUTER_API_KEY?'OK':'NO'} Feishu:${FEISHU_APP_ID?'OK':'NO'} Kie:${KIE_API_KEY?'OK':'NO'} Fal:${FAL_API_KEY?'OK':'NO'}`); });
