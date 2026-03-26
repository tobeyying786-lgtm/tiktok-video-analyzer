require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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

/**
 * ffmpeg 预分析：获取真实时长 + 场景切换时间点
 */
function ffprobeAnalyze(videoPath) {
  const result = { duration: null, sceneChanges: [], fps: null, resolution: null };
  try {
    const probeJson = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`,
      { timeout: 30000, stdio: 'pipe' }
    ).toString();
    const probe = JSON.parse(probeJson);
    const fmt = probe.format || {};
    result.duration = parseFloat(fmt.duration) || null;
    const vs = (probe.streams || []).find(s => s.codec_type === 'video');
    if (vs) {
      result.resolution = `${vs.width}x${vs.height}`;
      if (vs.r_frame_rate) {
        const [num, den] = vs.r_frame_rate.split('/');
        result.fps = den ? Math.round(parseInt(num) / parseInt(den)) : parseInt(num);
      }
    }
  } catch (e) {
    console.error('ffprobe 元数据获取失败:', e.message);
  }
  try {
    const sceneOutput = execSync(
      `ffmpeg -i "${videoPath}" -filter:v "select='gt(scene,0.3)',showinfo" -f null - 2>&1 | grep showinfo | grep pts_time`,
      { timeout: 60000, shell: true, stdio: 'pipe' }
    ).toString();
    const timeRegex = /pts_time:(\d+\.?\d*)/g;
    let match;
    while ((match = timeRegex.exec(sceneOutput)) !== null) {
      result.sceneChanges.push(parseFloat(parseFloat(match[1]).toFixed(2)));
    }
  } catch (e) {
    console.log('ffmpeg scene detect: 无场景切换或命令失败');
  }
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

// === API: Analyze ===
app.post('/api/analyze', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传视频文件' });
    const videoPath = req.file.path, videoId = path.basename(videoPath, path.extname(videoPath));
    const userMemo = req.body.memo || '';
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    const send = (step, message, data = null) => { res.write(`data: ${JSON.stringify({ step, message, data })}\n\n`); };

    send(1, '📁 视频上传成功');

    send(2, '🔍 ffmpeg 正在预分析视频元数据...');
    const ffprobeData = ffprobeAnalyze(videoPath);
    const realDuration = ffprobeData.duration;
    const sceneChanges = ffprobeData.sceneChanges;
    console.log('[ffprobe]', JSON.stringify(ffprobeData));

    send(3, '🤖 Gemini AI 正在分析视频结构...');

    // ★ 动态读取飞书框架库
    let frameworkList = [];
    try {
      if (FEISHU_APP_ID && FEISHU_APP_SECRET) {
        if (frameworkCache.data && Date.now() < frameworkCache.expires) {
          frameworkList = frameworkCache.data;
        } else {
          const fdata = await feishuList(FEISHU_CONFIG.tables.framework, { page_size: 100 });
          frameworkList = (fdata.items || []).map(r => ({
            name: r.fields['框架名称'] || '',
            formula: r.fields['短视频底层结构公式‼️'] || r.fields['短视频底层结构公式'] || '',
            hookType: r.fields['开头钩子类型'] || '',
            logic: r.fields['核心逻辑'] || '',
            difficulty: r.fields['难度'] || '',
            level: r.fields['内容层级'] || '',
            scenario: r.fields['适用场景'] || ''
          })).filter(i => i.name);
          frameworkCache = { data: frameworkList, expires: Date.now() + 300000 };
        }
      }
    } catch (e) {
      console.error('框架库读取失败，使用空列表:', e.message);
    }

    // ★ V3.5.3: 框架注入不再截断核心逻辑，给完整内容
    const frameworkRules = frameworkList.length > 0
      ? frameworkList.map(f => {
          // 飞书富文本字段可能是数组，需要拼接
          const logic = typeof f.logic === 'string' ? f.logic : (Array.isArray(f.logic) ? f.logic.map(x => x.text || '').join('') : String(f.logic || ''));
          const scenario = typeof f.scenario === 'string' ? f.scenario : (Array.isArray(f.scenario) ? f.scenario.map(x => x.text || '').join('') : String(f.scenario || ''));
          return `### ${f.name}\n- 公式：${f.formula}\n- 钩子类型：${f.hookType}\n- 核心逻辑：${logic.trim()}\n- 适用场景：${scenario.trim()}\n- 难度：${f.difficulty} | 层级：${f.level}`;
        }).join('\n\n')
      : `### 经典痛点型\n- 公式：停→病→药→信→买\n- 先展示痛点场景，再引出产品作为解决方案\n### 效果前置型\n- 公式：药→停→病→药→信→买\n- 开头直接展示产品效果/结果，再回头讲痛点\n### 对比碾压型\n- 公式：停→A vs B→药→信→买\n- 核心有明确的 A vs B 对比环节\n### 多场景轰炸型\n- 公式：停→药→场景1→场景2→场景3→买\n- 展示产品在多个不同场景下使用\n### 开箱种草型\n- 公式：停(拆箱)→药→药→信→买\n- 以拆箱/拆包为主线\n### 好奇悬念型\n- 公式：停(好奇)→病→药→信→买\n- 开头制造好奇/悬念留人\n### 社交证明型\n- 公式：停(他人反应)→药→病→信→买\n- 开头展示他人反应/评价\n### 科普权威型\n- 公式：停(知识钩子)→病→药→信→买\n- 以知识/科普切入\n### 真实体验型\n- 公式：停(真实场景)→病→药→信→买\n- 以真实使用场景/日常开始\n### 剧情反转型\n- 公式：停(冲突)→病→反转→药→买\n- 有明确剧情冲突和反转`;

    const frameworkNames = frameworkList.length > 0
      ? frameworkList.map(f => {
          const name = typeof f.name === 'string' ? f.name : (Array.isArray(f.name) ? f.name.map(x => x.text || '').join('') : String(f.name || ''));
          return name;
        }).join('/')
      : '经典痛点型/效果前置型/对比碾压型/多场景轰炸型/开箱种草型/好奇悬念型/社交证明型/科普权威型/真实体验型/剧情反转型';

    const videoBase64 = fs.readFileSync(videoPath).toString('base64');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const ffprobeHint = realDuration
      ? `\n## ffmpeg 预分析数据（真实值，请严格遵守）\n- 视频真实总时长：${realDuration.toFixed(2)} 秒（你输出的 total_duration_seconds 必须等于此值）\n- 视频分辨率：${ffprobeData.resolution || '未知'}\n- 帧率：${ffprobeData.fps || '未知'} fps\n- ffmpeg 检测到的场景切换时间点（仅供参考，你需要根据实际内容微调）：${sceneChanges.length > 0 ? sceneChanges.join('s, ') + 's' : '未检测到明显场景切换'}\n`
      : '';

    const memoHint = userMemo
      ? `\n## 用户入库备注（在分析和素材提取时重点关注，但不要忽略其他部分）\n${userMemo}\n`
      : '';

    // ★★★ V3.5.3 核心改动：全面重写 prompt ★★★
    const prompt = `你是一个专业的TikTok带货短视频拆解分析师。请对这个视频进行精确的逐镜头拆解分析，并按各素材库的填写标准提取可入库素材。
${ffprobeHint}${memoHint}
## 关键约束（必须严格遵守）
1. total_duration_seconds 必须等于 ffmpeg 检测到的真实时长（${realDuration ? realDuration.toFixed(2) : '请自行判断'}秒），不得偏差超过 0.5 秒
2. 所有镜头的 time_start/time_end 必须是精确数字（不是字符串），最后一个镜头的 time_end 必须等于视频总时长
3. 镜头之间不允许有时间空隙或重叠：第 N+1 个镜头的 time_start 必须等于第 N 个镜头的 time_end
4. 每个镜头都必须同样详细地描述，后半段镜头的描述不得比前半段简略——越到后面越重要（结尾促单、CTA、信任建设等往往在后半段）
5. product_first_appear_seconds 必须精确到秒，如果产品从未出现则填 null

## 全局过滤规则（非常重要）
以下内容不属于视频创作内容，必须在所有素材提取中过滤掉：
- 平台水印文字，如"来抖音 发现更多创作者""抖音号:xxx""TikTok"等
- 平台强制贴片，如开屏广告、平台推荐标签
- 非视频创作者主动添加的元素

## 框架判定规则（基于结构顺序而非内容品类）

${frameworkRules}

**判定逻辑：**
- 看的是「结构顺序」（停病药信买的出现顺序），不是看内容品类
- 如果视频结构是某种框架的分型（如停→病→病→病→药→信→买仍然是经典痛点型），归入该框架
- 如果确实是全新的结构组合，framework 字段填"新框架"，并在 formula 中写出实际的结构公式，同时在 new_framework_info 中填写完整信息供入库

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
    "formula": "如：停→病→药→信→买",
    "hook_type": "钩子类型",
    "structure_breakdown": [{
      "element": "停/病/药/信/买",
      "time_range": "0.0-3.2s",
      "description": "具体做了什么",
      "shots_included": [编号数组]
    }],
    "new_framework_info": null 或 {
      "name": "框架名称",
      "formula": "完整公式",
      "hook_type": "钩子类型",
      "logic": "核心逻辑（详细描述每一步做什么，至少50字）",
      "scenario": "适用场景",
      "difficulty": "入门/进阶/高阶",
      "level": "1.0强痛点/2.0兴趣科普/3.0冲突反转/4.0真实感/通用"
    }
  },

  "extracted_materials": {

    "cta": [
      {
        "text_foreign": "原始外文话术（口播或字幕原文）",
        "text_cn": "中文翻译",
        "stage": "开头（前3秒钩子）或 中间（卖点引导）或 结尾（促单转化）",
        "action_type": "行动类型（见下方枚举）",
        "psychology": "话术逻辑：为什么这句话能留住人/促单，心理机制是什么",
        "visual_pairing": "配合画面：这句话出现时屏幕上是什么画面"
      }
    ],

    "pain_points": [
      {
        "scene_name": "具体到行为级别的场景名称",
        "scene_category": "场景分类",
        "user_pain": "用户真正恐惧/焦虑的事",
        "emotion_keywords": ["情绪词"],
        "product_solution": "产品如何解决这个痛点",
        "content_angle": "内容角度建议：拍成什么类型的视频"
      }
    ],

    "selling_visuals": [
      {
        "visual_type": "画面类型",
        "shooting_notes": "具体到镜头语言的拍摄说明",
        "purpose": "这个画面解决消费者什么心理障碍",
        "video_stage": "开头/中间/结尾/通用"
      }
    ],

    "social_proof": [
      {
        "proof_type": "用户好评/网红背书/权威认证/销量数据",
        "material_name": "素材名称",
        "usage_scenario": "具体怎么在视频里用",
        "trust_strength": "⭐⭐ 中等信任 或 ⭐⭐⭐ 强信任"
      }
    ],

    "benefits": [
      {
        "benefit_name": "权益名称",
        "benefit_type": "折扣券/产品赠送/免费试用/专属赠品/包邮免运/延保售后/会员权益/独家内容/捆绑套装/抽奖福利",
        "description": "具体内容和价值说明",
        "script_example": "视频中怎么讲的（原文）",
        "cost_level": "零成本/低成本/中成本/高成本"
      }
    ],

    "bgm": {
      "mood": "紧张推进型/爽感共鸣型/轻松治愈型/流行趋势音",
      "description": "风格描述（节奏、情绪走势、配器特征）"
    }
  },

  "competitor_entry": {
    "title": "视频标题/描述（一句话概括视频内容）",
    "hook_script": "开头钩子话术原文",
    "video_structure": "视频结构类型",
    "reusable_points": "可复用亮点（必须写清'可复用模式 + 适用什么场景'）"
  },

  "optimization_suggestions": "优化建议（至少2点）"
}

## ★★★ 各素材库的填写标准和边界（非常重要，决定提取质量）★★★

### CTA 号召行动库
**定义**：话术内容 + 展示方式 + 心理机制的组合，不只是文字。
**分三段提取**：
- 开头（前3秒钩子）：让用户停下来的话术
- 中间（卖点引导）：引导用户理解产品价值的话术
- 结尾（促单转化）：促使用户下单的话术
**行动类型枚举**：
- 开头常用：痛点共鸣 / 提问触发 / 结果前置 / 反常识 / 数字可信 / 场景代入
- 结尾常用：稀缺促单 / 损失厌恶 / 直接指令 / 权益利诱
**每条必须包含**：
- text_foreign：原始外文话术
- text_cn：中文翻译
- psychology：心理机制（如"用问句触发对号入座，大脑会自动回答'是/不是'，从而停留观看"）
- visual_pairing：配合什么画面（如"宝宝在换衣台上扭动挣扎的真实画面"）
**边界**：
- ❌ 平台水印不是CTA（如"来抖音 发现更多创作者""抖音号:xxx"）
- ❌ 场景描述不是CTA（场景归痛点库）
- ✅ CTA = 话术+展示方式的组合效果

### 痛点需求场景库
**定义**：具体到行为级别的用户痛点场景，用于触发情绪共鸣。
**填写标准**：
- scene_name：必须具体到行为级别（✅"Daycare早晨赶时间穿搭" ❌"洗衣机脏"）
- scene_category：居家日常/紧急突发/出行旅途/社交约会/运动健身/职场办公/节日送礼/换季过渡
- user_pain：必须是用户侧的恐惧/焦虑/尴尬（✅"穿了没洗的衣服导致皮肤发痒甚至皮肤病" ❌"洗衣机没清洁"）
- emotion_keywords：焦虑/崩溃/慌张/尴尬/恶心/担忧/纠结等
- product_solution：产品如何解决这个痛点
- content_angle：拍成什么类型的视频（如"拍成妈妈早晨日常vlog，用计时器展示穿衣速度"）
**边界**：
- ❌ "洗衣机没清洁"不是痛点（这是产品功能描述）
- ✅ "穿了没洗的衣服导致皮肤发痒甚至皮肤病"才是痛点（用户真正害怕的事）
- 痛点 = 让用户"痛"的点（恐惧、焦虑、尴尬），不是产品功能

### 卖点画面库
**定义**：每个卖点该用什么画面来呈现，具体到镜头语言，照着拍就行。
**填写标准**：
- visual_type：面料特写/穿脱演示/洗涤对比测试/认证标签展示/真实反应镜头/场景演示/极限测试/细节放大/开箱展示/前后对比
- shooting_notes：必须具体到镜头语言（✅"微距镜头拍面料纹理，手指轻轻捏起有机棉面料展示柔软度和厚度。慢动作拍面料回弹，光线打出质感" ❌"展示产品效果"）
- purpose：这个画面解决消费者什么心理障碍（✅"中高端最需要证明'贵得值'。洗涤测试是最直观的品质证明" ❌"展示产品好"）
- video_stage：适合放在视频哪个位置
**边界**：卖点画面 = 视觉上如何证明产品好，不是文字描述产品好

### 社会证明库
**定义**：只有第三方背书才算社会证明。基于社会机构、社会影响力组织、真实用户的第三方背书。
**填写标准**：
- proof_type：用户好评/UGC视频/前后对比图/网红实测/权威认证/销量数据
- material_name：如"好评截图""GOTS有机认证""评论区精选截图"
- usage_scenario：具体怎么在视频里用（如"录屏滑动评论区的方式比截图更真实、更有代入感"）
- trust_strength：⭐⭐ 中等信任 / ⭐⭐⭐ 强信任
**边界**：
- ❌ "洗后有淡淡香气"不是社会证明（这是产品体验/卖点，归卖点画面库）
- ❌ 产品功能展示不是社会证明
- ✅ 社会证明 = 来自第三方的背书（用户评价、认证证书、网红推荐、销量数据）
- 如果视频里没有出现任何第三方背书，这个数组留空 []

### 权益库
**定义**：视频中展示的实际购买激励（折扣/买赠/包邮/试用等），对我方权益设计有参考价值。
**只有视频里展示了具体购买权益才提取**，否则此数组留空 []。
**边界**：
- ❌ "点击下方小黄车"不是权益（这是CTA话术）
- ❌ "解决洗衣机脏污问题"不是权益（这是产品功能）
- ❌ "了解更多产品或关注博主"不是权益（这是CTA）
- ✅ "买一送一""限时8折""前100名送赠品""包邮"才是权益

### BGM 情绪库
只输出情绪类型和风格描述，不要编造曲名或音乐人名（AI无法识别具体曲目）。

### 竞品爆款拆解库（competitor_entry）
**可复用点标准**：不只是描述视频做了什么，要写清楚"可复用模式 + 适用什么场景"。
- ✅ "分屏对比格式+计时器叠加画面，可复用于任何AB对比产品展示"
- ❌ "视频用了分屏对比"（只描述了做了什么，没说可复用在哪）

重要：time_start 和 time_end 必须是纯数字（不带s后缀，不是字符串）。请先确定总时长和所有镜头切换点，再逐个填写每个镜头的详细信息。`;

    const result = await model.generateContent([ { text: prompt }, { inlineData: { mimeType: getMimeType(req.file.originalname), data: videoBase64 } } ]);
    const responseText = result.response.text();
    send(4, '📊 AI 分析完成，解析结果...');

    let analysisResult;
    try { const m = responseText.match(/\{[\s\S]*\}/); analysisResult = m ? JSON.parse(m[0]) : { raw_response: responseText, parse_error: true }; }
    catch(e) { console.error('JSON解析失败:', e.message); analysisResult = { raw_response: responseText, parse_error: true }; }

    // 后处理校验：时长
    if (analysisResult.video_overview && realDuration) {
      const aiDuration = analysisResult.video_overview.total_duration_seconds;
      if (!aiDuration || Math.abs(aiDuration - realDuration) > 1) {
        console.log(`[修正] AI时长 ${aiDuration}s → ffprobe真实时长 ${realDuration.toFixed(2)}s`);
        analysisResult.video_overview.total_duration_seconds = parseFloat(realDuration.toFixed(2));
      }
    }

    // 产品露出占比自算
    if (analysisResult.video_overview) {
      const ov = analysisResult.video_overview;
      const dur = ov.total_duration_seconds;
      const exp = ov.product_exposure_seconds;
      if (dur > 0 && typeof exp === 'number') {
        ov.product_exposure_ratio = parseFloat((exp / dur * 100).toFixed(1));
      }
    }

    if (!analysisResult.parse_error) {
      analysisResult._ffprobe = ffprobeData;
    }

    send(5, '📸 根据镜头时间点截帧...');
    if (analysisResult.shots && analysisResult.shots.length > 0) {
      const sf = extractShotFrames(videoPath, videoId, analysisResult.shots);
      for (let i = 0; i < analysisResult.shots.length; i++) { if (sf[i]) analysisResult.shots[i].frame_url = sf[i].url; }
    }

    send(6, '✅ 拆解完成！', { videoId, videoUrl: `/uploads/${req.file.filename}`, analysis: analysisResult });
    setTimeout(() => { try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); } catch(e){} }, 3600000);
    res.end();
  } catch (error) {
    console.error('分析失败:', error);
    if (!res.headersSent) res.status(500).json({ error: '分析失败: ' + error.message });
    else { res.write(`data: ${JSON.stringify({ step: -1, message: '❌ ' + error.message })}\n\n`); res.end(); }
  }
});

