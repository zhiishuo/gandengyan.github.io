/* ================== 状态 ================== */
const LS_KEY = "gandengyan_scoreboard_mobile_full_v2_spring";
// 本轮草稿（不入账前都保留）
let roundDraft = { remain: [], springs: [] }; // remain[i]=数字|undefined；springs[i]=true|false
const DRAFT_KEY = LS_KEY + "_roundDraft";
function saveDraft(){ try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(roundDraft)); }catch(e){} }
function loadDraft(){
  try{
    const s = localStorage.getItem(DRAFT_KEY);
    if(s){ const d = JSON.parse(s); if(d && typeof d==='object'){ roundDraft = { remain: d.remain||[], springs: d.springs||[] }; } }
  }catch(e){}
}

let state = {
  players: Array.from({length:7}, (_,i)=>({name:"玩家"+(i+1), score:0})),
  history: [],
  bombCount: 0,
  remainWinner: 0,
};
function N(){return state.players.length;}
function save(){localStorage.setItem(LS_KEY, JSON.stringify(state));}
function load(){const s=localStorage.getItem(LS_KEY); if(s){try{state=JSON.parse(s)}catch{}}}
function mult(){return Math.pow(2, Math.max(0, +state.bombCount||0));}

/* ================== 视图切换（仅点击，无横手势） ================== */
const pagesEl = document.getElementById('pages');
const tabs = [...document.querySelectorAll('.tabbtn')];
const pageIndex = { players:0, score:1, rank:2, history:3 };
let current = 1; // 默认“记分”
function go(tab){
  const idx = pageIndex[tab] ?? 1;
  current = idx;
  pagesEl.style.transform = `translate3d(${-100*idx}%,0,0)`;
  tabs.forEach(b=> b.classList.toggle('active', b.dataset.tab===tab));

  const dock = document.getElementById('subtotalDock');
  if (dock) dock.classList.toggle('show', tab === 'score');

  stickDockToTab();
}
tabs.forEach(b=> b.addEventListener('click', ()=> go(b.dataset.tab)));

/* —— 切换赢家/模式等会重渲染，先把当前 DOM 写回草稿，避免丢失 —— */
function snapshotRoundDraftFromDOM(){
  document.querySelectorAll('.remainInp').forEach(inp=>{
    const idx = +inp.dataset.idx;
    const raw = (inp.value ?? "").trim();
    if (raw === "") return;
    const v = Math.max(0, Math.floor(Number(raw)||0));
    roundDraft.remain[idx] = v;
  });
  document.querySelectorAll('.springBtn').forEach(btn=>{
    const idx = +btn.dataset.idx;
    roundDraft.springs[idx] = btn.classList.contains('accent');
  });
  saveDraft();
}

/* 禁止横向滑动 */
(function lockHorizontalSwipe(){
  const vp = document.querySelector('.viewport');
  if(!vp) return;
  let sx=0, sy=0, locked=false;
  vp.addEventListener('touchstart', (e)=>{
    const t=e.touches[0]; sx=t.clientX; sy=t.clientY; locked=false;
  }, {passive:true});
  vp.addEventListener('touchmove', (e)=>{
    if(locked) { e.preventDefault(); return; }
    const t=e.touches[0];
    const dx=Math.abs(t.clientX - sx), dy=Math.abs(t.clientY - sy);
    if(dx > dy + 4){ locked = true; e.preventDefault(); }
  }, {passive:false});
})();

