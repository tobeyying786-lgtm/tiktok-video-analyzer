/**
 * tab3-product.js — V3.7.0
 * Tab 3 商品档案：产品信息录入、参考图上传、VOC输入、AI提取产品特征
 */

function renderTab3Product() {
  const panel = document.getElementById('t3');
  const profile = AppState.productProfile || null;
  const refImages = AppState.productRefImages || [];

  // 左侧：参考图 + 产品信息 + VOC
  const imgPreviews = refImages.map((img, i) =>
    '<div style="position:relative;display:inline-block;margin:0 6px 6px 0">' +
      '<img src="' + img + '" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">' +
      '<span onclick="t3RemoveRefImage(' + i + ')" style="position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;width:16px;height:16px;border-radius:50%;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer">x</span>' +
    '</div>'
  ).join('');

  const leftHtml = '<div>' +
    // 参考图上传区
    '<div class="t3-card">' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:10px">产品参考图 <span style="font-size:12px;color:var(--text3);font-weight:400">(' + refImages.length + '/5)</span></div>' +
      '<div style="margin-bottom:8px">' + imgPreviews +
        (refImages.length < 5 ? '<label style="display:inline-flex;width:80px;height:80px;border:1.5px dashed var(--border);border-radius:8px;align-items:center;justify-content:center;cursor:pointer;font-size:20px;color:var(--text3)">+<input type="file" accept="image/*" multiple style="display:none" onchange="t3UploadRefImages(this)"></label>' : '') +
      '</div>' +
      '<div style="font-size:12px;color:var(--text3)">建议上传：白底图 + 使用场景图 + 细节图</div>' +
    '</div>' +

    // 产品信息表单
    '<div class="t3-card">' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:12px">产品信息</div>' +
      '<div class="t3-field"><label>品类</label><input type="text" id="t3-category" value="' + esc(AppState.productCategory || '') + '" placeholder="如：厨具/小家电"></div>' +
      '<div class="t3-field"><label>产品名称</label><input type="text" id="t3-product-name" value="' + esc(AppState.productName || '') + '" placeholder="如：QUIK 便携果汁杯"></div>' +
      '<div class="t3-field"><label>核心卖点</label><input type="text" id="t3-selling-points" value="' + esc(AppState.productSellingPoints || '') + '" placeholder="如：全身水洗，12片刀片，USB-C充电"></div>' +
      '<div class="t3-field"><label>产品描述（可选）</label><textarea id="t3-description" rows="3" placeholder="详细的产品描述">' + esc(AppState.productDescription || '') + '</textarea></div>' +
      '<div class="t3-field"><label>消费者洞察 VOC（可选）</label><textarea id="t3-voc" rows="4" placeholder="从飞书VOC分析结果复制粘贴关键结论，如：消费者最常抱怨清洗死角、最满意榨汁细腻度、常见使用场景是健身房和办公室">' + esc(AppState.productVOC || '') + '</textarea></div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button class="btn-go" id="btn-analyze-product" onclick="t3AnalyzeProduct()" style="flex:1">AI 提取产品特征</button>' +
        '<button class="btn-sec" onclick="t3LoadFromFeishu()" style="padding:8px 16px">从飞书读取</button>' +
      '</div>' +
      '<div id="t3-analyze-status"></div>' +
    '</div>' +
  '</div>';

  // 右侧：产品档案面板
  let rightHtml = '';
  if (profile) {
    // AI 分析摘要
    const summary = [
      '产品: ' + (profile.product_name || ''),
      '类别: ' + (profile.category || ''),
      '特征: ' + (profile.appearance || ''),
      '尺寸: ' + (profile.dimensions || ''),
      '使用: ' + (profile.usage_posture || ''),
      '人群: ' + (profile.target_audience || ''),
      '色彩: ' + (profile.color_scheme || '')
    ].filter(s => s.split(': ')[1]).join('\n');

    const vocSummary = profile.voc_insights ? [
      '高频痛点: ' + (profile.voc_insights.top_pains || []).join(', '),
      '高频好评: ' + (profile.voc_insights.top_praises || []).join(', '),
      '常见场景: ' + (profile.voc_insights.common_scenarios || []).join(', '),
      '购买驱动: ' + (profile.voc_insights.purchase_drivers || []).join(', ')
    ].join('\n') : '';

    rightHtml = '<div class="t3-card t3-sticky">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
        '<div style="font-size:14px;font-weight:700">产品档案</div>' +
        '<span style="font-size:12px;color:var(--text3)">可编辑</span>' +
      '</div>' +
      '<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px">' +
        '<div style="font-size:12px;color:var(--text3);margin-bottom:4px">AI 分析摘要</div>' +
        '<div style="font-size:13px;color:var(--text);line-height:1.7;white-space:pre-line">' + esc(summary) + '</div>' +
      '</div>' +
      (vocSummary ? '<div style="background:var(--accentBg);border-radius:8px;padding:12px;margin-bottom:10px">' +
        '<div style="font-size:12px;color:var(--accent2);margin-bottom:4px">VOC 洞察</div>' +
        '<div style="font-size:13px;color:var(--accent2);line-height:1.7;white-space:pre-line">' + esc(vocSummary) + '</div>' +
      '</div>' : '') +
      '<div style="margin-bottom:10px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
          '<div style="font-size:12px;color:var(--text3)">完整 JSON（可编辑）</div>' +
        '</div>' +
        '<textarea id="t3-profile-json" rows="14" style="width:100%;font-family:monospace;font-size:12px;line-height:1.5;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;color:var(--text);resize:vertical">' + esc(JSON.stringify(profile, null, 2)) + '</textarea>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn-sec" onclick="t3SaveProfileEdit()" style="flex:1">应用 JSON 编辑</button>' +
        '<button class="btn-sec" onclick="t3SaveToFeishu()" style="flex:1">保存到飞书</button>' +
      '</div>' +
    '</div>';
  } else {
    rightHtml = '<div class="t3-card t3-sticky">' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:10px">产品档案</div>' +
      '<div style="padding:40px 20px;text-align:center;color:var(--text3)">' +
        '<div style="font-size:14px;margin-bottom:8px">尚未生成</div>' +
        '<div style="font-size:12px">填写左侧产品信息后点击「AI 提取产品特征」</div>' +
      '</div>' +
    '</div>';
  }

  panel.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' + leftHtml + rightHtml + '</div>';
}