// === API: Rewrite (板块级仿写) ===
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
2. 每个板块只写概要方向（2-4句话），不要写具体的逐镜头脚本
3. 概要方向要具体到画面，不要写空话。好的示例："快切三组镜头：孩子肚疼的痛苦表情→昂贵的医疗账单特写→妈妈彻夜陪床疲惫的脸"
4. 全部用中文输出，不要英文
5. 标注每个板块对应原视频的哪几个镜头编号

输出严格JSON格式：
{
  "framework": "${framework}",
  "formula": "${formula}",
  "blocks": [
    {
      "element": "停",
      "original_shots": [1, 2],
      "original_description": "原视频这个板块做了什么",
      "rewrite_direction": "新产品这个板块的仿写方向（2-4句话，要具体到画面）"
    }
  ]
}`;

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://tiktok-analyzer.zeabur.app', 'X-Title': 'TikTok Analyzer' },
      body: JSON.stringify({ model: 'anthropic/claude-sonnet-4', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
    const data = await r.json(), content = data.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/`{3,}[\w]*\s*/g, '').trim();
    let rw;
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        rw = JSON.parse(cleaned.substring(start, end + 1));
      } else {
        rw = { raw_response: content };
      }
    } catch(e) {
      console.error('rewrite JSON解析失败:', e.message, '\n原始内容前200字:', content.substring(0, 200));
      rw = { raw_response: content };
    }
    res.json({ success: true, rewrite: rw });
  } catch (error) { console.error('改写失败:', error); res.status(500).json({ error: '改写失败: ' + error.message }); }
});

