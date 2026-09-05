(function(){
  "use strict";

  // ---------------- constants ----------------
  const STORAGE_KEY = "timelinehub.franchiseTracker.v1";
  const DEFAULT_DATA = null;
  // Shared public folder: franquias/index.json lists files, e.g. ["zelda.json"]
  // Each file is a franchise JSON exported by the "Export franchise" button.
  // Works via HTTP/HTTPS only (not file:// because of CORS).
  const FRANCHISES_DIR = 'franquias/';
  const FRANCHISES_INDEX = FRANCHISES_DIR + 'index.json';

  const STR = {
    noFranchisesYet: 'No franchises yet. Create the first one below.',
    sidebarHint: 'Franchises saved under <code>franquias/</code> (listed in <code>index.json</code>) load automatically when the site is published. Use <b>Export franchise</b> to generate the correct file for that folder.',
    groupNoType: 'No type',
    statTotal: 'total',
    statDoneSingular: 'done', statDonePlural: 'done',
    statProgress: 'in progress',
    statPendingSingular: 'not started', statPendingPlural: 'not started',
    statusDone: 'Done', statusProgress: 'In progress', statusPending: 'Not started',
    defaultItemType: 'Item',
    franchiseTitleNew: 'New franchise', franchiseTitleEdit: 'Edit franchise',
    itemTitleNew: 'New item', itemTitleEdit: 'Edit item',
    noOtherItemsHint: 'No other items yet — this one will be a root of the tree.',
    confirmDelFranchiseTitle: 'Delete "{name}"?',
    confirmDelFranchiseText: 'All items and connections in this franchise will be permanently deleted.',
    confirmDelItemTitle: 'Delete "{name}"?',
    confirmDelItemText: 'Connections related to this item will also be removed.',
    confirmDeleteBtn: 'Delete',
    confirmImportTitle: 'Import data?',
    confirmImportText: 'This will replace all current data (in this browser) with the data from the imported file. This action cannot be undone.',
    confirmImportBtn: 'Import',
    alertInvalidJson: 'Could not read the file: the JSON is invalid.',
    alertInvalidFormat: 'This file does not look like a valid export from this app.',
    unnamed: 'Unnamed',
    searchPlaceholder: 'Search Wikipedia for a game...',
    searchBtn: 'Search',
    searching: 'Searching...',
    searchNoResults: 'No results found.',
    searchError: 'Could not search. Check your connection.',
    searchPick: 'Use',
    coverLabel: 'Cover',
    coverEmpty: 'No cover selected. Use the search above to fill it automatically.',
    coverRemove: 'Remove cover',
    typeGame: 'Game', typeBook: 'Book', typeComic: 'Comic', typeSeries: 'Series',
    typeMovieSeries: 'Movie series', typeMovie: 'Movie', typeAnime: 'Anime', typeOther: 'Other',
    typeSuggestions: ['Game','Book','Comic','Series','Movie series','Movie','Anime','Other']
  };

  function tf(template, vars){
    let s = template;
    Object.keys(vars || {}).forEach(k=>{ s = s.split('{'+k+'}').join(vars[k]); });
    return s;
  }

  // Flatten legacy data stored as { pt:{...}, en:{...} } into plain top-level fields.
  // Prefers English values, falls back to Portuguese.
  function _flatten(obj, fields){
    if(!obj) return;
    if(obj.pt || obj.en){
      const src = obj.en || obj.pt || {};
      fields.forEach(f=>{ if(obj[f] === undefined && src[f] !== undefined) obj[f] = src[f]; });
      delete obj.pt; delete obj.en;
    }
  }

  // ---------------- state ----------------
  function loadState(){
    let loaded = null;
    // Primary: unified storage
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) loaded = JSON.parse(raw);
    }catch(e){ console.warn("Failed to load saved data", e); }
    // Fallback: migrate from old per-language storages
    if(!loaded){
      for(const suffix of ['pt','en']){
        try{
          const rawOld = localStorage.getItem("timelinehub.franchiseTracker.v1." + suffix);
          if(rawOld){ const o = JSON.parse(rawOld); if(o && o.franchises) loaded = o; }
        }catch(_){}
      }
    }
    if(!loaded && DEFAULT_DATA){
      try{ loaded = JSON.parse(JSON.stringify(DEFAULT_DATA)); }
      catch(e){ console.warn("Invalid DEFAULT_DATA", e); }
    }
    if(!loaded) loaded = { franchises:{}, selectedFranchiseId:null };
    // Flatten any remaining nested pt/en format (both on franchises and on items)
    if(loaded.franchises){
      Object.values(loaded.franchises).forEach(f =>{
        _flatten(f, ['name','type','description']);
        if(f.items) Object.values(f.items).forEach(it => _flatten(it, ['title','type','description']));
      });
    }
    return loaded;
  }
  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ console.warn("Failed to save data", e); }
  }
  let state = loadState();

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  function currentFranchise(){
    if(!state.selectedFranchiseId) return null;
    return state.franchises[state.selectedFranchiseId] || null;
  }

  function slugify(str){
    return (str || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/(^-|-$)/g,'') || 'franchise';
  }

  // Normalize incoming / remote franchises. Accepts both legacy nested and new flat format.
  function normalizeFranchise(data, fallbackId){
    if(!data || typeof data !== 'object') return null;
    const id = data.id || fallbackId || uid();
    const createdAt = data.createdAt || Date.now();
    const edges = Array.isArray(data.edges) ? data.edges : [];
    const rawItems = (data.items && typeof data.items === 'object') ? data.items : {};
    const items = {};
    Object.entries(rawItems).forEach(([k,it])=>{
      if(!it || typeof it !== 'object') return;
      const iid = it.id || k;
      const base = {
        id: iid,
        status: it.status || 'pending',
        createdAt: it.createdAt || createdAt,
        cover: it.cover || '',
        title: it.title || '',
        type: it.type || '',
        description: it.description || ''
      };
      _flatten(it, ['title','type','description']);
      ['title','type','description'].forEach(f=>{ if(it[f] !== undefined) base[f] = it[f]; });
      items[iid] = base;
    });
    const base = {
      id, createdAt, edges, items,
      name: data.name || STR.unnamed,
      type: data.type || '',
      description: data.description || ''
    };
    _flatten(data, ['name','type','description']);
    ['name','type','description'].forEach(f=>{ if(data[f] !== undefined) base[f] = data[f]; });
    if(!base.name || !String(base.name).trim()) base.name = STR.unnamed;
    return base;
  }

  // Load franchises published in the franquias/ folder
  async function loadRemoteFranchises(){
    try{
      const res = await fetch(FRANCHISES_INDEX, { cache: 'no-store' });
      if(!res.ok) return [];
      const list = await res.json();
      if(!Array.isArray(list)) return [];
      const results = await Promise.all(list.map(async (filename)=>{
        try{
          const r = await fetch(FRANCHISES_DIR + filename, { cache: 'no-store' });
          if(!r.ok) return null;
          const data = await r.json();
          return normalizeFranchise(data, slugify(filename.replace(/\.json$/i,'')));
        }catch(e){ return null; }
      }));
      return results.filter(Boolean);
    }catch(e){
      // No folder, no server, or network error — fall back to local data only
      return [];
    }
  }

  // ---------------- DOM refs ----------------
  const franchiseList = document.getElementById('franchiseList');
  const franchiseHeader = document.getElementById('franchiseHeader');
  const franchiseTitle = document.getElementById('franchiseTitle');
  const franchiseDesc = document.getElementById('franchiseDesc');
  const statsRow = document.getElementById('statsRow');
  const canvasInner = document.getElementById('canvasInner');
  const edgesLayer = document.getElementById('edgesLayer');
  const nodesLayer = document.getElementById('nodesLayer');
  const noFranchiseState = document.getElementById('noFranchiseState');
  const noItemsState = document.getElementById('noItemsState');

  // ---------------- type color helper ----------------
  const TYPE_PALETTE = ['#c9a15f', '#7fb0c9', '#a68bc9', '#c4665c', '#8bc98f', '#c9c15f', '#c98fae', '#8f9fc9'];
  function colorForType(type){
    const key = (type || 'other').trim().toLowerCase();
    let hash = 0;
    for(let i=0;i<key.length;i++) hash = (hash*31 + key.charCodeAt(i)) >>> 0;
    return TYPE_PALETTE[hash % TYPE_PALETTE.length];
  }

  // ---------------- rendering: sidebar ----------------
  function renderSidebar(){
    franchiseList.innerHTML = '';
    const list = Object.values(state.franchises);
    if(!list.length){
      const div = document.createElement('div');
      div.className = 'empty-sidebar';
      div.textContent = STR.noFranchisesYet;
      franchiseList.appendChild(div);
      return;
    }

    const groups = {};
    const groupOrder = [];
    list.forEach(f=>{
      const key = (f.type || '').trim();
      if(!(key in groups)){ groups[key] = []; groupOrder.push(key); }
      groups[key].push(f);
    });
    groupOrder.sort((a,b)=>{
      if(a === '' && b !== '') return 1;
      if(b === '' && a !== '') return -1;
      const earliestA = Math.min(...groups[a].map(f=>f.createdAt));
      const earliestB = Math.min(...groups[b].map(f=>f.createdAt));
      return earliestA - earliestB;
    });

    groupOrder.forEach(key=>{
      const groupColor = key ? colorForType(key) : null;
      const header = document.createElement('div');
      header.className = 'ftype-group-header';
      header.textContent = key || STR.groupNoType;
      if(groupColor) header.style.color = groupColor;
      franchiseList.appendChild(header);

      groups[key].sort((a,b)=>a.createdAt-b.createdAt).forEach(f=>{
        const row = document.createElement('div');
        row.className = 'franchise-item' + (f.id === state.selectedFranchiseId ? ' active' : '');
        row.style.borderLeftColor = groupColor || 'transparent';
        row.addEventListener('click', ()=>{
          state.selectedFranchiseId = f.id;
          saveState();
          renderAll();
        });
        const top = document.createElement('div');
        top.className = 'franchise-item-top';
        const name = document.createElement('div');
        name.className = 'fname';
        const dispName = f.name || STR.unnamed;
        name.textContent = dispName;
        name.title = dispName;
        const count = document.createElement('div');
        count.className = 'fcount';
        count.textContent = Object.keys(f.items).length;
        top.appendChild(name); top.appendChild(count);
        row.appendChild(top);
        franchiseList.appendChild(row);
      });
    });
  }

  // ---------------- rendering: header ----------------
  function renderHeader(){
    const fr = currentFranchise();
    if(!fr){ franchiseHeader.classList.add('hidden'); return; }
    franchiseHeader.classList.remove('hidden');
    franchiseTitle.textContent = fr.name || STR.unnamed;
    franchiseDesc.textContent = fr.description || '';
    franchiseDesc.style.display = fr.description ? 'block' : 'none';

    const items = Object.values(fr.items);
    const done = items.filter(i=>i.status==='done').length;
    const progress = items.filter(i=>i.status==='progress').length;
    const pending = items.filter(i=>i.status==='pending').length;
    statsRow.innerHTML = '';
    const pills = [];
    if(fr.type) pills.push({label: fr.type, color: colorForType(fr.type)});
    pills.push(
      {label: items.length + ' ' + STR.statTotal, color:'var(--text-muted)'},
      {label: done + ' ' + (done===1 ? STR.statDoneSingular : STR.statDonePlural), color:'var(--done)'},
      {label: progress + ' ' + STR.statProgress, color:'var(--progress)'},
      {label: pending + ' ' + (pending===1 ? STR.statPendingSingular : STR.statPendingPlural), color:'var(--pending)'}
    );
    pills.forEach(p=>{
      const el = document.createElement('div');
      el.className = 'stat-pill';
      el.innerHTML = '<span class="stat-dot" style="background:'+p.color+'"></span>' + p.label;
      statsRow.appendChild(el);
    });
  }

  // ---------------- layout algorithm ----------------
  const NODE_W = 250, NODE_H = 110, COL_GAP = 120, ROW_GAP = 34, PAD = 50;

  function computeLayout(fr){
    const items = Object.values(fr.items);
    const parentsMap = {}, childrenMap = {};
    items.forEach(i=>{ parentsMap[i.id]=[]; childrenMap[i.id]=[]; });
    (fr.edges||[]).forEach(e=>{
      if(parentsMap[e.to] !== undefined && childrenMap[e.from] !== undefined){
        parentsMap[e.to].push(e.from);
        childrenMap[e.from].push(e.to);
      }
    });

    if(!items.length) return {positions:{}, width:0, height:0, parentsMap, childrenMap};

    // Longest-path depth via relaxation (robust to cycles)
    const depth = {};
    items.forEach(i=> depth[i.id]=0);
    for(let iter=0; iter<items.length+1; iter++){
      let changed = false;
      items.forEach(i=>{
        parentsMap[i.id].forEach(pid=>{
          if(depth[pid]+1 > depth[i.id]){
            depth[i.id] = depth[pid]+1;
            changed = true;
          }
        });
      });
      if(!changed) break;
    }

    const maxDepth = Math.max(...items.map(i=>depth[i.id]), 0);
    const columns = Array.from({length:maxDepth+1}, ()=>[]);
    items.slice().sort((a,b)=>a.createdAt-b.createdAt).forEach(i=> columns[depth[i.id]].push(i.id));

    let orderIndex = {};
    columns.forEach(col=> col.forEach((id,idx)=> orderIndex[id]=idx));
    for(let pass=0; pass<3; pass++){
      for(let c=1;c<columns.length;c++){
        columns[c].sort((a,b)=>{
          const avg = id => {
            const ps = parentsMap[id];
            if(!ps.length) return orderIndex[id];
            return ps.reduce((s,p)=>s+orderIndex[p],0)/ps.length;
          };
          return avg(a)-avg(b);
        });
        columns[c].forEach((id,idx)=> orderIndex[id]=idx);
      }
    }

    const colWidth = NODE_W + COL_GAP;
    const rowStep = NODE_H + ROW_GAP;
    const positions = {};
    let maxRows = 1;
    columns.forEach((col,c)=>{
      maxRows = Math.max(maxRows, col.length);
      col.forEach((id,r)=>{
        positions[id] = { x: PAD + c*colWidth, y: PAD + r*rowStep, w:NODE_W, h:NODE_H };
      });
    });

    const width = PAD*2 + columns.length*colWidth - COL_GAP;
    const height = PAD*2 + maxRows*rowStep - ROW_GAP;
    return { positions, width, height, parentsMap, childrenMap };
  }

  // ---------------- rendering: canvas ----------------
  function renderCanvas(){
    const fr = currentFranchise();
    edgesLayer.innerHTML = '';
    nodesLayer.innerHTML = '';

    if(!fr){
      noFranchiseState.classList.remove('hidden');
      noItemsState.classList.add('hidden');
      canvasInner.style.width = '0px';
      canvasInner.style.height = '0px';
      return;
    }
    noFranchiseState.classList.add('hidden');

    const items = Object.values(fr.items);
    if(!items.length){
      noItemsState.classList.remove('hidden');
      canvasInner.style.width = '0px';
      canvasInner.style.height = '0px';
      return;
    }
    noItemsState.classList.add('hidden');

    const { positions, width, height, parentsMap } = computeLayout(fr);
    canvasInner.style.width = width + 'px';
    canvasInner.style.height = height + 'px';
    edgesLayer.setAttribute('width', width);
    edgesLayer.setAttribute('height', height);
    edgesLayer.setAttribute('viewBox', '0 0 '+width+' '+height);

    // edges
    Object.entries(parentsMap).forEach(([childId, parents])=>{
      parents.forEach(pid=>{
        const p = positions[pid], c = positions[childId];
        if(!p || !c) return;
        const x1 = p.x + p.w, y1 = p.y + p.h/2;
        const x2 = c.x, y2 = c.y + c.h/2;
        const mx = (x1+x2)/2;
        const d = 'M '+x1+' '+y1+' C '+mx+' '+y1+', '+mx+' '+y2+', '+x2+' '+y2;
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d', d);
        const childItem = fr.items[childId];
        path.setAttribute('class', 'edge-path' + (childItem && childItem.status!=='pending' ? ' lit' : ''));
        edgesLayer.appendChild(path);
      });
    });

    // nodes
    items.forEach(item=>{
      const pos = positions[item.id];
      if(!pos) return;
      const card = document.createElement('div');
      card.className = 'node-card' + (item.status==='progress' ? ' st-progress' : '');
      card.style.left = pos.x + 'px';
      card.style.top = pos.y + 'px';
      card.style.width = pos.w + 'px';

      const coverEl = document.createElement('div');
      coverEl.className = 'node-cover';
      if(item.cover){
        const img = document.createElement('img');
        img.src = item.cover;
        img.alt = '';
        img.loading = 'lazy';
        coverEl.appendChild(img);
      } else {
        const initial = (item.title || ' ').trim().charAt(0).toUpperCase() || '?';
        coverEl.textContent = initial;
      }

      const body = document.createElement('div');
      body.className = 'node-body';

      const typeEl = document.createElement('div');
      typeEl.className = 'ntype';
      typeEl.textContent = item.type || STR.defaultItemType;

      const titleEl = document.createElement('div');
      titleEl.className = 'ntitle';
      titleEl.textContent = item.title || STR.unnamed;

      const statusEl = document.createElement('div');
      const statusLabel = item.status==='done' ? STR.statusDone : item.status==='progress' ? STR.statusProgress : STR.statusPending;
      statusEl.className = 'status-pill ' + item.status;
      statusEl.innerHTML = '<span class="status-dot"></span>' + statusLabel;

      body.appendChild(typeEl);
      body.appendChild(titleEl);
      body.appendChild(statusEl);

      card.appendChild(coverEl);
      card.appendChild(body);

      card.addEventListener('click', ()=> openItemModal(item.id));
      nodesLayer.appendChild(card);
    });
  }

  function renderAll(){
    renderSidebar();
    renderHeader();
    renderCanvas();
  }

  // ---------------- franchise modal ----------------
  const franchiseModalOverlay = document.getElementById('franchiseModalOverlay');
  const franchiseModalTitle = document.getElementById('franchiseModalTitle');
  const franchiseNameInput = document.getElementById('franchiseNameInput');
  const franchiseTypeInput = document.getElementById('franchiseTypeInput');
  const franchiseDescInput = document.getElementById('franchiseDescInput');
  let editingFranchiseId = null;

  function openFranchiseModal(existingId){
    editingFranchiseId = existingId || null;
    if(existingId){
      const f = state.franchises[existingId];
      franchiseModalTitle.textContent = STR.franchiseTitleEdit;
      franchiseNameInput.value = f.name || '';
      franchiseTypeInput.value = f.type || '';
      franchiseDescInput.value = f.description || '';
    } else {
      franchiseModalTitle.textContent = STR.franchiseTitleNew;
      franchiseNameInput.value = '';
      franchiseTypeInput.value = '';
      franchiseDescInput.value = '';
    }
    franchiseModalOverlay.classList.remove('hidden');
    setTimeout(()=>franchiseNameInput.focus(), 30);
  }
  function closeFranchiseModal(){ franchiseModalOverlay.classList.add('hidden'); }

  document.getElementById('newFranchiseBtn').addEventListener('click', ()=>openFranchiseModal(null));
  document.getElementById('emptyNewFranchiseBtn').addEventListener('click', ()=>openFranchiseModal(null));
  document.getElementById('franchiseCancelBtn').addEventListener('click', closeFranchiseModal);
  document.getElementById('editFranchiseBtn').addEventListener('click', ()=>{
    if(currentFranchise()) openFranchiseModal(currentFranchise().id);
  });
  document.getElementById('franchiseSaveBtn').addEventListener('click', ()=>{
    const name = franchiseNameInput.value.trim();
    if(!name){ franchiseNameInput.focus(); return; }
    const type = franchiseTypeInput.value.trim();
    const desc = franchiseDescInput.value.trim();
    if(editingFranchiseId){
      const f = state.franchises[editingFranchiseId];
      f.name = name; f.type = type; f.description = desc;
    } else {
      const id = uid();
      state.franchises[id] = { id, name, type, description: desc, createdAt: Date.now(), items:{}, edges:[] };
      state.selectedFranchiseId = id;
    }
    saveState();
    closeFranchiseModal();
    renderAll();
  });

  document.getElementById('deleteFranchiseBtn').addEventListener('click', ()=>{
    const fr = currentFranchise();
    if(!fr) return;
    openConfirm(tf(STR.confirmDelFranchiseTitle, {name: fr.name || STR.unnamed}), STR.confirmDelFranchiseText, ()=>{
      delete state.franchises[fr.id];
      state.selectedFranchiseId = null;
      saveState();
      renderAll();
    });
  });

  // ---------------- busca na biblioteca (Wikipedia) ----------------
  const WIKI_HOST = 'https://en.wikipedia.org';

  async function searchGameLibrary(query){
    const url = WIKI_HOST + '/w/api.php?action=query&generator=search&gsrsearch='
      + encodeURIComponent(query)
      + '&gsrlimit=8&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=300'
      + '&pilicense=any&exintro&explaintext&exlimit=max&format=json&origin=*';
    const res = await fetch(url);
    const j = await res.json();
    const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
    return pages
      .filter(p=>p.title)
      .map(p=>({
        title: p.title,
        thumb: (p.thumbnail && p.thumbnail.source) || '',
        extract: (p.extract || '').trim()
      }));
  }

  // ---------------- item modal ----------------
  const itemModalOverlay = document.getElementById('itemModalOverlay');
  const itemModalTitle = document.getElementById('itemModalTitle');
  const itemTitleInput = document.getElementById('itemTitleInput');
  const itemTypeInput = document.getElementById('itemTypeInput');
  const itemDescInput = document.getElementById('itemDescInput');
  const statusOptions = document.getElementById('statusOptions');
  const parentList = document.getElementById('parentList');
  const itemDeleteBtn = document.getElementById('itemDeleteBtn');
  const gameSearchInput = document.getElementById('gameSearchInput');
  const gameSearchBtn = document.getElementById('gameSearchBtn');
  const gameSearchResults = document.getElementById('gameSearchResults');
  const gameSearchStatus = document.getElementById('gameSearchStatus');
  const coverPreview = document.getElementById('coverPreview');
  let editingItemId = null;
  let selectedStatus = 'pending';
  let selectedCover = '';

  function openItemModal(existingId){
    const fr = currentFranchise();
    if(!fr) return;
    editingItemId = existingId || null;
    selectedStatus = 'pending';

    if(existingId){
      const it = fr.items[existingId];
      itemModalTitle.textContent = STR.itemTitleEdit;
      itemTitleInput.value = it.title || '';
      itemTypeInput.value = it.type || '';
      itemDescInput.value = it.description || '';
      selectedStatus = it.status;
      selectedCover = it.cover || '';
      itemDeleteBtn.classList.remove('hidden');
    } else {
      itemModalTitle.textContent = STR.itemTitleNew;
      itemTitleInput.value = '';
      itemTypeInput.value = '';
      itemDescInput.value = '';
      selectedCover = '';
      itemDeleteBtn.classList.add('hidden');
    }
    gameSearchInput.value = '';
    gameSearchResults.classList.add('hidden');
    gameSearchResults.innerHTML = '';
    gameSearchStatus.classList.add('hidden');
    renderCoverPreview();
    renderStatusOptions();

    parentList.innerHTML = '';
    const others = Object.values(fr.items).filter(i=>i.id !== existingId);
    if(!others.length){
      parentList.classList.add('empty-hint');
      parentList.textContent = STR.noOtherItemsHint;
    } else {
      parentList.classList.remove('empty-hint');
      const currentParents = new Set((fr.edges||[]).filter(e=>e.to===existingId).map(e=>e.from));
      others.forEach(other=>{
        const row = document.createElement('label');
        row.className = 'parent-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = other.id;
        cb.checked = currentParents.has(other.id);
        const span = document.createElement('span');
        span.textContent = other.title || STR.unnamed;
        row.appendChild(cb);
        row.appendChild(span);
        parentList.appendChild(row);
      });
    }

    itemModalOverlay.classList.remove('hidden');
    setTimeout(()=>itemTitleInput.focus(), 30);
  }
  function closeItemModal(){ itemModalOverlay.classList.add('hidden'); }

  function renderCoverPreview(){
    coverPreview.innerHTML = '';
    if(selectedCover){
      const img = document.createElement('img');
      img.src = selectedCover;
      img.alt = '';
      const text = document.createElement('div');
      text.className = 'cp-text';
      text.innerHTML = '<div class="cp-title">' + STR.coverLabel + '</div>' + (itemTitleInput.value || '');
      const rm = document.createElement('button');
      rm.className = 'cp-remove';
      rm.textContent = STR.coverRemove;
      rm.type = 'button';
      rm.addEventListener('click', ()=>{ selectedCover=''; renderCoverPreview(); });
      coverPreview.appendChild(img);
      coverPreview.appendChild(text);
      coverPreview.appendChild(rm);
    } else {
      const text = document.createElement('div');
      text.className = 'cp-text';
      text.textContent = STR.coverEmpty;
      coverPreview.appendChild(text);
    }
  }

  async function runGameSearch(){
    const q = gameSearchInput.value.trim();
    if(!q) return;
    gameSearchResults.classList.add('hidden');
    gameSearchResults.innerHTML = '';
    gameSearchStatus.classList.remove('hidden');
    gameSearchStatus.classList.remove('error');
    gameSearchStatus.textContent = STR.searching;
    gameSearchBtn.disabled = true;
    try{
      const results = await searchGameLibrary(q);
      gameSearchStatus.classList.add('hidden');
      if(!results.length){
        gameSearchResults.classList.remove('hidden');
        gameSearchResults.classList.add('empty-hint');
        gameSearchResults.textContent = STR.searchNoResults;
        return;
      }
      gameSearchResults.classList.remove('hidden');
      gameSearchResults.classList.remove('empty-hint');
      results.forEach(r=>{
        const row = document.createElement('div');
        row.className = 'search-result';
        const img = document.createElement('img');
        img.src = r.thumb || '';
        img.alt = '';
        const text = document.createElement('div');
        text.className = 'sr-text';
        const title = document.createElement('div');
        title.className = 'sr-title';
        title.textContent = r.title;
        const desc = document.createElement('div');
        desc.className = 'sr-desc';
        desc.textContent = r.extract;
        text.appendChild(title);
        text.appendChild(desc);
        const pick = document.createElement('div');
        pick.className = 'sr-pick';
        pick.textContent = STR.searchPick;
        row.appendChild(img);
        row.appendChild(text);
        row.appendChild(pick);
        row.addEventListener('click', ()=>{
          itemTitleInput.value = r.title;
          itemTypeInput.value = STR.typeGame;
          itemDescInput.value = r.extract;
          selectedCover = r.thumb;
          renderCoverPreview();
          gameSearchResults.classList.add('hidden');
        });
        gameSearchResults.appendChild(row);
      });
    }catch(e){
      gameSearchStatus.classList.add('error');
      gameSearchStatus.textContent = STR.searchError;
    }finally{
      gameSearchBtn.disabled = false;
    }
  }

  gameSearchBtn.addEventListener('click', runGameSearch);
  gameSearchInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); runGameSearch(); }
  });

  function renderStatusOptions(){
    [...statusOptions.children].forEach(el=>{
      el.classList.toggle('active', el.dataset.status === selectedStatus);
    });
  }
  statusOptions.addEventListener('click', (e)=>{
    const choice = e.target.closest('.status-choice');
    if(!choice) return;
    selectedStatus = choice.dataset.status;
    renderStatusOptions();
  });

  document.getElementById('addItemBtn').addEventListener('click', ()=>openItemModal(null));
  document.getElementById('emptyAddItemBtn').addEventListener('click', ()=>openItemModal(null));
  document.getElementById('itemCancelBtn').addEventListener('click', closeItemModal);

  document.getElementById('itemSaveBtn').addEventListener('click', ()=>{
    const fr = currentFranchise();
    if(!fr) return;
    const title = itemTitleInput.value.trim();
    if(!title){ itemTitleInput.focus(); return; }
    const type = itemTypeInput.value.trim();
    const desc = itemDescInput.value.trim();
    const checkedParents = [...parentList.querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.value);

    let id = editingItemId;
    if(id){
      const it = fr.items[id];
      it.title = title; it.type = type; it.description = desc; it.status = selectedStatus; it.cover = selectedCover;
    } else {
      id = uid();
      fr.items[id] = { id, title, type, description: desc, status: selectedStatus, cover: selectedCover, createdAt: Date.now() };
    }
    fr.edges = (fr.edges||[]).filter(e=>e.to !== id);
    checkedParents.forEach(pid=> fr.edges.push({from:pid, to:id}));

    saveState();
    closeItemModal();
    renderAll();
  });

  itemDeleteBtn.addEventListener('click', ()=>{
    const fr = currentFranchise();
    if(!fr || !editingItemId) return;
    const it = fr.items[editingItemId];
    openConfirm(tf(STR.confirmDelItemTitle, {name: it.title || STR.unnamed}), STR.confirmDelItemText, ()=>{
      delete fr.items[editingItemId];
      fr.edges = (fr.edges||[]).filter(e=>e.from!==editingItemId && e.to!==editingItemId);
      saveState();
      closeItemModal();
      renderAll();
    });
  });

  // ---------------- confirm modal ----------------
  const confirmOverlay = document.getElementById('confirmOverlay');
  const confirmTitle = document.getElementById('confirmTitle');
  const confirmText = document.getElementById('confirmText');
  const confirmOkBtn = document.getElementById('confirmOkBtn');
  let confirmCallback = null;

  function openConfirm(title, text, onOk, options){
    options = options || {};
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    confirmCallback = onOk;
    confirmOkBtn.textContent = options.okLabel || STR.confirmDeleteBtn;
    const danger = options.danger !== false;
    confirmOkBtn.classList.toggle('btn-danger', danger);
    confirmOkBtn.classList.toggle('btn-primary', !danger);
    confirmOverlay.classList.remove('hidden');
  }
  function closeConfirm(){ confirmOverlay.classList.add('hidden'); confirmCallback = null; }
  document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirm);
  confirmOkBtn.addEventListener('click', ()=>{
    if(confirmCallback) confirmCallback();
    closeConfirm();
  });

  // ---------------- global UX: close on backdrop / escape ----------------
  [franchiseModalOverlay, itemModalOverlay, confirmOverlay].forEach(overlay=>{
    overlay.addEventListener('click', (e)=>{
      if(e.target === overlay) overlay.classList.add('hidden');
    });
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      franchiseModalOverlay.classList.add('hidden');
      itemModalOverlay.classList.add('hidden');
      confirmOverlay.classList.add('hidden');
    }
  });

  document.getElementById('exportFranchiseBtn').addEventListener('click', ()=>{
    const fr = currentFranchise();
    if(!fr) return;
    const dataStr = JSON.stringify(fr, null, 2);
    const blob = new Blob([dataStr], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = slugify(fr.name || 'franchise') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ---------------- export / import (all) ----------------
  document.getElementById('exportBtn').addEventListener('click', ()=>{
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0,10);
    a.download = 'franchises-export-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  const importFileInput = document.getElementById('importFileInput');
  document.getElementById('importBtn').addEventListener('click', ()=> importFileInput.click());
  importFileInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (evt)=>{
      let parsed;
      try{ parsed = JSON.parse(evt.target.result); }
      catch(err){
        alert(STR.alertInvalidJson);
        importFileInput.value = '';
        return;
      }
      if(!parsed || typeof parsed !== 'object' || typeof parsed.franchises !== 'object'){
        alert(STR.alertInvalidFormat);
        importFileInput.value = '';
        return;
      }
      // Flatten any legacy nested pt/en data on import
      Object.values(parsed.franchises || {}).forEach(f =>{
        _flatten(f, ['name','type','description']);
        if(f.items) Object.values(f.items).forEach(it => _flatten(it, ['title','type','description']));
      });
      openConfirm(
        STR.confirmImportTitle,
        STR.confirmImportText,
        ()=>{
          state = parsed;
          if(!state.selectedFranchiseId){
            const ids = Object.keys(state.franchises || {});
            state.selectedFranchiseId = ids.length ? ids[0] : null;
          }
          saveState();
          renderAll();
        },
        { okLabel: STR.confirmImportBtn, danger: false }
      );
      importFileInput.value = '';
    };
    reader.readAsText(file);
  });

  // ---------------- bootstrap ----------------
  function setupStaticTextsAndSuggestions(){
    document.documentElement.lang = 'en';
    document.title = 'TimelineHUB — Franchise Order Organizer';
    const hintEl = document.getElementById('sidebarHintText');
    if(hintEl) hintEl.innerHTML = STR.sidebarHint;
    const opts = STR.typeSuggestions;
    const fd = document.getElementById('franchiseTypeSuggestions');
    if(fd) fd.innerHTML = opts.map(v => '<option value="'+v+'"></option>').join('');
    const id = document.getElementById('typeSuggestions');
    if(id) id.innerHTML = opts.map(v => '<option value="'+v+'"></option>').join('');
  }

  setupStaticTextsAndSuggestions();
  renderAll();

  loadRemoteFranchises().then(remoteList=>{
    if(!remoteList.length) return;
    let added = false;
    remoteList.forEach(fr=>{
      if(fr.id && !state.franchises[fr.id]){
        state.franchises[fr.id] = fr;
        added = true;
      }
    });
    if(added){
      if(!state.selectedFranchiseId){
        state.selectedFranchiseId = Object.keys(state.franchises)[0];
      }
      renderAll();
    }
  });
})();
