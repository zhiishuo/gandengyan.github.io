/* ================== 状态 ================== */
const LS_KEY="gandengyan_scoreboard_mobile_full_v2_spring";
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

/* ================== 视图切换（仅点击，无滑手势） ================== */
const pagesEl = document.getElementById('pages');
const tabs = [...document.querySelectorAll('.tabbtn')];
const pageIndex = { players:0, score:1, rank:2, history:3 };
let current = 1; // 默认“记分”
function go(tab){
  const idx = pageIndex[tab] ?? 1;
  current = idx;
  pagesEl.style.transform = `translate3d(${-100*idx}%,0,0)`;
  tabs.forEach(b=> b.classList.toggle('active', b.dataset.tab===tab));

  // 仅记分页显示小计条
  const dock = document.getElementById('subtotalDock');
  if (dock) dock.classList.toggle('show', tab === 'score');

  stickDockToTab();
}
tabs.forEach(b=> b.addEventListener('click', ()=> go(b.dataset.tab)));

/* 禁止横向滑动（Safari 双保险） */
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
function pulseBomb(){
  const card = document.getElementById('bombCard');
  if(!card) return;
  card.classList.remove('bombPulse'); void card.offsetWidth; card.classList.add('bombPulse');
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
      save(); renderRemainArea(); renderQuickWinner(); renderRank(); recomputePreview();
    });
  });
  renderRank();
}

/* ================== 记分页：赢家按钮/输入 ================== */
function renderQuickWinner(){
  const q = document.getElementById('winnerQuick'); q.innerHTML="";
  state.players.forEach((p,i)=>{
    const b = document.createElement('button');
    b.className = 'btn' + (i===state.remainWinner?' accent':'');
    b.textContent = p.name;
    b.addEventListener('click', ()=>{ state.remainWinner=i; save(); renderRemainArea(); renderQuickWinner(); recomputePreview(); });
    q.appendChild(b);
  });
}