// === API: Expand (板块→镜头级脚本) ===
app.post('/api/expand', async (req, res) => {
  try {
    const { originalShots, structureBreakdown, rewriteBlocks, productName, category } = req.body;
    if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY 未配置' });
    if (!originalShots || !rewriteBlocks) return res.status(400).json({ error: '缺少参数' });

    const prompt = `你是TikTok带货短视频编导。现在要把板块级仿写方向扩展为逐镜头分镜脚本。

## 核心规则
1. 新脚本的镜头数必须等于原视频的镜头数（${originalShots.length}个）
2. 每个镜头的角色标签（停/病/药/信/买）必须跟原视频一致
3. 每个镜头的时长比例参考原视频
4. 只替换画面内容，结构和节奏完全复刻

## 原视频镜头（${originalShots.length}个切镜）
${originalShots.map(s => `#${s.shot_number} [角色:${s._role || '无'}] [类型:${s.shot_type}] ${s.time_start}s-${s.time_end}s: ${s.scene_description || ''}`).join('\n')}

## 各板块的仿写方向
${rewriteBlocks.map(b => `[${b.element}]（对应原视频镜头 ${(b.original_shots || []).join(',')}）:\n${b.rewrite_direction}`).join('\n\n')}

## 新产品
品类：${category || ''}
产品名称：${productName || ''}

## 任务
把仿写方向扩展为${originalShots.length}个镜头的完整分镜脚本。每个镜头要有具体的画面描述和拍摄建议。

全部用中文输出，输出严格JSON：
{
  "shots": [
    {
      "index": 1,
      "role": "停/病/药/信/买",
      "scene_description_cn": "具体画面描述（至少15字）",
      "voiceover_cn": "口播文案（没有就空字符串）",
      "text_overlay": "画面文字（没有就空字符串）",
      "shooting_notes": "拍摄建议（景别、运镜等）",
      "time_ref": "参考时长如0-1.5s"
    }
  ]
}`;

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://tiktok-analyzer.zeabur.app', 'X-Title': 'TikTok Analyzer' },
      body: JSON.stringify({ model: 'anthropic/claude-sonnet-4', max_tokens: 8192, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
    const data = await r.json(), content = data.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/`{3,}[\w]*\s*/g, '').trim();
    let result;
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        result = JSON.parse(cleaned.substring(start, end + 1));
      } else {
        result = { raw_response: content };
      }
    } catch(e) {
      console.error('expand JSON解析失败:', e.message, '\n原始内容前200字:', content.substring(0, 200));
      result = { raw_response: content };
    }
    res.json({ success: true, expand: result });
  } catch (error) { console.error('扩展失败:', error); res.status(500).json({ error: '扩展失败: ' + error.message }); }
});

