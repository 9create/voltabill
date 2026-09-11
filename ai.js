// ════════════════════════════════════════════════════════
// ai.js — VOLTA AI ASSISTANT for GST Invoice Pro
// ════════════════════════════════════════════════════════

const VOLTA = (() => {

  // ── CONFIG — key ab Netlify Function ke andar hai, browser me kabhi expose nahi hoti ──
  const API_URL   = '/.netlify/functions/ask-ai';
  const AI_NAME   = 'Volta';

  let chatHistory = [];
  let isOpen = false;

  async function callAI(userMessage, systemContext) {
    const messages = [
      { role: 'system', content: systemContext },
      ...chatHistory,
      { role: 'user', content: userMessage }
    ];
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, temperature: 0.2, response_format: { type: 'json_object' } })
    });
    if(!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'API Error'); }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    chatHistory.push({ role: 'user', content: userMessage });
    chatHistory.push({ role: 'assistant', content: text });
    if(chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    const m = text.match(/\{[\s\S]*\}/);
    if(!m) throw new Error('Invalid response');
    return JSON.parse(m[0]);
  }

  function buildPrompt() {
    const buyers = DB.Buyers.getAll().slice(0,10);
    const items  = DB.Items.getAll().slice(0,10);
    const cfg    = DB.Config.get();
    const buyerList = buyers.map(b => `${b.name}|${b.address?.split('\n')[0]||''}|${b.gstin||''}|${b.state||''}`).join('\n') || 'None';
    const itemList  = items.map(i => `${i.name}|${i.hsn}|${i.rate}|${i.gst}%`).join('\n') || 'None';
    return `You are Volta, a GST invoice AI. Return ONLY valid JSON.
Seller: ${cfg.sellerName||'Not set'}, State: ${cfg.sellerState||'Maharashtra, Code: 27'}
Today: ${new Date().toISOString().split('T')[0]}
BUYERS (name|address|gstin|state): ${buyerList}
ITEMS (name|hsn|rate|gst%): ${itemList}
Return JSON:
{"action":"fill_invoice|fill_quotation|fill_seller|add_items|answer|error","message":"English response","data":{"docNumber":"","docDate":"YYYY-MM-DD","buyerName":"","buyerAddress":"","buyerGSTIN":"","buyerState":"","paymentMode":"Bank Transfer","supplyType":"intra","deliveryNote":"","sellerName":"","sellerAddress":"","sellerGSTIN":"","sellerState":"","sellerEmail":"","sellerPhone":"","items":[{"desc":"","hsn":"","qty":1,"rate":0,"gst":18}]},"suggestions":[]}
Rules:
- supplyType: intra=same state, inter=different state
- Default GST 18% for electrical items
- fill_seller: only fill seller fields in data
- add_items: APPEND new items (keep existing items, do NOT clear)
- replace_items: CLEAR all items then add new ones
- For "create invoice/quotation": always use fill_invoice/fill_quotation and include items
- Shorthand: ci=create invoice, cq=create quotation, si=save, dp=download pdf, ni=new invoice
- itm=X means item name is X, qt=N means qty N, rt=N means rate N
- Example: "ci amnazon itm=LED qt=100 rt=500" = create invoice for amnazon, item LED qty 100 rate 500
- Example: "add itm=fans qt=50 rt=2000" = add_items fans qty 50 rate 2000
- Be precise: if user says "add", use add_items NOT fill_invoice
- CRITICAL for add_items: return ONLY the NEW items being added. NEVER include existing items already on the invoice. If user says "add fans", return ONLY fans in the items array.
- CRITICAL for fill_invoice: always clear and fill fresh - return only the items mentioned by user`;
  }

  function fillForm(data, action) {
    if(!data) return;
    const set = (id, val) => { const el = document.getElementById(id); if(el && val!==undefined && val!==null && val!=='') el.value = val; };
    if(action === 'fill_seller') {
      set('sellerName',    data.sellerName);
      set('sellerAddress', data.sellerAddress);
      set('sellerGSTIN',   data.sellerGSTIN);
      set('sellerState',   data.sellerState);
      set('sellerEmail',   data.sellerEmail);
      set('sellerPhone',   data.sellerPhone);
      updateSummary?.(); return;
    }
    if(action === 'add_items') {
      data.items?.forEach(item => {
        // First try to fill an existing empty row
        let filled = false;
        const rows = document.querySelectorAll('#itemsContainer .item-row');
        for(const row of rows) {
          const descEl = row.querySelector('[id^="desc-"]');
          if(descEl && !descEl.value.trim()) {
            const rowId = descEl.id.replace('desc-','');
            set(`desc-${rowId}`, item.desc);
            set(`hsn-${rowId}`, item.hsn);
            set(`qty-${rowId}`, item.qty||1);
            set(`rate-${rowId}`, item.rate);
            const g = document.getElementById(`gst-${rowId}`); if(g) g.value = item.gst||18;
            filled = true;
            break;
          }
        }
        // No empty row found — add new row
        if(!filled) {
          addItem();
          const i = itemCount;
          set(`desc-${i}`, item.desc); set(`hsn-${i}`, item.hsn);
          set(`qty-${i}`, item.qty||1); set(`rate-${i}`, item.rate);
          const g = document.getElementById(`gst-${i}`); if(g) g.value = item.gst||18;
        }
      });
      updateSummary?.(); return;
    }
    set('docNumber', data.docNumber); set('docDate', data.docDate);
    set('buyerName', data.buyerName); set('buyerAddress', data.buyerAddress);
    set('buyerGSTIN', data.buyerGSTIN); set('buyerState', data.buyerState);
    set('deliveryNote', data.deliveryNote);
    if(data.paymentMode) { const el = document.getElementById('paymentMode'); if(el) el.value = data.paymentMode; }
    if(data.supplyType) { const el = document.getElementById('supplyType'); if(el) { el.value = data.supplyType; updateGSTType?.(); } }
    // ALWAYS clear items first — prevent duplication
    document.getElementById('itemsContainer').innerHTML = '';
    itemCount = 0;
    if(data.items?.length) {
      data.items.forEach(item => {
        addItem();
        const i = itemCount;
        set(`desc-${i}`, item.desc); set(`hsn-${i}`, item.hsn);
        set(`qty-${i}`, item.qty||1); set(`rate-${i}`, item.rate);
        const g = document.getElementById(`gst-${i}`); if(g) g.value = item.gst||18;
      });
    } else {
      addItem(); addItem(); addItem();
    }
    updateSummary?.();
  }

  // ── HELPER: remove duplicate item rows ──
  function removeDuplicateItems() {
    const rows = document.querySelectorAll('#itemsContainer .item-row');
    const seen = new Set();
    let removed = 0;
    rows.forEach(row => {
      const desc = row.querySelector('[id^="desc-"]')?.value?.trim().toLowerCase();
      if(!desc) return;
      if(seen.has(desc)) { row.remove(); removed++; }
      else seen.add(desc);
    });
    updateSummary?.();
    return removed;
  }

  // ── HELPER: clear all item rows ──
  function clearItems() {
    document.getElementById('itemsContainer').innerHTML = '';
    itemCount = 0;
    addItem(); addItem(); addItem();
    updateSummary?.();
  }

  async function processMessage(userText) {
    const txt = userText.toLowerCase().trim();

    // ════ LOCAL COMMANDS — no API needed ════

    // SAVE
    if(txt.includes('save') || txt === 'si') {
      saveDocument?.();
      setTimeout(() => renderSaved?.(), 200);
      return { text: '✅ Invoice saved! Check the Saved tab.', suggestions: ['⬇️ Download PDF','📄 New Invoice'], success: true };
    }
    // PDF / DOWNLOAD
    if(txt.includes('pdf') || txt.includes('download') || txt === 'dp') {
      generatePDF?.();
      return { text: '⬇️ PDF is downloading!', suggestions: ['💾 Save Invoice','📄 New Invoice'], success: true };
    }
    // NEW INVOICE
    if(txt === 'new invoice' || txt === 'ni' || txt === 'new' || txt.includes('clear form') || txt.includes('reset')) {
      // Skip confirm dialog — direct reset
      currentId = null;
      document.getElementById('itemsContainer').innerHTML = '';
      itemCount = 0;
      ['docNumber','buyerName','buyerAddress','buyerGSTIN','deliveryNote','buyerOrderNo','buyerOrderDate'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
      document.getElementById('docDate').valueAsDate = new Date();
      addItem?.(); addItem?.(); addItem?.();
      updateSummary?.();
      return { text: '📄 New invoice form is ready!', suggestions: ['📄 Create Invoice','📋 Create Quotation'], success: true };
    }
    // REMOVE DUPLICATES
    if(txt.includes('remove duplicate') || txt.includes('delete duplicate') || txt.includes('fix duplicate')) {
      const n = removeDuplicateItems();
      return { text: n > 0 ? `✅ Removed ${n} duplicate item(s)!` : '✅ No duplicates found!', suggestions: ['💾 Save Invoice','⬇️ Download PDF'], success: true };
    }
    // CLEAR ITEMS
    if(txt.includes('clear items') || txt.includes('remove all items') || txt.includes('delete all items')) {
      clearItems();
      return { text: '🗑️ All items cleared!', suggestions: ['📦 Add items','💾 Save'], success: true };
    }
    // SWITCH TO INVOICE
    if(txt === 'switch to invoice' || txt === 'invoice mode') {
      setMode?.('invoice');
      return { text: '📄 Switched to Invoice mode!', suggestions: ['💾 Save','⬇️ Download PDF'], success: true };
    }
    // SWITCH TO QUOTATION
    if(txt === 'switch to quotation' || txt === 'quotation mode') {
      setMode?.('quotation');
      return { text: '📋 Switched to Quotation mode!', suggestions: ['💾 Save','⬇️ Download PDF'], success: true };
    }
    // COMMAND HELP
    if(txt === 'help' || txt === 'commands' || txt === '?' || txt.includes('what can')) {
      return {
        text: `⚡ **VOLTA COMMAND LIST**

**📄 INVOICE / QUOTATION**
- \`ci [buyer] itm=[item] qt=[qty] rt=[rate]\` — Create Invoice
- \`cq [buyer] itm=[item] qt=[qty] rt=[rate]\` — Create Quotation
- \`inv no=INV-001\` — Set invoice number
- \`buyer=[name] addr=[address] gstin=[gstin]\` — Set buyer details

**➕ ITEMS**
- \`add itm=[name] qt=[qty] rt=[rate] gst=[%]\` — Add item
- \`add 3 items: LED 100@500, fans 50@2000, wire 200@50\` — Add multiple
- \`replace itm=[name] qt=[qty] rt=[rate]\` — Replace all items
- \`remove duplicate items\` — Remove duplicates
- \`clear items\` — Clear all items

**🏢 SELLER**
- \`fill seller [company name]\` — Fill seller details

**⚡ QUICK SHORTCUTS**
- \`si\` — Save invoice
- \`dp\` — Download PDF
- \`ni\` — New invoice
- \`ci\` — Create invoice

**❓ GST / HSN**
- \`hsn for LED\` — Get HSN code
- \`gst rate for fans\` — Get GST rate`,
        suggestions: ['📄 ci BATA itm=LED qt=100 rt=500','➕ add itm=fans qt=50 rt=2000','💾 si','⬇️ dp'],
        success: true
      };
    }

    // INVOICE NUMBER
    if(txt.startsWith('inv no=') || txt.startsWith('invoice no=') || txt.startsWith('inv=')) {
      const num = userText.split('=')[1]?.trim();
      if(num) { const el = document.getElementById('docNumber'); if(el) el.value = num; }
      return { text: `✅ Invoice number set to: **${userText.split('=')[1]?.trim()}**`, suggestions: ['💾 si','⬇️ dp'], success: true };
    }
    // BUYER QUICK SET
    const buyerMatch = userText.match(/buyer=([^,]+)/i);
    const addrMatch  = userText.match(/addr=([^,]+)/i);
    const gstinMatch = userText.match(/gstin=([^ ,]+)/i);
    if(buyerMatch || addrMatch || gstinMatch) {
      if(buyerMatch) { const el = document.getElementById('buyerName');    if(el) el.value = buyerMatch[1].trim(); }
      if(addrMatch)  { const el = document.getElementById('buyerAddress'); if(el) el.value = addrMatch[1].trim(); }
      if(gstinMatch) { const el = document.getElementById('buyerGSTIN');   if(el) el.value = gstinMatch[1].trim().toUpperCase(); }
      updateSummary?.();
      return { text: '✅ Buyer details updated!', suggestions: ['➕ Add Items','💾 si','⬇️ dp'], success: true };
    }

    // ════ AI COMMANDS ════
    try {
      const result = await callAI(userText, buildPrompt());
      const sug = result.suggestions?.length ? result.suggestions : ['💾 Save','⬇️ Download PDF'];

      if(result.action === 'fill_invoice')   { setMode?.('invoice');   showTab?.('form'); fillForm(result.data,'fill_invoice');   return { text: result.message||'✅ Invoice filled!', suggestions: sug, success: true }; }
      if(result.action === 'fill_quotation') { setMode?.('quotation'); showTab?.('form'); fillForm(result.data,'fill_quotation'); return { text: result.message||'✅ Quotation filled!', suggestions: sug, success: true }; }
      if(result.action === 'fill_seller')    { fillForm(result.data,'fill_seller');  return { text: result.message||'✅ Seller details filled!', suggestions: sug, success: true }; }
      if(result.action === 'add_items')      { fillForm(result.data,'add_items');    return { text: result.message||'✅ Items added!', suggestions: sug, success: true }; }
      if(result.action === 'replace_items')  {
        clearItems();
        fillForm(result.data,'add_items');
        return { text: result.message||'✅ Items replaced!', suggestions: sug, success: true };
      }
      if(result.action === 'answer')         { return { text: result.message, suggestions: result.suggestions||[], success: true }; }
      return { text: result.message||"Sorry, I didn't understand. Type **help** for commands.", suggestions: ['❓ Help / Commands'], success: false };
    } catch(err) {
      console.error('Volta error:', err);
      if(!navigator.onLine) return { text: '📵 No internet! Use the manual form.', suggestions: [], success: false };
      return { text: '❌ AI service error. Please try again.', suggestions: [], success: false };
    }
  }

  function buildUI() {
    if(document.getElementById('volta-container')) return;
    const c = document.createElement('div');
    c.id = 'volta-container';
    c.innerHTML = `
      <button id="volta-fab" onclick="VOLTA.toggle()" title="Ask Volta AI">⚡</button>
      <div id="volta-panel">
        <div id="volta-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;background:rgba(201,168,76,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px">⚡</div>
            <div>
              <div style="font-weight:700;font-size:14px;color:#c9a84c">${AI_NAME}</div>
              <div style="font-size:11px;color:#8facc8" id="volta-status">● Online — AI Invoice Assistant</div>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="VOLTA.clearChat()" style="background:rgba(255,255,255,0.1);border:none;color:#8facc8;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:12px">🗑️</button>
            <button onclick="VOLTA.toggle()" style="background:rgba(255,255,255,0.1);border:none;color:#8facc8;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:16px">✕</button>
          </div>
        </div>
        <div id="volta-messages"></div>
        <div id="volta-suggestions"></div>
        <div id="volta-input-area">
          <input id="volta-input" placeholder='Type e.g. "Create invoice for BATA - 100 LED 300W"' onkeydown="if(event.key==='Enter'){VOLTA.send();event.preventDefault()}" />
          <button id="volta-mic" onclick="VOLTA.toggleVoice()" title="Voice input">🎤</button>
          <button id="volta-send" onclick="VOLTA.send()">➤</button>
        </div>
      </div>
      <style>
        #volta-container{position:fixed;bottom:24px;right:24px;z-index:9998;font-family:'IBM Plex Sans',sans-serif}
        #volta-fab{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#1a3a5c,#234d78);box-shadow:0 4px 20px rgba(26,58,92,0.4);font-size:24px;color:#c9a84c;display:flex;align-items:center;justify-content:center;transition:all 0.3s}
        #volta-fab:hover{transform:scale(1.08)}
        #volta-panel{display:none;position:absolute;bottom:68px;right:0;width:380px;max-height:580px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(26,58,92,0.25);flex-direction:column;border:1.5px solid rgba(26,58,92,0.1)}
        #volta-panel.open{display:flex}
        #volta-header{background:linear-gradient(135deg,#1a3a5c,#234d78);padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
        #volta-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;min-height:200px;max-height:380px;background:#f8fafc}
        .volta-msg{display:flex;gap:8px;align-items:flex-start}
        .volta-msg.user{flex-direction:row-reverse}
        .volta-bubble{max-width:82%;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.5}
        .volta-msg.ai .volta-bubble{background:#fff;color:#1a2638;border:1px solid #e0e7ef;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
        .volta-msg.user .volta-bubble{background:linear-gradient(135deg,#1a3a5c,#234d78);color:#fff;border-bottom-right-radius:4px}
        .volta-avatar{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px;background:#f0f4f8}
        .volta-msg.ai .volta-avatar{background:rgba(201,168,76,0.15)}
        .volta-typing{display:flex;gap:4px;align-items:center;padding:4px 0}
        .volta-dot{width:6px;height:6px;border-radius:50%;background:#c9a84c;animation:voltaBounce 1.2s infinite}
        .volta-dot:nth-child(2){animation-delay:0.2s}.volta-dot:nth-child(3){animation-delay:0.4s}
        @keyframes voltaBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
        #volta-suggestions{padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;background:#fff;border-top:1px solid #f0f4f8;min-height:38px}
        .volta-chip{background:#f0f4f8;border:1px solid #d0d7e2;border-radius:20px;padding:4px 10px;font-size:11.5px;color:#1a3a5c;cursor:pointer;white-space:nowrap;font-weight:500;transition:all 0.15s}
        .volta-chip:hover{background:#c9a84c;color:#1a3a5c;border-color:#c9a84c}
        #volta-input-area{padding:10px 12px;background:#fff;border-top:1px solid #e8edf5;display:flex;gap:8px;align-items:center}
        #volta-input{flex:1;border:1.5px solid #d0d7e2;border-radius:10px;padding:9px 12px;font-size:13px;outline:none;font-family:'IBM Plex Sans',sans-serif}
        #volta-input:focus{border-color:#c9a84c}
        #volta-mic,#volta-send{width:36px;height:36px;border-radius:10px;border:none;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        #volta-mic{background:#f0f4f8;color:#4a5a70}
        #volta-mic.recording{background:#c0392b;color:#fff;animation:voltaPulse 1s infinite}
        #volta-send{background:#1a3a5c;color:#c9a84c}
        @keyframes voltaPulse{0%,100%{opacity:1}50%{opacity:0.6}}
      </style>`;
    document.body.appendChild(c);
    setTimeout(() => {
      addMessage('ai', `Hello! I'm **${AI_NAME}** — your AI Invoice Assistant! ⚡\n\nTry saying:\n• _"Create invoice for BATA — 100 LED 300W"_\n• _"Fill seller details for RSSDA Power Solution"_\n• _"Add 50 fans at Rs.2000"_\n• _"Download PDF"_ or _"Save invoice"_`);
      showSuggestions(['📄 Create Invoice','📋 Create Quotation','🏢 Fill Seller Details','💾 Save Invoice']);
    }, 300);
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  function updateOnlineStatus() {
    const s = document.getElementById('volta-status');
    if(!s) return;
    s.textContent = navigator.onLine ? '● Online — AI Invoice Assistant' : '○ Offline — Manual mode only';
    s.style.color = navigator.onLine ? '#4ade80' : '#f87171';
  }

  function addMessage(role, text, isTyping=false) {
    const msgs = document.getElementById('volta-messages');
    if(!msgs) return null;
    const div = document.createElement('div');
    div.className = `volta-msg ${role}`;
    const avatar = role==='ai' ? '⚡' : '👤';
    if(isTyping) {
      div.innerHTML = `<div class="volta-avatar">${avatar}</div><div class="volta-bubble"><div class="volta-typing"><div class="volta-dot"></div><div class="volta-dot"></div><div class="volta-dot"></div></div></div>`;
    } else {
      const html = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/_(.*?)_/g,'<em>$1</em>').replace(/\n/g,'<br>');
      div.innerHTML = `<div class="volta-avatar">${avatar}</div><div class="volta-bubble">${html}</div>`;
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showSuggestions(chips) {
    const c = document.getElementById('volta-suggestions');
    if(!c) return;
    c.innerHTML = chips.map(ch => `<div class="volta-chip" onclick="VOLTA.quickSend('${ch.replace(/['"<>]/g,'')}')">${ch}</div>`).join('');
  }

  function toggle() {
    isOpen = !isOpen;
    document.getElementById('volta-panel')?.classList.toggle('open', isOpen);
    document.getElementById('volta-fab').textContent = isOpen ? '✕' : '⚡';
  }

  async function send() {
    const input = document.getElementById('volta-input');
    if(!input) return;
    const text = input.value.trim();
    if(!text) return;
    input.value = '';
    document.getElementById('volta-suggestions').innerHTML = '';
    addMessage('user', text);
    const typingEl = addMessage('ai','',true);
    const result = await processMessage(text);
    typingEl?.remove();
    addMessage('ai', result.text);
    showSuggestions(result.suggestions?.length ? result.suggestions : ['📄 Create Invoice','📋 Create Quotation','💾 Save','⬇️ Download PDF']);
  }

  function quickSend(text) { const i = document.getElementById('volta-input'); if(i) i.value=text; send(); }

  function clearChat() {
    chatHistory = [];
    const m = document.getElementById('volta-messages');
    if(m) m.innerHTML = '';
    addMessage('ai', `Chat cleared! I'm **${AI_NAME}**, ready to help! ⚡`);
    showSuggestions(['📄 Create Invoice','📋 Create Quotation','💾 Save','⬇️ Download PDF']);
  }

  let recognition=null, isRecording=false;
  function toggleVoice() {
    if(!('webkitSpeechRecognition' in window)&&!('SpeechRecognition' in window)) { showToast?.('⚠️ Voice not supported','warn'); return; }
    const mic = document.getElementById('volta-mic');
    if(isRecording) { recognition?.stop(); return; }
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.onstart  = () => { isRecording=true;  mic?.classList.add('recording'); };
    recognition.onend    = () => { isRecording=false; mic?.classList.remove('recording'); };
    recognition.onerror  = () => { isRecording=false; mic?.classList.remove('recording'); };
    recognition.onresult = (e) => { const t=e.results[0][0].transcript; const i=document.getElementById('volta-input'); if(i) i.value=t; send(); };
    recognition.start();
  }

  function init() { buildUI(); console.log(`⚡ ${AI_NAME} AI initialized!`); }
  return { toggle, send, quickSend, clearChat, toggleVoice, init };

})();

document.addEventListener('DOMContentLoaded', () => VOLTA.init());