// ============== 参考图上传 ==============

function t3UploadRefImages(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  if (!AppState.productRefImages) AppState.productRefImages = [];
  const remaining = 5 - AppState.productRefImages.length;
  const toProcess = files.slice(0, remaining);
  let loaded = 0;
  toProcess.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      AppState.productRefImages.push(e.target.result);
      loaded++;
      if (loaded === toProcess.length) renderTab3Product();
    };
    reader.readAsDataURL(file);
  });
}

function t3RemoveRefImage(idx) {
  if (AppState.productRefImages) {
    AppState.productRefImages.splice(idx, 1);
    renderTab3Product();
  }
}

// ============== AI 提取产品特征 ==============

async function t3AnalyzeProduct() {
  const name = (document.getElementById('t3-product-name')?.value || '').trim();
  const category = (document.getElementById('t3-category')?.value || '').trim();
  const sellingPoints = (document.getElementById('t3-selling-points')?.value || '').trim();
  const description = (document.getElementById('t3-description')?.value || '').trim();
  const vocText = (document.getElementById('t3-voc')?.value || '').trim();

  if (!name) { alert('请填写产品名称'); return; }

  // 保存输入状态
  AppState.productName = name;
  AppState.productCategory = category;
  AppState.productSellingPoints = sellingPoints;
  AppState.productDescription = description;
  AppState.productVOC = vocText;

  const btn = document.getElementById('btn-analyze-product');
  const status = document.getElementById('t3-analyze-status');
  btn.disabled = true; btn.textContent = '分析中...';
  status.innerHTML = '<div style="color:var(--text3);padding:12px;text-align:center"><div class="spin" style="margin:0 auto 8px"></div>Gemini 正在分析产品特征...</div>';

  try {
    const profile = await API.analyzeProduct(name, category, sellingPoints, description, vocText, AppState.productRefImages || []);
    AppState.productProfile = profile;
    status.innerHTML = '<div style="color:var(--green);padding:8px;text-align:center">产品档案生成成功</div>';
    renderTab3Product();
  } catch (e) {
    status.innerHTML = '<div style="color:var(--red);padding:8px">' + esc(e.message) + '</div>';
  } finally {
    btn.disabled = false; btn.textContent = 'AI 提取产品特征';
  }
}

// ============== JSON 编辑应用 ==============

function t3SaveProfileEdit() {
  const textarea = document.getElementById('t3-profile-json');
  if (!textarea) return;
  try {
    const edited = JSON.parse(textarea.value);
    AppState.productProfile = edited;
    alert('产品档案已更新');
    renderTab3Product();
  } catch (e) {
    alert('JSON 格式错误：' + e.message);
  }
}

// ============== 飞书读取/保存（占位） ==============

function t3LoadFromFeishu() {
  alert('飞书商品库读取功能开发中');
}

function t3SaveToFeishu() {
  alert('飞书商品库保存功能开发中');
}

// ============== 导出 ==============

window.renderTab3Product = renderTab3Product;
window.t3UploadRefImages = t3UploadRefImages;
window.t3RemoveRefImage = t3RemoveRefImage;
window.t3AnalyzeProduct = t3AnalyzeProduct;
window.t3SaveProfileEdit = t3SaveProfileEdit;
window.t3LoadFromFeishu = t3LoadFromFeishu;
window.t3SaveToFeishu = t3SaveToFeishu;