// === API: Feishu Save (入库确认面板模式) ★ V3.5.3 字段映射更新 ===
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

    // 1. 竞品爆款拆解库 — 自动入库，使用 competitor_entry
    if (shouldSave('competitor')) {
      try {
        const note = getNote('competitor');
        const hookScript = ce.hook_script || (em.cta || []).filter(c => c.stage && c.stage.includes('开头')).map(c => c.text_foreign).join('\n') || '';
        const reuse = ce.reusable_points || '';
        const bgmDesc = em.bgm ? `${em.bgm.mood||''} - ${em.bgm.description||''}` : '';

        await feishuCreate(FEISHU_CONFIG.tables.competitor, {
          '视频标题/描述': ce.title || source,
          '视频编码': videoCode||'',
          '钩子话术': hookScript,
          '视频结构': ce.video_structure || ss.framework || '',
          '使用BGM': bgmDesc,
          '可复用点': reuse,
          '拆解状态': '已拆解',
          '拆解时间': Date.now(),
          ...(note ? { '入库备注': note } : {}),
          ...(videoLink ? { '视频文件地址': videoLink } : {})
        });
        results.saved.push({ table: '竞品爆款拆解库' });
      } catch(e) { results.errors.push({ table: '竞品爆款拆解库', error: e.message }); }
    }

    // 2. CTA库 — 统一从 em.cta 数组读取
    if (shouldSave('cta')) {
      const allCTA = em.cta || [];
      for (const c of allCTA) {
        try {
          await feishuCreate(FEISHU_CONFIG.tables.cta, {
            'CTA话术（外文）': c.text_foreign || '',
            '中文翻译': c.text_cn || '',
            '视频阶段': c.stage || '开头（前3秒钩子）',
            '行动类型': c.action_type || '',
            '话术逻辑': c.psychology || '',
            '配合画面': c.visual_pairing || '',
            ...(getNote('cta') ? { '入库备注': getNote('cta') } : {})
          });
          results.saved.push({ table: 'CTA库' });
        } catch(e) { results.errors.push({ table: 'CTA库', error: e.message }); }
      }
    }

    // 3. 痛点库
    if (shouldSave('painpoint')) {
      for (const p of (em.pain_points||[])) {
        try {
          await feishuCreate(FEISHU_CONFIG.tables.painpoint, {
            '场景名称': p.scene_name || '',
            '场景分类': p.scene_category || '',
            '用户痛点': p.user_pain || '',
            '情绪关键词': (p.emotion_keywords||[]).join('、'),
            '产品切入点': p.product_solution || '',
            '内容角度建议': p.content_angle || '',
            '来源': 'TikTok爆款',
            '关联视频链接': videoLink || '',
            ...(getNote('painpoint') ? { '入库备注': getNote('painpoint') } : {})
          });
          results.saved.push({ table: '痛点库' });
        } catch(e) { results.errors.push({ table: '痛点库', error: e.message }); }
      }
    }

    // 4. 卖点画面库
    if (shouldSave('sellingpt')) {
      for (const s of (em.selling_visuals||[])) {
        try {
          await feishuCreate(FEISHU_CONFIG.tables.sellingpt, {
            '拍摄说明': s.shooting_notes || '',
            '画面类型': s.visual_type || '',
            '作用': s.purpose || '',
            '配合视频阶段': s.video_stage || '',
            ...(getNote('sellingpt') ? { '入库备注': getNote('sellingpt') } : {})
          });
          results.saved.push({ table: '卖点库' });
        } catch(e) { results.errors.push({ table: '卖点库', error: e.message }); }
      }
    }

    // 5. 社会证明库
    if (shouldSave('socialproof')) {
      for (const s of (em.social_proof||[])) {
        try {
          await feishuCreate(FEISHU_CONFIG.tables.socialproof, {
            '证明类型': s.proof_type || '',
            '素材名称': s.material_name || '',
            '信任强度': s.trust_strength || '',
            '使用场景说明': s.usage_scenario || '',
            ...(getNote('socialproof') ? { '入库备注': getNote('socialproof') } : {})
          });
          results.saved.push({ table: '社会证明库' });
        } catch(e) { results.errors.push({ table: '社会证明库', error: e.message }); }
      }
    }

    // 6. 权益库 — 从 em.benefits 读取
    if (shouldSave('benefit')) {
      for (const b of (em.benefits||[])) {
        try {
          await feishuCreate(FEISHU_CONFIG.tables.benefit, {
            '权益名称': b.benefit_name || '',
            '权益类型': b.benefit_type || '',
            '权益描述': b.description || '',
            '话术示例': b.script_example || '',
            '成本等级': b.cost_level || '',
            '适用场景': '竞品参考',
            ...(getNote('benefit') ? { '入库备注': getNote('benefit') } : {})
          });
          results.saved.push({ table: '权益库' });
        } catch(e) { results.errors.push({ table: '权益库', error: e.message }); }
      }
    }

    // 7. BGM情绪库
    if (shouldSave('bgm') && em.bgm && em.bgm.mood) {
      try {
        await feishuCreate(FEISHU_CONFIG.tables.bgm, {
          'BGM名称': '待识别（需手动填写）',
          '情绪类型': em.bgm.mood||'',
          '适用内容': ss.framework || '',
          '特征描述': em.bgm.description||'',
          '关联视频链接': videoLink || '',
          ...(getNote('bgm') ? { '入库备注': getNote('bgm') } : {})
        });
        results.saved.push({ table: 'BGM库' });
      } catch(e) { results.errors.push({ table: 'BGM库', error: e.message }); }
    }

    res.json({ success: results.errors.length===0, message: `写入完成：${results.saved.length}条成功${results.errors.length>0?'，'+results.errors.length+'条失败':''}`, results });
  } catch (error) { console.error('飞书入库失败:', error); res.status(500).json({ error: '飞书入库失败: ' + error.message }); }
});