/* 春天：按钮化（每行一个按钮） */
function renderRemainArea(){
  const rb = document.getElementById('remainBody'); rb.innerHTML="";
  state.players.forEach((p,i)=>{
    const isW = (i===state.remainWinner);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHTML(p.name)}</td>
      <td>
        <input type="number" min="0" step="1" inputmode="numeric"
          class="num mono remainInp" data-idx="${i}" ${isW?'disabled':''}
          placeholder="${isW?'赢家=0':'剩牌数'}">
      </td>
      <td>
        <button class="btn springBtn" data-idx="${i}" ${isW?'disabled':''}>春天</button>
      </td>`;
    rb.appendChild(tr);
  });
  rb.querySelectorAll('.remainInp').forEach(inp=> inp.addEventListener('input', recomputePreview));
  rb.querySelectorAll('.springBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(btn.disabled) return;
      btn.classList.toggle('accent'); // 高亮=春天
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
  const mode = document.getElementById('mode').value;
  document.getElementById('modeRemain').style.display = (mode==='remain')?'block':'none';
  document.getElementById('modeWinner1').style.display = (mode==='winner1')?'block':'none';
  document.getElementById('modeManual').style.display = (mode==='manual')?'block':'none';
  recomputePreview();
}

function computeRound(){
  const mode = document.getElementById('mode').value;
  const n = N(), m = mult();
  if (mode==='remain'){
    const w = state.remainWinner;
    const inputs = [...document.querySelectorAll('.remainInp')];
    const springBtns = [...document.querySelectorAll('.springBtn')];
    const remain = Array(n).fill(0), springMark = Array(n).fill(false);

    for (const inp of inputs){
      const i=+inp.dataset.idx; const raw=inp.value.trim();
      const v = raw===""?0:Number(raw);
      if (i===w) remain[i]=0;
      else{
        if(!Number.isFinite(v) || v<0 || Math.floor(v)!==v) return {error:"剩牌必须是非负整数"};
        remain[i]=v;
      }
    }
    for(const btn of springBtns){
      const i=+btn.dataset.idx;
      springMark[i] = btn.classList.contains('accent') && i!==w;
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
    return {delta, desc:`剩牌结算 ｜ 赢家：${state.players[w].name} ｜ 剩牌：[${remDesc}] ×${m}`, springs:springMark};
  }else if(mode==='winner1'){
    const sel = document.getElementById('winnerList').dataset.selected;
    if(sel===undefined) return {error:"请选择胜者"};
    const idx=+sel, delta=Array(n).fill(0); delta[idx]=1*m;
    return {delta, desc:`胜者：${state.players[idx].name}（+1×${m}）`};
  }else{
    const inputs = [...document.querySelectorAll('.manualInp')];
    const delta = Array(n).fill(0);
    for(const inp of inputs){
      const i=+inp.dataset.idx; const raw=inp.value.trim(); const v=raw===""?0:Number(raw);
      if(!Number.isFinite(v)) return {error:"请输入数字"};
      delta[i]=v*m;
    }
    return {delta, desc:`手工输入 ×${m}`};
  }
}

function recomputePreview(){
  const res = computeRound();
  const box = document.getElementById('previewBox');
  const pot = document.getElementById('winnerPot');
  const dockPot = document.getElementById('dockPot');
  if(res?.error){
    box.textContent='— '+res.error;
    pot.textContent='';
    if(dockPot) dockPot.textContent='+0';
    return;
  }
  const signs = res.delta.map((v,i)=>`${state.players[i].name}:${v>=0?'+':''}${v}`);
  box.textContent = signs.join('， ');
  if (document.getElementById('mode').value==='remain'){
    const w = state.remainWinner;
    pot.textContent = `赢家（${state.players[w].name}）本轮预计：+${res.delta[w]}`;
    if(dockPot) dockPot.textContent = `+${res.delta[w]}`;
  }else{
    pot.textContent='';
    if(dockPot) dockPot.textContent = '+0';
  }
}

function applyRound(delta, desc){
  const m = mult();
  state.players.forEach((p,i)=> p.score += (delta[i]||0));
  state.history.push({desc, delta, bombs: state.bombCount, mult: m});
  renderPlayers(); renderRemainArea(); renderQuickWinner(); renderRank(); renderHistory();
  save();
}

function commitRound(){
  const res = computeRound();
  if(res.error){ alert(res.error); return; }
  if(res.springs){
    const list = res.springs.map((v,i)=> v?state.players[i].name:null).filter(Boolean);
    if (list.length) res.desc += ` ｜ 春天：${list.join('、')}`;
  }
  applyRound(res.delta, res.desc);
  document.querySelectorAll('.remainInp').forEach(inp=>{ if(!inp.disabled) inp.value=""; });
  document.querySelectorAll('.springBtn').forEach(btn=>{ if(!btn.disabled) btn.classList.remove('accent'); });
  document.querySelectorAll('.manualInp').forEach(inp=> inp.value="");
  const wl=document.getElementById('winnerList'); if(wl) wl.dataset.selected="";
  recomputePreview();
  showToast('✅ 入账成功');
}

/* ================== 历史 ================== */
function renderHistory(){
  const tb = document.getElementById('historyBody'); tb.innerHTML="";
  state.history.forEach((h,ri)=>{
    const tr = document.createElement('tr');
    const detail = h.delta.map((v,i)=>`${state.players[i]?.name||('玩家'+(i+1))}:${v>=0?'+':''}${v}`).join('， ');
    tr.innerHTML = `<td>${ri+1}</td>
      <td class="mono">${h.desc} ｜ 炸弹:${h.bombs}（×${h.mult}） ｜ ${detail}</td>
      <td><button class="btn" data-del="${ri}">删除</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('button[data-del]').forEach(b=> b.addEventListener('click', ()=>deleteRound(+b.dataset.del)));
}
function deleteRound(idx){
  const h=state.history[idx]; if(!h) return;
  state.players.forEach((p,i)=> p.score -= (h.delta[i]||0));
  state.history.splice(idx,1);
  renderPlayers(); renderRemainArea(); renderQuickWinner(); renderRank(); renderHistory(); save();
  recomputePreview();
}
function clearHistory(){
  if(!state.history.length) return;
  if(!confirm('确定清空历史并回滚分数吗？')) return;
  for(const h of state.history){ state.players.forEach((p,i)=> p.score -= (h.delta[i]||0)); }
  state.history=[]; renderPlayers(); renderRemainArea(); renderQuickWinner(); renderRank(); renderHistory(); save();
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

/* ================== 实时排名（显著分数） ================== */
function renderRank(){
  const box = document.getElementById('rankList'); box.innerHTML="";
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

/* ================== 炸弹交互（无输入框，仅按钮） ================== */
function bindBombUI(){
  const dec = document.getElementById('bombDec');
  const inc = document.getElementById('bombInc');
  const rst = document.getElementById('bombReset');
  updateBombUI();
  function sync(newVal){
    const k = Math.max(0, Math.floor(Number(newVal)||0));
    if (k !== state.bombCount){ pulseBomb(); }
    state.bombCount = k;
    updateBombUI(); save(); recomputePreview();
  }
  dec.addEventListener('click', ()=> sync(state.bombCount - 1));
  inc.addEventListener('click', ()=> sync(state.bombCount + 1));
  rst.addEventListener('click', ()=> sync(0));
}

/* ================== 其它操作 ================== */
function zeroScores(){ if(!confirm("将所有玩家分数清零？")) return; state.players.forEach(p=>p.score=0); renderPlayers(); renderRank(); save(); }
function resetNames(){ state.players.forEach((p,i)=> p.name="玩家"+(i+1)); renderPlayers(); renderRemainArea(); renderQuickWinner(); save(); }
function applyPlayerCount(newN){
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
  renderPlayers(); renderRemainArea(); renderQuickWinner(); renderRank(); renderHistory(); save(); recomputePreview();
}
function undo(){ if(!state.history.length) return; deleteRound(state.history.length-1); }

/* ================== Toast ================== */
let toastTimer=null;
function showToast(text){
  const t=document.getElementById('toast');
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
  go('score'); // 默认“记分”
  renderPlayers(); renderRemainArea(); renderQuickWinner(); renderRank(); renderHistory();
  bindBombUI(); switchMode(); updateBombUI(); recomputePreview();
  stickDockToTab();

  // 交互绑定
  document.getElementById('mode').addEventListener('change', switchMode);
  document.getElementById('commit_m').addEventListener('click', commitRound);
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('exportCsv').addEventListener('click', exportCsv);
  document.getElementById('clearHistory').addEventListener('click', clearHistory);
  document.getElementById('minusP').addEventListener('click', ()=> applyPlayerCount(N()-1));
  document.getElementById('plusP').addEventListener('click', ()=> applyPlayerCount(N()+1));
  document.getElementById('applyP').addEventListener('click', ()=> applyPlayerCount(Number(document.getElementById('setP').value||N())));
  document.getElementById('zeroScores').addEventListener('click', zeroScores);
  document.getElementById('resetNames').addEventListener('click', resetNames);
}
init();