/* ================== 工具 ================== */
function escapeHTML(s=''){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ================== 公共渲染 ================== */
function updateBombUI(){
  const m = mult();
  const text = `炸弹 ${state.bombCount} ｜ 倍数 ×${m}`;
  const mini = document.getElementById('badgeMini');
  const bombValue = document.getElementById('bombValue');
  if(mini) mini.textContent = text;
  if(bombValue) bombValue.textContent = text;
  const dockMult = document.getElementById('dockMult');
  if(dockMult) dockMult.textContent = '×'+m;
}
function pulseBomb(className='bombPulse'){
  const card = document.getElementById('bombCard');
  if(!card) return;
  card.classList.remove('bombPulse','boomUp','boomDown');
  void card.offsetWidth;
  card.classList.add(className);
}

/* ================== 玩家 ================== */
function renderPlayers(){
  document.getElementById('playerCountEcho').textContent = String(N());
  document.getElementById('setP').value = String(N());
  const tb = document.getElementById('playersBody'); tb.innerHTML="";
  state.players.forEach((p,idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${idx+1}</td><td><input class="name" value="${escapeHTML(p.name)}" data-idx="${idx}"/></td><td class="mono">${p.score}</td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('input.name').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const i = +e.target.dataset.idx;
      state.players[i].name = e.target.value || ('玩家'+(i+1));
      save(); renderRemainArea(); renderQuickWinner(); renderWinner1(); renderRank(); recomputePreview();
    });
  });
  renderRank();
}

/* ================== 记分页：赢家按钮（仅按钮选择-用于 remain） ================== */
function renderQuickWinner(){
  const q = document.getElementById('winnerQuick'); if(!q) return;
  // 标题 + 按钮容器
  q.innerHTML = `<span class="winnerLabel">赢家选择：</span>`;
  state.players.forEach((p,i)=>{
    const b = document.createElement('button');
    b.className = 'btn winnerBtn' + (i===state.remainWinner?' accent':'');
    b.textContent = p.name;
    b.addEventListener('click', ()=>{
      snapshotRoundDraftFromDOM();
      state.remainWinner = i;
      save(); saveDraft();
      renderRemainArea();
      renderQuickWinner();
      recomputePreview();
    });
    q.appendChild(b);
  });
}

/* winner1 模式：渲染可选赢家列表 */
function renderWinner1(){
  const wl = document.getElementById('winnerList'); if(!wl) return;
  wl.innerHTML = "";
  state.players.forEach((p,i)=>{
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = p.name;
    if(wl.dataset.selected && +wl.dataset.selected===i) b.classList.add('accent');
    b.addEventListener('click', ()=>{
      wl.dataset.selected = String(i);
      renderWinner1();
      recomputePreview();
    });
    wl.appendChild(b);
  });
}


/* 春天/剩牌表格 */
function renderRemainArea(){
  snapshotRoundDraftFromDOM();
  loadDraft();
  const rb = document.getElementById('remainBody'); if(!rb) return;
  rb.innerHTML="";
  state.players.forEach((p,i)=>{
    const isW = (i===state.remainWinner);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHTML(p.name)} ${isW?'<span class="tagWinner">赢家</span>':''}</td>
      <td>
        <input type="number" min="0" step="1" inputmode="numeric"
          class="num mono remainInp" data-idx="${i}" ${isW?'disabled':''}
          placeholder="${isW?'赢家=0':'剩牌数'}">
      </td>
      <td>
        <button class="btn springBtn" data-idx="${i}" ${isW?'disabled':''}>春天</button>
      </td>`;
    rb.appendChild(tr);
    // 行配色：赢家行高亮；赢家之后的行加轻微底色区分
    if (isW) tr.classList.add('winnerRow');
    if (i > state.remainWinner) tr.classList.add('afterWinnerRow');

    const inp = tr.querySelector('.remainInp');
    if (roundDraft.remain[i] != null) {
      inp.value = roundDraft.remain[i];
    } else if (isW) {
      inp.value = 0;
    }
    const btn = tr.querySelector('.springBtn');
    if (roundDraft.springs[i]) btn.classList.add('accent');
  });

  rb.querySelectorAll('.remainInp').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const idx = +e.target.dataset.idx;
      const raw = (e.target.value||'').trim();
      roundDraft.remain[idx] = (raw==='' ? undefined : Math.max(0, Math.floor(Number(raw)||0)));
      saveDraft();
      recomputePreview();
    });
  });
  rb.querySelectorAll('.springBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(btn.disabled) return;
      btn.classList.toggle('accent');
      const idx = +btn.dataset.idx;
      roundDraft.springs[idx] = btn.classList.contains('accent');
      saveDraft();
      recomputePreview();
    });
  });

  const mb = document.getElementById('manualBody'); if(!mb) return;
  mb.innerHTML="";
  state.players.forEach((p,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHTML(p.name)}</td><td><input class="num mono manualInp" data-idx="${i}" placeholder="0"></td>`;
    mb.appendChild(tr);
  });
  mb.querySelectorAll('.manualInp').forEach(inp=> inp.addEventListener('input', recomputePreview));
}