// === API: Feishu BGM ===
app.get('/api/feishu/bgm', async (req, res) => {
  try {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return res.status(500).json({ error: '飞书未配置' });
    const data = await feishuList(FEISHU_CONFIG.tables.bgm, { page_size: 100 });
    const items = (data.items || []).map(r => ({
      name: r.fields['BGM名称'] || '',
      mood: r.fields['情绪类型'] || '',
      content: r.fields['适用内容'] || '',
      description: r.fields['特征描述'] || ''
    })).filter(i => i.name);
    res.json({ success: true, bgm: items });
  } catch (e) { console.error('BGM读取失败:', e); res.status(500).json({ error: e.message }); }
});

// === API: 读取飞书框架结构库 ===
let frameworkCache = { data: null, expires: 0 };
app.get('/api/feishu/frameworks', async (req, res) => {
  try {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return res.status(500).json({ error: '飞书未配置' });
    if (frameworkCache.data && Date.now() < frameworkCache.expires) {
      return res.json({ success: true, frameworks: frameworkCache.data });
    }
    const data = await feishuList(FEISHU_CONFIG.tables.framework, { page_size: 100 });
    const items = (data.items || []).map(r => ({
      name: r.fields['框架名称'] || '',
      formula: r.fields['短视频底层结构公式‼️'] || r.fields['短视频底层结构公式'] || '',
      hookType: r.fields['开头钩子类型'] || '',
      logic: r.fields['核心逻辑'] || '',
      difficulty: r.fields['难度'] || '',
      level: r.fields['内容层级'] || '',
      scenario: r.fields['适用场景'] || ''
    })).filter(i => i.name);
    frameworkCache = { data: items, expires: Date.now() + 300000 };
    res.json({ success: true, frameworks: items });
  } catch (e) { console.error('框架库读取失败:', e); res.status(500).json({ error: e.message }); }
});

