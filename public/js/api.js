/**
 * api.js — V3.5.4: createFramework 传全部字段
 */

const API = {
  async analyze(file, memo, onStep, onDone, onError) {
    const fd = new FormData();
    fd.append('video', file);
    if (memo) fd.append('memo', memo);
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
              try { const m = JSON.parse(l.slice(6)); onStep(m.step, m.message); if (m.data) final = m.data; } catch (e) {}
            }
          }
        }
      }
      if (buf.trim()) {
        for (const l of buf.split('\n')) {
          if (l.startsWith('data: ')) {
            try { const m = JSON.parse(l.slice(6)); onStep(m.step, m.message); if (m.data) final = m.data; } catch (e) {}
          }
        }
      }
      if (!final) throw new Error('未收到分析结果');
      onDone(final);
    } catch (e) { onError(e); }
  },

  async rewrite(analysis, newCategory, productName, coreSellingPoints) {
    const resp = await fetch('/api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analysis, newCategory, productName, coreSellingPoints }) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '改写失败');
    return data.rewrite;
  },

  async expand(originalShots, structureBreakdown, rewriteBlocks, productName, category) {
    const resp = await fetch('/api/expand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ originalShots, structureBreakdown, rewriteBlocks, productName, category }) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '扩展失败');
    return data.expand;
  },

  async saveToFeishu(analysis, videoCode, videoUrl, filename, libs) {
    const resp = await fetch('/api/save-to-feishu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analysis, videoCode, videoUrl, filename, libs }) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '写入失败');
    return data;
  },

  async getVideoGenPlatforms() { const resp = await fetch('/api/videogen/platforms'); return (await resp.json()).platforms; },
  async submitVideoGen(prompt, platform, model, aspectRatio) { const resp = await fetch('/api/videogen/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, platform, model, aspectRatio }) }); const data = await resp.json(); if (!data.success) throw new Error(data.error || '提交失败'); return data; },
  async getVideoGenStatus(taskKey) { return await (await fetch('/api/videogen/status/' + taskKey)).json(); },
  async getBgmList() { const resp = await fetch('/api/feishu/bgm'); const data = await resp.json(); if (!data.success) throw new Error(data.error || 'BGM 加载失败'); return data.bgm; },
  async getFrameworks() { const resp = await fetch('/api/feishu/frameworks'); const data = await resp.json(); if (!data.success) throw new Error(data.error || '框架库加载失败'); return data.frameworks; },

  // V3.5.4: 传全部字段
  async createFramework(name, formula, hookType, logic, scenario, difficulty) {
    const resp = await fetch('/api/feishu/framework/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, formula, hookType, logic, scenario, difficulty })
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || '入库失败');
    return data;
  },

  async healthCheck() { return await (await fetch('/api/health')).json(); },
  async archive(file, memo) { const fd = new FormData(); fd.append('video', file); fd.append('memo', memo || ''); const resp = await fetch('/api/archive', { method: 'POST', body: fd }); const data = await resp.json(); if (!resp.ok) throw new Error(data.error || '存档分析失败'); return data; },
  async archiveSave(targetLibrary, fields) { const resp = await fetch('/api/archive/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetLibrary, fields }) }); const data = await resp.json(); if (!resp.ok) throw new Error(data.error || '入库失败'); return data; }
};

window.API = API;