/* ================== 记分计算/预览/入账 ================== */
function switchMode(){
  snapshotRoundDraftFromDOM();               // 切模式先保存草稿
  const mode = document.getElementById('mode').value;
  document.getElementById('modeRemain').style.display = (mode==='remain')?'block':'none';
  document.getElementById('modeWinner1').style.display = (mode==='winner1')?'block':'none';
  document.getElementById('modeManual').style.display = (mode==='manual')?'block':'none';
  if(mode==='winner1') renderWinner1();
  recomputePreview();
}

function computeRound(){
  const mode = document.getElementById('mode').value;
  const n = N(), m = mult();

  if (mode==='remain'){
    const w = state.remainWinner;
    // 完全基于 roundDraft 计算，避免 DOM 切换导致的瞬时空值
    const remain = Array(n).fill(0);
    const springMark = Array(n).fill(false);

    for (let i=0; i<n; i++){
      if (i === w) { remain[i] = 0; continue; }
      const v = roundDraft.remain[i] == null ? 0 : Number(roundDraft.remain[i]);
      if (!Number.isFinite(v) || v < 0 || Math.floor(v) !== v) return {error:"剩牌必须是非负整数"};
      remain[i] = v;
      springMark[i] = !!roundDraft.springs[i];
    }

    const delta = Array(n).fill(0); let pot=0;
    for(let i=0;i<n;i++){
      if(i===w) continue;
      const mul = springMark[i]?2:1;
      const loss = - remain[i]*m*mul;
      delta[i]=loss; pot += -loss;
    }
    delta[w]=pot;
    const remDesc = remain.map((v,i)=>`${state.players[i].name}:${v}${springMark[i]?'(春)':''}`).join('， ');
    const payload = { mode:'remain', winner: w, remain:[...remain], springs:[...springMark] };
    return {delta, desc:`剩牌结算 ｜ 赢家：${state.players[w].name} ｜ 剩牌：[${remDesc}] ×${m}`, springs:springMark, payload};
  }

  if(mode==='winner1'){
    const wl=document.getElementById('winnerList');
    const sel = wl ? wl.dataset.selected : undefined;
    if(sel===undefined) return {error:"请选择胜者"};
    const idx=+sel, delta=Array(n).fill(0); delta[idx]=1*m;
    const payload = { mode:'winner1', winner: idx };
    return {delta, desc:`胜者：${state.players[idx].name}（+1×${m}）`, payload};
  }

  // manual
  const inputs = [...document.querySelectorAll('.manualInp')];
  const delta = Array(n).fill(0);
  const manualRaw = Array(n).fill(0);
  for(const inp of inputs){
    const i=+inp.dataset.idx; const raw=(inp.value??"").trim(); const v=raw===""?0:Number(raw);
    if(!Number.isFinite(v)) return {error:"请输入数字"};
    manualRaw[i]=v; // 未乘倍数
    delta[i]=v*m;   // 乘倍数
  }
  const payload = { mode:'manual', manual: manualRaw };
  return {delta, desc:`手工输入 ×${m}`, payload};
}

function recomputePreview(){
  const res = computeRound();
  const box = document.getElementById('previewBox');
  const pot = document.getElementById('winnerPot');
  const dockPot = document.getElementById('dockPot');
  if(res?.error){
    if(box) box.textContent='— '+res.error;
    if(pot) pot.textContent='';
    if(dockPot) dockPot.textContent='+0';
    return;
  }
  const signs = res.delta.map((v,i)=>`${state.players[i].name}:${v>=0?'+':''}${v}`);
  if(box) box.textContent = signs.join('， ');
  if (document.getElementById('mode').value==='remain'){
    const w = state.remainWinner;
    if(pot) pot.textContent = `赢家（${state.players[w].name}）本轮预计：+${res.delta[w]}`;
    if(dockPot) dockPot.textContent = `+${res.delta[w]}`;
  }else{
    if(pot) pot.textContent='';
    if(dockPot) dockPot.textContent = '+0';
  }
}