// === API: 新框架入库 ★ V3.5.3 补齐全部字段 ===
app.post('/api/feishu/framework/create', async (req, res) => {
  try {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return res.status(500).json({ error: '飞书未配置' });
    const { name, formula, hookType, logic, scenario, difficulty, level } = req.body;
    if (!name || !formula) return res.status(400).json({ error: '缺少框架名称或公式' });
    const record = await feishuCreate(FEISHU_CONFIG.tables.framework, {
      '框架名称': name,
      '短视频底层结构公式‼️': formula,
      '开头钩子类型': hookType || '',
      '核心逻辑': logic || '',
      '适用场景': scenario || '',
      '难度': difficulty || '',
      '内容层级': level || ''
    });
    frameworkCache = { data: null, expires: 0 };
    res.json({ success: true, record });
  } catch (e) { console.error('框架入库失败:', e); res.status(500).json({ error: e.message }); }
});

// === API: Video Generation Platforms ===
app.get('/api/videogen/platforms', (req, res) => {
  res.json({
    platforms: [
      { id: 'kie', name: 'Kie.ai', available: !!KIE_API_KEY, models: [
        { id: 'veo3_fast', name: 'Veo 3.1 Fast', price: '~$0.30/8s', speed: '快', quality: '标准' },
        { id: 'veo3', name: 'Veo 3.1 Quality', price: '~$2.00/8s', speed: '慢', quality: '高' }
      ]},
      { id: 'fal', name: 'fal.ai', available: !!FAL_API_KEY, models: [
        { id: 'fal-ai/veo3/fast', name: 'Veo 3 Fast', price: '~$0.10-0.15/s', speed: '快', quality: '标准' },
        { id: 'fal-ai/veo3', name: 'Veo 3 Quality', price: '~$0.20-0.40/s', speed: '慢', quality: '高' }
      ]}
    ]
  });
});

