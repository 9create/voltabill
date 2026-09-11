// ════════════════════════════════════════════════════════
// db.js — DATA LAYER for GST Invoice Pro
// Buyer Master | Item Master | HSN Database
// All data stored in localStorage — works 100% OFFLINE
// ════════════════════════════════════════════════════════

const DB = (() => {

  // ── KEYS ──
  const KEY_BUYERS = 'gst_buyers';
  const KEY_ITEMS  = 'gst_items';
  const KEY_CONFIG = 'gst_config';

  // ── UTILS ──
  function load(key)       { try { return JSON.parse(localStorage.getItem(key)) || []; } catch(e) { return []; } }
  function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  function uid()           { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  // ════════════════════════════════════════════════════════
  // BUYER MASTER
  // ════════════════════════════════════════════════════════
  const Buyers = {
    getAll() { return load(KEY_BUYERS); },

    get(id)  { return this.getAll().find(b => b.id === id) || null; },

    search(query) {
      if(!query || query.length < 1) return [];
      const q = query.toLowerCase();
      return this.getAll()
        .filter(b => b.name.toLowerCase().includes(q) || (b.gstin||'').toLowerCase().includes(q))
        .slice(0, 8);
    },

    save(buyer) {
      const all = this.getAll();
      if(buyer.id) {
        const idx = all.findIndex(b => b.id === buyer.id);
        if(idx >= 0) { all[idx] = { ...all[idx], ...buyer, updatedAt: Date.now() }; }
        else { all.push({ ...buyer, updatedAt: Date.now() }); }
      } else {
        all.push({ ...buyer, id: uid(), createdAt: Date.now(), updatedAt: Date.now() });
      }
      save(KEY_BUYERS, all);
    },

    delete(id) {
      save(KEY_BUYERS, this.getAll().filter(b => b.id !== id));
    },

    // Save current buyer from invoice form
    saveFromForm() {
      const name = document.getElementById('buyerName')?.value.trim();
      if(!name) { showToast('⚠️ Buyer name required', 'warn'); return; }
      const buyer = {
        name,
        address:  document.getElementById('buyerAddress')?.value.trim() || '',
        gstin:    document.getElementById('buyerGSTIN')?.value.trim()   || '',
        state:    document.getElementById('buyerState')?.value.trim()   || '',
        phone:    document.getElementById('buyerPhone')?.value.trim()   || '',
      };
      // Check if already exists by name
      const existing = this.getAll().find(b => b.name.toLowerCase() === name.toLowerCase());
      if(existing) buyer.id = existing.id;
      this.save(buyer);
      showToast('✅ Buyer saved to directory!', 'success');
    },

    // Fill invoice form from buyer object
    fillForm(buyer) {
      const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
      set('buyerName',    buyer.name);
      set('buyerAddress', buyer.address);
      set('buyerGSTIN',   buyer.gstin);
      set('buyerState',   buyer.state);
      set('buyerPhone',   buyer.phone);
      updateSummary?.();
      showToast('✅ Buyer filled!', 'success');
    }
  };

  // ════════════════════════════════════════════════════════
  // ITEM MASTER
  // ════════════════════════════════════════════════════════
  const Items = {
    getAll() { return load(KEY_ITEMS); },

    get(id)  { return this.getAll().find(i => i.id === id) || null; },

    search(query) {
      if(!query || query.length < 1) return [];
      const q = query.toLowerCase();
      return this.getAll()
        .filter(i => i.name.toLowerCase().includes(q) || (i.hsn||'').includes(q))
        .slice(0, 10);
    },

    save(item) {
      const all = this.getAll();
      if(item.id) {
        const idx = all.findIndex(i => i.id === item.id);
        if(idx >= 0) { all[idx] = { ...all[idx], ...item, updatedAt: Date.now() }; }
        else { all.push({ ...item, updatedAt: Date.now() }); }
      } else {
        all.push({ ...item, id: uid(), createdAt: Date.now(), updatedAt: Date.now() });
      }
      save(KEY_ITEMS, all);
    },

    delete(id) {
      save(KEY_ITEMS, this.getAll().filter(i => i.id !== id));
    },

    // Fill a specific item row in the invoice
    fillRow(rowId, item) {
      const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
      set(`desc-${rowId}`,  item.name);
      set(`hsn-${rowId}`,   item.hsn);
      set(`qty-${rowId}`,   item.defaultQty || 1);
      set(`rate-${rowId}`,  item.rate);
      set(`gst-${rowId}`,   item.gst);
      updateSummary?.();
      showToast('✅ Item filled!', 'success');
    }
  };

  // ════════════════════════════════════════════════════════
  // HSN DATABASE — Electrical + Common items
  // ════════════════════════════════════════════════════════
  const HSN_DATABASE = [
    // Lighting
    { hsn:'94054090', gst:18, keywords:['led','flood light','street light','light','lamp','bulb','tube','cfl','luminaire','lantern','spotlight','downlight','panel light','batten'] },
    { hsn:'94051090', gst:18, keywords:['chandelier','ceiling fan light','pendant','decoration light'] },
    { hsn:'94052090', gst:18, keywords:['table lamp','desk lamp','floor lamp','bedside lamp'] },
    { hsn:'94053090', gst:18, keywords:['neon','neon sign','neon tube','sign light'] },

    // Fans
    { hsn:'84145990', gst:18, keywords:['fan','ceiling fan','exhaust fan','table fan','wall fan','pedestal fan','cooler fan','ventilation fan','blower'] },
    { hsn:'84143090', gst:18, keywords:['air compressor','compressor'] },

    // Wires & Cables
    { hsn:'85444290', gst:18, keywords:['wire','cable','copper wire','pvc wire','flexible wire','house wire','building wire','winding wire'] },
    { hsn:'85444190', gst:18, keywords:['coaxial','coaxial cable','antenna cable','rf cable'] },
    { hsn:'85446090', gst:18, keywords:['armoured cable','underground cable','xlpe cable','power cable','mv cable','lt cable'] },
    { hsn:'85447090', gst:18, keywords:['optical fibre','fiber optic','fibre cable'] },

    // Switches & Sockets
    { hsn:'85364190', gst:18, keywords:['switch','modular switch','electric switch','toggle switch','rocker switch','sensor switch','smart switch','dimmer'] },
    { hsn:'85369090', gst:18, keywords:['socket','plug','outlet','power socket','usb socket','5 pin','6 pin','16 amp socket'] },
    { hsn:'85366990', gst:18, keywords:['connector','terminal block','wire connector','junction'] },
    { hsn:'85365090', gst:18, keywords:['relay','contactor','magnetic contactor','overload relay'] },

    // MCB / Protection
    { hsn:'85362090', gst:18, keywords:['mcb','miniature circuit breaker','circuit breaker','breaker','mccb','elcb','rccb','rcbo','isolator','switch disconnector'] },
    { hsn:'85371090', gst:18, keywords:['distribution board','db box','distribution box','panel board','consumer unit','fuse box','load center','board'] },
    { hsn:'85359000', gst:18, keywords:['fuse','hrc fuse','fuse base','fuse holder','cartridge fuse'] },

    // Transformers & Power
    { hsn:'85044090', gst:18, keywords:['transformer','distribution transformer','step down','step up','isolation transformer','auto transformer','ups transformer'] },
    { hsn:'85044010', gst:18, keywords:['ups','uninterrupted power','ups system','online ups','offline ups'] },
    { hsn:'85044050', gst:18, keywords:['inverter','solar inverter','home inverter','pcm inverter'] },
    { hsn:'85044030', gst:18, keywords:['battery charger','charger','smps','power supply','adapter'] },

    // Generators & Motors
    { hsn:'85021390', gst:18, keywords:['generator','genset','diesel generator','petrol generator','dg set'] },
    { hsn:'85016200', gst:18, keywords:['motor','electric motor','ac motor','dc motor','induction motor','single phase motor','three phase motor'] },
    { hsn:'85015290', gst:18, keywords:['pump motor','submersible motor','water pump motor'] },

    // Solar
    { hsn:'85414011', gst:5,  keywords:['solar panel','solar module','photovoltaic','pv panel','solar cell'] },
    { hsn:'85044060', gst:12, keywords:['solar inverter charger','solar pcm','solar charge controller','mppt'] },

    // Conduits & Accessories
    { hsn:'39172390', gst:18, keywords:['conduit','pvc conduit','rigid conduit','flexible conduit','pipe','electrical pipe'] },
    { hsn:'73182900', gst:18, keywords:['cable tray','cable trunking','duct','raceway'] },
    { hsn:'85389000', gst:18, keywords:['switchgear','switchgear part','busbar','bus bar','copper busbar'] },

    // Meters & Instruments
    { hsn:'90281000', gst:18, keywords:['energy meter','kwh meter','electricity meter','smart meter','prepaid meter'] },
    { hsn:'90272090', gst:18, keywords:['voltmeter','ammeter','multimeter','clamp meter','power analyzer','panel meter'] },
    { hsn:'90330090', gst:18, keywords:['sensor','pir sensor','motion sensor','temperature sensor','proximity sensor','current sensor'] },

    // Alarms & Safety
    { hsn:'85311090', gst:18, keywords:['alarm','fire alarm','smoke detector','smoke alarm','hooter','siren','bell','buzzer','mcpcb'] },
    { hsn:'85312090', gst:18, keywords:['indicator','pilot lamp','signal lamp','indicator light','led indicator'] },

    // Batteries
    { hsn:'85072000', gst:28, keywords:['battery','lead acid battery','tubular battery','inverter battery','vrla','smf battery'] },
    { hsn:'85076000', gst:18, keywords:['lithium battery','li-ion','lithium ion','lifepo4','lithium phosphate'] },

    // Tools
    { hsn:'84672900', gst:18, keywords:['drill','electric drill','hammer drill','rotary drill','impact drill'] },
    { hsn:'84679900', gst:18, keywords:['grinder','angle grinder','grinding machine','sander'] },

    // IT / Services
    { hsn:'998313',   gst:18, keywords:['software','it service','website','web development','app development','computer','laptop'] },
    { hsn:'995411',   gst:18, keywords:['installation','electrical installation','wiring','fitting','erection','commission'] },
    { hsn:'995412',   gst:18, keywords:['repair','maintenance','service','amc','annual maintenance'] },
    { hsn:'998346',   gst:18, keywords:['training','education','coaching'] },
  ];

  const HSN = {
    lookup(description) {
      if(!description) return null;
      const desc = description.toLowerCase();
      let best = null, bestScore = 0;
      for(const entry of HSN_DATABASE) {
        for(const kw of entry.keywords) {
          if(desc.includes(kw)) {
            const score = kw.length; // longer keyword = more specific match
            if(score > bestScore) { bestScore = score; best = entry; }
          }
        }
      }
      return best; // { hsn, gst, keywords }
    },

    getAll() { return HSN_DATABASE; },

    searchCode(query) {
      if(!query) return [];
      const q = query.toLowerCase();
      return HSN_DATABASE.filter(e =>
        e.hsn.includes(q) || e.keywords.some(k => k.includes(q))
      ).slice(0, 10);
    }
  };

  // ════════════════════════════════════════════════════════
  // CONFIG — Seller default settings
  // ════════════════════════════════════════════════════════
  const Config = {
    get() { try { return JSON.parse(localStorage.getItem(KEY_CONFIG)) || {}; } catch(e) { return {}; } },
    set(data) { localStorage.setItem(KEY_CONFIG, JSON.stringify({ ...this.get(), ...data })); },

    // Save seller info from form as default
    saveSellerDefaults() {
      const get = id => document.getElementById(id)?.value.trim() || '';
      this.set({
        sellerName:    get('sellerName'),
        sellerAddress: get('sellerAddress'),
        sellerGSTIN:   get('sellerGSTIN'),
        sellerState:   get('sellerState'),
        sellerEmail:   get('sellerEmail'),
        sellerPhone:   get('sellerPhone'),
        bankName:      get('bankName'),
        bankAccNo:     get('bankAccNo'),
        bankIFSC:      get('bankIFSC'),
        bankBranch:    get('bankBranch'),
        declaration:   get('declaration'),
      });
      showToast('✅ Company profile saved as default!', 'success');
    },

    // Load seller defaults into form
    loadSellerDefaults() {
      const cfg = this.get();
      const set = (id, val) => { const el = document.getElementById(id); if(el && val) el.value = val; };
      set('sellerName',    cfg.sellerName);
      set('sellerAddress', cfg.sellerAddress);
      set('sellerGSTIN',   cfg.sellerGSTIN);
      set('sellerState',   cfg.sellerState);
      set('sellerEmail',   cfg.sellerEmail);
      set('sellerPhone',   cfg.sellerPhone);
      set('bankName',      cfg.bankName);
      set('bankAccNo',     cfg.bankAccNo);
      set('bankIFSC',      cfg.bankIFSC);
      set('bankBranch',    cfg.bankBranch);
      set('declaration',   cfg.declaration);
    }
  };

  // ════════════════════════════════════════════════════════
  // AUTOCOMPLETE UI ENGINE
  // ════════════════════════════════════════════════════════
  const AutoComplete = {
    activeDropdown: null,

    // Attach buyer autocomplete to buyer name field
    initBuyer() {
      const input = document.getElementById('buyerName');
      if(!input) return;
      const wrapper = input.parentElement;
      wrapper.style.position = 'relative';

      input.addEventListener('input', () => {
        this.closeDrop();
        const q = input.value.trim();
        if(q.length < 1) return;
        const results = Buyers.search(q);
        if(!results.length) return;
        this.showDrop(input, results.map(b => ({
          label: b.name,
          sub:   (b.gstin ? 'GSTIN: ' + b.gstin + ' | ' : '') + (b.state || ''),
          onSelect: () => { Buyers.fillForm(b); this.closeDrop(); }
        })));
      });

      input.addEventListener('blur', () => setTimeout(() => this.closeDrop(), 200));
    },

    // Attach item autocomplete to a description field by rowId
    initItem(rowId) {
      const input = document.getElementById(`desc-${rowId}`);
      if(!input) return;
      const wrapper = input.parentElement;
      wrapper.style.position = 'relative';

      input.addEventListener('input', () => {
        this.closeDrop();
        const q = input.value.trim();
        if(q.length < 2) return;

        // First: item master results
        const masterResults = Items.search(q);
        // Then: HSN auto-detect
        const hsnMatch = HSN.lookup(q);

        const allOptions = [];

        masterResults.forEach(item => {
          allOptions.push({
            label:    item.name,
            sub:      'HSN: ' + item.hsn + ' | Rate: Rs.' + item.rate + ' | GST: ' + item.gst + '%',
            onSelect: () => { Items.fillRow(rowId, item); this.closeDrop(); }
          });
        });

        if(hsnMatch && !masterResults.length) {
          allOptions.push({
            label:    '🔍 HSN Auto-detected',
            sub:      'HSN: ' + hsnMatch.hsn + ' | GST: ' + hsnMatch.gst + '%',
            onSelect: () => {
              const setV = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
              setV(`hsn-${rowId}`, hsnMatch.hsn);
              setV(`gst-${rowId}`, hsnMatch.gst);
              updateSummary?.();
              this.closeDrop();
            }
          });
        }

        if(allOptions.length) this.showDrop(input, allOptions);
      });

      input.addEventListener('blur', () => setTimeout(() => this.closeDrop(), 200));
    },

    showDrop(inputEl, options) {
      this.closeDrop();
      const drop = document.createElement('div');
      drop.id = 'db-dropdown';
      drop.style.cssText = `
        position:absolute; top:100%; left:0; right:0; z-index:9999;
        background:#fff; border:1.5px solid #c9a84c; border-radius:8px;
        box-shadow:0 8px 24px rgba(26,58,92,0.18); max-height:240px;
        overflow-y:auto; margin-top:2px;
      `;
      options.forEach(opt => {
        const item = document.createElement('div');
        item.style.cssText = `padding:9px 12px; cursor:pointer; border-bottom:1px solid #f0f4f8;`;
        item.innerHTML = `<div style="font-weight:600;font-size:13px;color:#1a3a5c">${opt.label}</div>
                          <div style="font-size:11px;color:#4a5a70;margin-top:2px">${opt.sub}</div>`;
        item.addEventListener('mousedown', opt.onSelect);
        item.addEventListener('mouseover', () => item.style.background = '#f0f4f8');
        item.addEventListener('mouseout',  () => item.style.background = '#fff');
        drop.appendChild(item);
      });
      inputEl.parentElement.appendChild(drop);
      this.activeDropdown = drop;
    },

    closeDrop() {
      const d = document.getElementById('db-dropdown');
      if(d) d.remove();
      this.activeDropdown = null;
    }
  };

  // ════════════════════════════════════════════════════════
  // MASTER MODAL — View/Edit Buyers & Items
  // ════════════════════════════════════════════════════════
  const Modal = {
    open(type) {
      document.getElementById('db-modal')?.remove();
      const isBuyer = type === 'buyer';
      const records = isBuyer ? Buyers.getAll() : Items.getAll();

      const modal = document.createElement('div');
      modal.id = 'db-modal';
      modal.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;
        display:flex;align-items:center;justify-content:center;padding:16px;
      `;

      modal.innerHTML = `
        <div style="background:#fff;border-radius:12px;width:100%;max-width:680px;
                    max-height:85vh;display:flex;flex-direction:column;overflow:hidden;
                    box-shadow:0 20px 60px rgba(0,0,0,0.3)">
          <div style="background:#1a3a5c;padding:16px 20px;display:flex;align-items:center;justify-content:space-between">
            <h3 style="color:#c9a84c;margin:0;font-size:16px">
              ${isBuyer ? '👥 Buyer Directory' : '📦 Item Master'}
            </h3>
            <button onclick="document.getElementById('db-modal').remove()"
              style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0 4px">✕</button>
          </div>

          <div style="padding:16px;border-bottom:1px solid #e0e7ef;display:flex;gap:10px">
            <input id="db-search" placeholder="Search..." style="
              flex:1;padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;
              font-size:13px;outline:none
            " />
            <button onclick="DB.Modal.addNew('${type}')" style="
              background:#c9a84c;color:#1a3a5c;border:none;border-radius:7px;
              padding:9px 16px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap
            ">+ Add New</button>
          </div>

          <div id="db-list" style="overflow-y:auto;flex:1;padding:12px 16px"></div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });

      this.renderList(type, records);

      document.getElementById('db-search').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        const filtered = records.filter(r =>
          r.name.toLowerCase().includes(q) || (r.hsn||'').includes(q) || (r.gstin||'').toLowerCase().includes(q)
        );
        this.renderList(type, filtered);
      });
    },

    renderList(type, records) {
      const isBuyer = type === 'buyer';
      const container = document.getElementById('db-list');
      if(!container) return;

      if(!records.length) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:#a0aab8;font-size:14px">
          No records found. Add new ${isBuyer ? 'buyer' : 'item'} to get started.
        </div>`;
        return;
      }

      container.innerHTML = records.map(r => `
        <div style="border:1.5px solid #e8edf5;border-radius:8px;padding:12px 14px;
                    margin-bottom:8px;display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px;color:#1a3a5c">${r.name}</div>
            ${isBuyer ? `
              <div style="font-size:11.5px;color:#4a5a70;margin-top:3px">
                ${r.address ? r.address.replace(/\n/g,'  |  ') : ''}
                ${r.gstin ? '<br>GSTIN: <b>' + r.gstin + '</b>' : ''}
                ${r.state ? '  |  ' + r.state : ''}
              </div>
            ` : `
              <div style="font-size:11.5px;color:#4a5a70;margin-top:3px">
                HSN: <b>${r.hsn||'—'}</b>  |  Rate: <b>Rs.${r.rate||'0'}</b>  |  GST: <b>${r.gst||'18'}%</b>
                ${r.unit ? '  |  Unit: ' + r.unit : ''}
              </div>
            `}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button onclick="DB.Modal.editRecord('${type}','${r.id}')"
              style="background:#f0f4f8;border:none;border-radius:6px;padding:6px 10px;
                     cursor:pointer;font-size:12px;color:#1a3a5c;font-weight:600">✏️ Edit</button>
            <button onclick="DB.Modal.deleteRecord('${type}','${r.id}')"
              style="background:#fdf0f0;border:none;border-radius:6px;padding:6px 10px;
                     cursor:pointer;font-size:12px;color:#c0392b;font-weight:600">🗑️</button>
          </div>
        </div>
      `).join('');
    },

    addNew(type) { this.editRecord(type, null); },

    editRecord(type, id) {
      const isBuyer = type === 'buyer';
      const rec = id ? (isBuyer ? Buyers.get(id) : Items.get(id)) : null;

      const form = document.createElement('div');
      form.id = 'db-form-modal';
      form.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10001;
        display:flex;align-items:center;justify-content:center;padding:16px
      `;

      form.innerHTML = `
        <div style="background:#fff;border-radius:12px;width:100%;max-width:460px;
                    box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden">
          <div style="background:#1a3a5c;padding:14px 18px;display:flex;align-items:center;justify-content:space-between">
            <h3 style="color:#c9a84c;margin:0;font-size:15px">
              ${rec ? 'Edit' : 'Add New'} ${isBuyer ? 'Buyer' : 'Item'}
            </h3>
            <button onclick="document.getElementById('db-form-modal').remove()"
              style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer">✕</button>
          </div>
          <div style="padding:18px;display:flex;flex-direction:column;gap:12px">
            ${isBuyer ? `
              <label style="font-size:12px;font-weight:600;color:#4a5a70">BUYER NAME *</label>
              <input id="fm-name" value="${rec?.name||''}" placeholder="SACHIN HEMANT BAJAJ"
                style="padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;outline:none"/>
              <label style="font-size:12px;font-weight:600;color:#4a5a70">ADDRESS</label>
              <textarea id="fm-address" rows="2" placeholder="Welahari, Nagpur"
                style="padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;outline:none;resize:vertical">${rec?.address||''}</textarea>
              <label style="font-size:12px;font-weight:600;color:#4a5a70">GSTIN</label>
              <input id="fm-gstin" value="${rec?.gstin||''}" placeholder="27XXXXXXX"
                style="padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;font-family:monospace;outline:none"/>
              <label style="font-size:12px;font-weight:600;color:#4a5a70">STATE</label>
              <input id="fm-state" value="${rec?.state||''}" placeholder="Maharashtra, Code: 27"
                style="padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;outline:none"/>
            ` : `
              <label style="font-size:12px;font-weight:600;color:#4a5a70">ITEM NAME *</label>
              <input id="fm-name" value="${rec?.name||''}" placeholder="LED Flood Light 300W"
                style="padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;outline:none"
                oninput="DB._hsnHint(this.value)"/>
              <div id="fm-hsn-hint" style="font-size:11px;color:#c9a84c;min-height:16px;margin-top:-8px"></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div>
                  <label style="font-size:12px;font-weight:600;color:#4a5a70">HSN/SAC CODE</label>
                  <input id="fm-hsn" value="${rec?.hsn||''}" placeholder="94054090"
                    style="width:100%;margin-top:4px;padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;font-family:monospace;outline:none;box-sizing:border-box"/>
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;color:#4a5a70">GST %</label>
                  <select id="fm-gst" style="width:100%;margin-top:4px;padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;outline:none;box-sizing:border-box">
                    <option value="0"  ${rec?.gst==0?'selected':''}>0%</option>
                    <option value="5"  ${rec?.gst==5?'selected':''}>5%</option>
                    <option value="12" ${rec?.gst==12?'selected':''}>12%</option>
                    <option value="18" ${!rec||rec?.gst==18?'selected':''}>18%</option>
                    <option value="28" ${rec?.gst==28?'selected':''}>28%</option>
                  </select>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div>
                  <label style="font-size:12px;font-weight:600;color:#4a5a70">RATE (Rs.)</label>
                  <input id="fm-rate" type="number" value="${rec?.rate||''}" placeholder="300"
                    style="width:100%;margin-top:4px;padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;outline:none;box-sizing:border-box"/>
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;color:#4a5a70">DEFAULT QTY</label>
                  <input id="fm-qty" type="number" value="${rec?.defaultQty||1}" placeholder="1"
                    style="width:100%;margin-top:4px;padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;outline:none;box-sizing:border-box"/>
                </div>
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;color:#4a5a70">UNIT</label>
                <input id="fm-unit" value="${rec?.unit||''}" placeholder="Nos / Mtr / Kg / Set"
                  style="width:100%;margin-top:4px;padding:9px 12px;border:1.5px solid #d0d7e2;border-radius:7px;font-size:13px;outline:none;box-sizing:border-box"/>
              </div>
            `}
          </div>
          <div style="padding:14px 18px;background:#f8fafc;display:flex;gap:10px;justify-content:flex-end">
            <button onclick="document.getElementById('db-form-modal').remove()"
              style="padding:9px 18px;background:#e8edf5;border:none;border-radius:7px;
                     font-size:13px;font-weight:600;cursor:pointer;color:#1a3a5c">Cancel</button>
            <button onclick="DB.Modal._save('${type}','${id||''}')"
              style="padding:9px 20px;background:#c9a84c;border:none;border-radius:7px;
                     font-size:13px;font-weight:700;cursor:pointer;color:#1a3a5c">💾 Save</button>
          </div>
        </div>
      `;

      document.body.appendChild(form);
    },

    _save(type, id) {
      const isBuyer = type === 'buyer';
      const name = document.getElementById('fm-name')?.value.trim();
      if(!name) { alert('Name is required'); return; }

      if(isBuyer) {
        Buyers.save({
          id: id || undefined,
          name,
          address: document.getElementById('fm-address')?.value.trim() || '',
          gstin:   document.getElementById('fm-gstin')?.value.trim()   || '',
          state:   document.getElementById('fm-state')?.value.trim()   || '',
        });
      } else {
        Items.save({
          id: id || undefined,
          name,
          hsn:        document.getElementById('fm-hsn')?.value.trim()          || '',
          gst:        parseInt(document.getElementById('fm-gst')?.value)        || 18,
          rate:       parseFloat(document.getElementById('fm-rate')?.value)     || 0,
          defaultQty: parseInt(document.getElementById('fm-qty')?.value)        || 1,
          unit:       document.getElementById('fm-unit')?.value.trim()          || '',
        });
      }

      document.getElementById('db-form-modal')?.remove();
      showToast('✅ Saved!', 'success');
      this.open(type); // refresh modal
    },

    deleteRecord(type, id) {
      if(!confirm('Delete this record?')) return;
      if(type === 'buyer') Buyers.delete(id);
      else Items.delete(id);
      showToast('🗑️ Deleted', 'warn');
      this.open(type);
    }
  };

  // HSN hint while typing item name in form
  function _hsnHint(val) {
    const hint = document.getElementById('fm-hsn-hint');
    if(!hint) return;
    const match = HSN.lookup(val);
    if(match) {
      hint.textContent = '✅ HSN Auto-detected: ' + match.hsn + ' | GST ' + match.gst + '%';
      document.getElementById('fm-hsn').value = match.hsn;
      document.getElementById('fm-gst').value = match.gst;
    } else {
      hint.textContent = '';
    }
  }

  // ════════════════════════════════════════════════════════
  // INIT — called on page load
  // ════════════════════════════════════════════════════════
  function init() {
    // Load seller defaults into form
    Config.loadSellerDefaults();
    // Init buyer autocomplete
    AutoComplete.initBuyer();
  }

  // Public API
  return { Buyers, Items, HSN, Config, AutoComplete, Modal, init, _hsnHint };

})();

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => DB.init());