function applyRound(delta, desc, payload){
  const m = mult();
  state.players.forEach((p,i)=> p.score += (delta[i]||0));
  state.history.push({desc, delta, bombs: state.bombCount, mult: m, payload});
  renderPlayers(); renderRemainArea(); renderQuickWinner(); renderWinner1(); renderRank(); renderHistory();
  save();
}

function commitRound(){
  const prevBomb = state.bombCount;
  const res = computeRound();
  if (res.error){ alert(res.error); return; }
  if (res.springs){
    const list = res.springs.map((v,i)=> v?state.players[i].name:null).filter(Boolean);
    if (list.length) res.desc += ` ｜ 春天：${list.join('、')}`;
  }

  // 1) 入账
  applyRound(res.delta, res.desc, res.payload);

  // 2) 清理输入（开始新一轮）
  document.querySelectorAll('.remainInp').forEach(inp=>{ if(!inp.disabled) inp.value=""; });
  document.querySelectorAll('.springBtn').forEach(btn=>{ if(!btn.disabled) btn.classList.remove('accent'); });
  document.querySelectorAll('.manualInp').forEach(inp=> inp.value="");
  const wl=document.getElementById('winnerList'); if(wl) wl.dataset.selected="";
  roundDraft = { remain: [], springs: [] }; // 仅在入账后清空草稿
  saveDraft();
  recomputePreview();

  // 3) 入账后炸弹自动清零
  const resetBtn = document.getElementById('bombReset');
  if (resetBtn) resetBtn.click();
  else { state.bombCount=0; updateBombUI(); save(); recomputePreview(); }
  pulseBomb(prevBomb < state.bombCount ? 'boomUp' : 'bombPulse');

  // 4) 反馈
  showToast('✅ 入账成功');
}

