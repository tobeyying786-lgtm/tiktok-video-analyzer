/**
 * api.js — 所有 API 调用封装
 */

const API = {
  /**
   * 分析视频（SSE 流式）
   * @param {File} file
   * @param {Function} onStep  - (step, message) 回调
   * @param {Function} onDone  - (data) 回调
   * @param {Function} onError - (error) 回调
   */
  async analyze(file, onStep, onDone, onError) {
    const fd = new FormData();
    fd.append('video', file);
    try {
      const resp = await fetch('/api/analyze', { method: 'POST', body: fd });
      if (!resp.ok && !resp.headers.get('content-type')?.includes('event-stream')) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || 'HTTP ' + resp.status);
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '', final = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (const p of parts) {
          for (const l of p.split('\n')) {
            if (l.startsWith('data: ')) {
              try {
                const m = JSON.parse(l.slice(6));
                onStep(m.step, m.message);
                if (m.data) final = m.data;
              } catch (e) { /* skip */ }
            }
          }
        }
      }
      // Process remaining buffer
      if (buf.trim()) {
        for (const l of buf.split('\n')) {
          if (l.startsWith('data: ')) {
            try {
              const m = JSON.parse(l.slice(6));
              onStep(m.step, m.message);
              if (m.data) final = m.data;
            } catch (e) { /* skip */ }
          }
        }
      }
      if (!final) throw new Error('未收到分析结果');
      onDone(final);
    } catch (e) {
      onError(e);
    }
  },

  /**
   * 改写脚本
   */
  async rewrite(analysis, newCategory, productName, coreSellingPoints) {
    const resp = await fetch('/api/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis, newCategory, productName, coreSellingPoints })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '改写失败');
    return data.rewrite;
  },

  /**
   * 板块→镜头级脚本扩展
   */
  async expand(originalShots, structureBreakdown, rewriteBlocks, productName, category) {
    const resp = await fetch('/api/expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalShots, structureBreakdown, rewriteBlocks, productName, category })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '扩展失败');
    return data.expand;
  },

  /**
   * 写入飞书多维表格
   */
  async saveToFeishu(analysis, videoCode, videoUrl, filename) {
    const resp = await fetch('/api/save-to-feishu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis, videoCode, videoUrl, filename })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '写入失败');
    return data;
  },

  /**
   * 获取视频生成平台列表
   */
  async getVideoGenPlatforms() {
    const resp = await fetch('/api/videogen/platforms');
    const data = await resp.json();
    return data.platforms;
  },

  /**
   * 提交视频生成任务
   */
  async submitVideoGen(prompt, platform, model, aspectRatio) {
    const resp = await fetch('/api/videogen/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, platform, model, aspectRatio })
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || '提交失败');
    return data;
  },

  /**
   * 查询视频生成状态
   */
  async getVideoGenStatus(taskKey) {
    const resp = await fetch('/api/videogen/status/' + taskKey);
    return await resp.json();
  },

  /**
   * 获取 BGM 库
   */
  async getBgmList() {
    const resp = await fetch('/api/feishu/bgm');
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'BGM 加载失败');
    return data.bgm;
  },

  /**
   * 获取框架结构库
   */
  async getFrameworks() {
    const resp = await fetch('/api/feishu/frameworks');
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || '框架库加载失败');
    return data.frameworks;
  },

  /**
   * 新框架入库
   */
  async createFramework(name, formula, hookType, logic) {
    const resp = await fetch('/api/feishu/framework/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, formula, hookType, logic })
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || '入库失败');
    return data;
  },

  /**
   * 健康检查
   */
  async healthCheck() {
    const resp = await fetch('/api/health');
    return await resp.json();
  }
};

window.API = API;
