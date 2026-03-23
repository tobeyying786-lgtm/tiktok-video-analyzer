/**
 * state.js — 全局状态管理
 * 所有 tab 共享的数据和状态都在这里
 */

const AppState = {
  // 当前上传的文件
  curFile: null,
  // Gemini 分析原始结果
  analysisData: null,
  // 改写结果（给 Tab 4 用）
  lastRewrite: null,
  // Tab 4 编辑器数据
  t4RewriteData: null,
  t4Platforms: null,
  t4BgmData: null,
  t4GenTaskKey: null,
  t4PollTimer: null,
  t4Initialized: false,
  t4Dirty: false,

  // Tab 4 全局设置
  t4Settings: {
    productImage: null,        // 白底图 base64
    productImageName: null,    // 文件名
    platform: 'tiktok',        // 发布平台
    language: 'CN',            // 目标语言
    layoutTemplate: 'tiktok_916', // 布局模板
  },

  // ffmpeg 预分析数据（场景切换点、真实时长）
  ffprobeData: null,

  // 重置全部状态
  reset() {
    this.curFile = null;
    this.analysisData = null;
    this.lastRewrite = null;
    this.t4RewriteData = null;
    this.t4Platforms = null;
    this.t4BgmData = null;
    this.t4GenTaskKey = null;
    if (this.t4PollTimer) clearInterval(this.t4PollTimer);
    this.t4PollTimer = null;
    this.t4Initialized = false;
    this.t4Dirty = false;
    this.t4Settings = { productImage: null, productImageName: null, platform: 'tiktok', language: 'CN', layoutTemplate: 'tiktok_916' };
    this.ffprobeData = null;
  },

  // Tab 4 初始化改写数据（只在首次或新改写时触发）
  initT4FromRewrite(rw) {
    this.lastRewrite = rw;
    // 将改写数据转换为新的 shots 格式（带 camera 和 role）
    const converted = JSON.parse(JSON.stringify(rw));
    if (converted.rewritten_structure) {
      converted.rewritten_structure = converted.rewritten_structure.map(s => ({
        ...s,
        role: s.element || '无',
        camera: s.camera || { shot_size: '', lighting: [], movement: '', composition: '', style: '' }
      }));
    }
    this.t4RewriteData = converted;
    this.t4Initialized = true;
    this.t4Dirty = false;
  }
};

// 导出为全局变量（vanilla JS 项目）
window.AppState = AppState;