/* ================== 历史 ================== */
function renderHistory(){
  const tb = document.getElementById('historyBody'); if(!tb) return;
  tb.innerHTML="";
  state.history.forEach((h,ri)=>{
    const tr = document.createElement('tr');
    const detail = h.delta.map((v,i)=>`${state.players[i]?.name||('玩家'+(i+1))}:${v>=0?'+':''}${v}`).join('， ');
    tr.innerHTML = `<td>${ri+1}</td>
      <td class="mono">${h.desc} ｜ 炸弹:${h.bombs}（×${h.mult}） ｜ ${detail}</td>
      <td>
        <button class="btn" data-edit="${ri}">编辑</button>
        <button class="btn" data-del="${ri}">删除</button>
      </td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('button[data-del]').forEach(b=> b.addEventListener('click', ()=>deleteRound(+b.dataset.del)));
  tb.querySelectorAll('button[data-edit]').forEach(b=> b.addEventListener('click', ()=>editRound(+b.dataset.edit)));
}
function deleteRound(idx){
  const h=state.history[idx]; if(!h) return;
  state.players.forEach((p,i)=> p.score -= (h.delta[i]||0));
  state.history.splice(idx,1);
  renderPlayers(); renderRemainArea(); renderQuickWinner(); renderWinner1(); renderRank(); renderHistory(); save();
  recomputePreview();
}
function editRound(idx){
  const h = state.history[idx]; if(!h){ return; }
  if(!h.payload){
    alert('这条历史缺少可编辑数据（旧记录）。请手动删除后重新入账一次。');
    return;
  }
  // 1) 回滚到该回合之前：重算前缀分数并截断历史
  state.players.forEach(p=> p.score = 0);
  for(let r=0; r<idx; r++){
    const hi = state.history[r];
    for(let j=0;j<state.players.length;j++) state.players[j].score += (hi.delta[j]||0);
  }
  state.history = state.history.slice(0, idx);

  // 2) 还原倍数/炸弹 & UI 草稿
  state.bombCount = h.bombs || 0;
  const pl = h.payload;
  const modeSel = document.getElementById('mode');
  if(modeSel) modeSel.value = pl.mode;

  if(pl.mode === 'remain'){
    state.remainWinner = +pl.winner || 0;
    roundDraft = { remain: [...(pl.remain||[])], springs: [...(pl.springs||[])] };
    saveDraft();
  } else if(pl.mode === 'winner1'){
    roundDraft = { remain: [], springs: [] };
    saveDraft();
    setTimeout(()=>{
      const wl = document.getElementById('winnerList');
      if(wl) wl.dataset.selected = String(pl.winner);
      renderWinner1();
      recomputePreview();
    }, 0);
  } else if(pl.mode === 'manual'){
    roundDraft = { remain: [], springs: [] };
    saveDraft();
    setTimeout(()=>{
      const inputs = [...document.querySelectorAll('.manualInp')];
      (pl.manual||[]).forEach((v,i)=>{ if(inputs[i]) inputs[i].value = String(v); });
      recomputePreview();
    }, 0);
  }

  // 3) 切到记分页并刷新
  save();
  renderPlayers(); renderRemainArea(); renderQuickWinner(); renderWinner1(); renderRank(); renderHistory();
  updateBombUI(); recomputePreview();
  go('score');
}
function clearHistory(){
  if(!state.history.length) return;
  if(!confirm('确定清空历史并回滚分数吗？')) return;
  for(const h of state.history){ state.players.forEach((p,i)=> p.score -= (h.delta[i]||0)); }
  state.history=[]; renderPlayers(); renderRemainArea(); renderQuickWinner(); renderWinner1(); renderRank(); renderHistory(); save();
  recomputePreview();
}
function exportCsv(){
  const header = ["Round", ...state.players.map(p=>p.name), "Bombs", "Multiplier", "Desc"];
  const rows=[header];
  state.history.forEach((h,ri)=> rows.push([ri+1, ...state.players.map((_,i)=> h.delta[i]||0), h.bombs, h.mult, h.desc]));
  rows.push(["TOTAL", ...state.players.map(p=>p.score), "", "", ""]);
  const csv = rows.map(r=> r.map(x=> `"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"}); const url = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='gandengyan_scores_mobile_full_spring.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/* ================== 实时排名 ================== */
function renderRank(){
  const box = document.getElementById('rankList'); if(!box) return;
  box.innerHTML="";
  const meta = document.getElementById('rankMeta');
  const arr = state.players.map((p,i)=>({i, name:p.name, score:p.score}));
  arr.sort((a,b)=> b.score - a.score || a.i - b.i);

  if(meta){
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    meta.textContent = `共 ${arr.length} 人 ｜ 更新于 ${hh}:${mm}`;
  }

  const nf = new Intl.NumberFormat('zh-CN');
  arr.forEach((r,idx)=>{
    const card = document.createElement('div');
    const medalClass = idx===0?'gold':idx===1?'silver':idx===2?'bronze':'';
    let pv = r.score>0?'pos':(r.score<0?'neg':'zero');
    card.className = `rankCard ${idx<3?'top':''} ${pv}`;
    card.innerHTML = `
      <div class="rankNo ${medalClass}">${idx+1}</div>
      <div class="rankName">${escapeHTML(r.name)}</div>
      <div class="rankScore mono">${r.score>=0?'+':''}${nf.format(r.score)}<span class="unit">分</span></div>
    `;
    box.appendChild(card);
  });
}

/* ================== 炸弹交互（按钮） ================== */
function bindBombUI(){
  const dec = document.getElementById('bombDec');
  const inc = document.getElementById('bombInc');
  const rst = document.getElementById('bombReset');
  updateBombUI();
  function sync(newVal){
    const old = state.bombCount;
    const k = Math.max(0, Math.floor(Number(newVal)||0));
    state.bombCount = k;
    updateBombUI(); save(); recomputePreview();
    pulseBomb(k > old ? 'boomUp' : 'boomDown');
  }
  if(dec) dec.addEventListener('click', ()=> sync(state.bombCount - 1));
  if(inc) inc.addEventListener('click', ()=> sync(state.bombCount + 1));
  if(rst) rst.addEventListener('click', ()=> sync(0));
}

/* ================== 其它操作 ================== */
function zeroScores(){ if(!confirm("将所有玩家分数清零？")) return; state.players.forEach(p=>p.score=0); renderPlayers(); renderRank(); save(); }
function resetNames(){ state.players.forEach((p,i)=> p.name="玩家"+(i+1)); renderPlayers(); renderRemainArea(); renderQuickWinner(); renderWinner1(); save(); }
function applyPlayerCount(newN){
  snapshotRoundDraftFromDOM();
  newN = Math.max(2, Math.min(12, Math.floor(newN)));
  if (newN===N()) return;
  if (!confirm("更改人数会清空历史记录并可能重置部分名字，确定吗？")) return;
  for(const h of state.history){
    for(let i=0;i<h.delta.length;i++){
      if(i<state.players.length) state.players[i].score -= (h.delta[i]||0);
    }
  }
  state.history=[];
  if (newN>N()){
    const start=N();
    for(let i=start;i<newN;i++) state.players.push({name:"玩家"+(i+1), score:0});
  }else{
    state.players.length=newN;
  }
  state.remainWinner=0;
  roundDraft = { remain: [], springs: [] }; // 人数变化时清空草稿
  saveDraft();
  renderPlayers(); renderRemainArea(); renderQuickWinner(); renderWinner1(); renderRank(); renderHistory(); save(); recomputePreview();
}
function undo(){ if(!state.history.length) return; deleteRound(state.history.length-1); }

/* ================== Toast ================== */
let toastTimer=null;
function showToast(text){
  const t=document.getElementById('toast');
  if(!t) return;
  t.textContent=text; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=> t.classList.remove('show'), 1500);
}