const videoTasks = new Map();

async function kieGenerate(prompt, model, aspectRatio) {
  const r = await fetch('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIE_API_KEY}` },
    body: JSON.stringify({ prompt, model: model || 'veo3_fast', aspect_ratio: aspectRatio || '9:16', watermark: '', enableTranslation: true })
  });
  const d = await r.json();
  if (d.code !== 200 && d.code !== 0) throw new Error('Kie.ai 提交失败: ' + (d.msg || JSON.stringify(d)));
  return { taskId: d.data?.task_id || d.task_id, platform: 'kie' };
}

async function kieGetStatus(taskId) {
  const r = await fetch(`https://api.kie.ai/api/v1/veo/record-detail?taskId=${taskId}`, { headers: { 'Authorization': `Bearer ${KIE_API_KEY}` } });
  const d = await r.json();
  const status = d.data?.status || d.data?.task_status || 'unknown';
  const isComplete = status === 'completed' || status === 'success' || !!d.data?.video_url;
  const isFailed = status === 'failed' || status === 'error';
  return { status: isComplete ? 'completed' : isFailed ? 'failed' : 'processing', videoUrl: d.data?.video_url || d.data?.output?.video_url || null, coverUrl: d.data?.image_url || d.data?.cover_url || null, raw: d.data };
}