/* ================== Dock 紧贴Tab ================== */
function stickDockToTab(){
  const tab = document.querySelector('.tabbar');
  const dock = document.getElementById('subtotalDock');
  if(!tab || !dock) return;
  const h = tab.getBoundingClientRect().height || 64;
  dock.style.bottom = `calc(${h}px + env(safe-area-inset-bottom))`;
}
window.addEventListener('resize', stickDockToTab);

/* ================== 初始化 ================== */
function init(){
  load();
  loadDraft();
  go('score'); // 默认“记分”
  renderPlayers(); renderRemainArea(); renderQuickWinner(); renderWinner1(); renderRank(); renderHistory();
  bindBombUI(); switchMode(); updateBombUI(); recomputePreview();
  stickDockToTab();

  // 交互绑定
  const modeSel = document.getElementById('mode');
  if(modeSel) modeSel.addEventListener('change', switchMode);
  const commitBtn = document.getElementById('commit_m');
  if(commitBtn) commitBtn.addEventListener('click', commitRound);
  const undoBtn = document.getElementById('undo');
  if(undoBtn) undoBtn.addEventListener('click', undo);
  const exportBtn = document.getElementById('exportCsv');
  if(exportBtn) exportBtn.addEventListener('click', exportCsv);
  const clearBtn = document.getElementById('clearHistory');
  if(clearBtn) clearBtn.addEventListener('click', clearHistory);
  const minusP = document.getElementById('minusP');
  if(minusP) minusP.addEventListener('click', ()=> applyPlayerCount(N()-1));
  const plusP = document.getElementById('plusP');
  if(plusP) plusP.addEventListener('click', ()=> applyPlayerCount(N()+1));
  const applyP = document.getElementById('applyP');
  if(applyP) applyP.addEventListener('click', ()=> applyPlayerCount(Number(document.getElementById('setP').value||N())));
  const zeroBtn = document.getElementById('zeroScores');
  if(zeroBtn) zeroBtn.addEventListener('click', zeroScores);
  const resetBtn = document.getElementById('resetNames');
  if(resetBtn) resetBtn.addEventListener('click', resetNames);
}
init();