async function falGenerate(prompt, model, aspectRatio) {
  const endpoint = model || 'fal-ai/veo3/fast';
  const r = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${FAL_API_KEY}` },
    body: JSON.stringify({ prompt, aspect_ratio: aspectRatio || '9:16', duration: '8s', resolution: '720p', generate_audio: true })
  });
  if (!r.ok) { const e = await r.text(); throw new Error('fal.ai 提交失败: ' + e); }
  const d = await r.json();
  return { taskId: d.request_id, platform: 'fal', endpoint };
}

async function falGetStatus(taskId, endpoint) {
  const r = await fetch(`https://queue.fal.run/${endpoint}/requests/${taskId}/status`, { headers: { 'Authorization': `Key ${FAL_API_KEY}` } });
  const d = await r.json();
  if (d.status === 'COMPLETED') {
    const rr = await fetch(`https://queue.fal.run/${endpoint}/requests/${taskId}`, { headers: { 'Authorization': `Key ${FAL_API_KEY}` } });
    const result = await rr.json();
    return { status: 'completed', videoUrl: result.video?.url || null, coverUrl: null, raw: result };
  }
  if (d.status === 'FAILED') return { status: 'failed', videoUrl: null, raw: d };
  return { status: 'processing', videoUrl: null, raw: d };
}

app.post('/api/videogen/generate', async (req, res) => {
  try {
    const { prompt, platform, model, aspectRatio } = req.body;
    if (!prompt) return res.status(400).json({ error: '缺少 prompt' });
    let result;
    if (platform === 'fal') {
      if (!FAL_API_KEY) return res.status(500).json({ error: 'FAL_API_KEY 未配置' });
      result = await falGenerate(prompt, model, aspectRatio);
    } else {
      if (!KIE_API_KEY) return res.status(500).json({ error: 'KIE_API_KEY 未配置' });
      result = await kieGenerate(prompt, model, aspectRatio);
    }
    const taskKey = `${result.platform}_${result.taskId}`;
    videoTasks.set(taskKey, { ...result, createdAt: Date.now(), prompt });
    setTimeout(() => videoTasks.delete(taskKey), 7200000);
    res.json({ success: true, taskId: result.taskId, platform: result.platform, taskKey });
  } catch (e) { console.error('视频生成提交失败:', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/videogen/status/:taskKey', async (req, res) => {
  try {
    const { taskKey } = req.params;
    const task = videoTasks.get(taskKey);
    if (!task) return res.status(404).json({ error: '任务不存在或已过期' });
    let status;
    if (task.platform === 'fal') { status = await falGetStatus(task.taskId, task.endpoint); }
    else { status = await kieGetStatus(task.taskId); }
    res.json({ success: true, ...status, taskKey });
  } catch (e) { console.error('状态查询失败:', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => {
  let ffmpeg = false; try { execSync('ffmpeg -version', { stdio:'pipe', timeout:5000 }); ffmpeg = true; } catch(e) {}
  res.json({ status: 'ok', timestamp: new Date().toISOString(), services: { gemini: !!GEMINI_API_KEY, openrouter: !!OPENROUTER_API_KEY, feishu: !!(FEISHU_APP_ID&&FEISHU_APP_SECRET), ffmpeg, kie: !!KIE_API_KEY, fal: !!FAL_API_KEY } });
});

app.listen(PORT, () => { console.log(`🚀 http://localhost:${PORT}  Gemini:${GEMINI_API_KEY?'✅':'❌'} OpenRouter:${OPENROUTER_API_KEY?'✅':'❌'} 飞书:${FEISHU_APP_ID?'✅':'❌'} Kie:${KIE_API_KEY?'✅':'❌'} Fal:${FAL_API_KEY?'✅':'❌'}`); });
