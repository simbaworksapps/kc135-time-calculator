// KC-135 Time Calculator v1.0
(function(){ const s=document.createElement('style'); s.textContent='.active{outline:2px solid #22c55e !important;}'; document.head.appendChild(s); })();
function $(id){ return document.getElementById(id); }

const dateEl = $('date'), toEl = $('to'), durEl = $('dur');
const tzDepEl = $('tzDep'), tzArrEl = $('tzArr');
const offShowEl = $('off-show'), offBriefEl = $('off-brief'), offStepEl = $('off-step'), offEngEl = $('off-eng');
const basicBtn = $('basic'), augBtn = $('aug'), singleBtn = $('single'), formBtn = $('form');
const out = $('timeline'), calcBtn = $('calc'), resetBtn = $('reset');
const nowPanel = $('nowPanel');
const copyBtn = $('copy');
let lastCopyText = '';

function deviceOffsetHours(){ return - (new Date().getTimezoneOffset()) / 60; }
function formatOffsetLabel(off){
  const sign = off>=0?'+':'';
  const frac = Math.abs(off) % 1;
  const mins = frac ? ':'+String(Math.round(frac*60)).padStart(2,'0') : '';
  return `UTC${sign}${Math.trunc(off)}${mins}`;
}
function updateNowPanel(){
  if(!nowPanel) return;
  const d = new Date();
  const off = deviceOffsetHours();
  const local = new Date(d.getTime() + off*3600*1000);
  const lh = String(local.getUTCHours()).padStart(2,'0');
  const lm = String(local.getUTCMinutes()).padStart(2,'0');
  const zh = String(d.getUTCHours()).padStart(2,'0');
  const zm = String(d.getUTCMinutes()).padStart(2,'0');
  nowPanel.textContent = `${lh}${lm}L / ${zh}${zm}Z (${formatOffsetLabel(off)})`;
}

function setActive(el, on){ el.classList.toggle('active', !!on); }
function hmm(min){ const h=Math.floor(min/60), m=min%60; return `${h}:${String(m).padStart(2,'0')}`; }
function maskTimeDigits(v){ v = v.replace(/[^\d]/g,'').slice(0,4); if(v.length>=3) v = v.slice(0,2)+':'+v.slice(2); return v; }
function padHHMM(s){ const m=/^(\d{1,2}):(\d{2})$/.exec(s||''); if(!m) return s; return `${m[1].padStart(2,'0')}:${m[2].padStart(2,'0')}`; }
toEl.addEventListener('input', ()=> toEl.value = maskTimeDigits(toEl.value));
durEl.addEventListener('input', ()=> durEl.value = maskTimeDigits(durEl.value));
['blur','change'].forEach(ev=>{
  toEl.addEventListener(ev, ()=> toEl.value = padHHMM(toEl.value));
  durEl.addEventListener(ev, ()=> durEl.value = padHHMM(durEl.value));
});

function parseHM(s){ if(!s || !/^\d{1,2}:\d{2}$/.test(s)) return null; const [h,m]=s.split(':').map(Number); if(h<0||h>23||m<0||m>59) return null; return {h,m}; }
function parseDur(s){ const p=parseHM(s); return p? p.h*60+p.m : null; }
function buildUTCDate(dateStr, hm){
  const [Y,Mo,D]=dateStr.split('-').map(Number);
  const ms = Date.UTC(Y,Mo-1,D, hm.h, hm.m,0,0);
  return new Date(ms);
}

function buildDateInOffset(dateStr, hm, tzOffsetHours){
  const [Y,Mo,D]=dateStr.split('-').map(Number);
  const ms = Date.UTC(Y,Mo-1,D, hm.h - tzOffsetHours, hm.m,0,0);
  return new Date(ms);
}
function addMin(d,m){ return new Date(d.getTime()+m*60000); }
function fmtLocalWithOffset(dt, offsetHours){
  const ms = dt.getTime() + offsetHours*3600*1000;
  const hh = (new Date(ms)).getUTCHours().toString().padStart(2,'0');
  const mm = (new Date(ms)).getUTCMinutes().toString().padStart(2,'0');
  return `${hh}${mm}`;
}
function fmtZ(dt){ const hh=dt.getUTCHours().toString().padStart(2,'0'); const mm=dt.getUTCMinutes().toString().padStart(2,'0'); return `${hh}${mm}Z`; }
function lineDual(name, dt, localOffset, hint, tzLabel=null){
  const l = document.createElement('div'); l.className='line';
  const left = document.createElement('div');
  const label = tzLabel ? `${name} <span class="hint">(${tzLabel})</span>` : name;
  left.innerHTML = `<span class="name">${label}</span>${hint?` <span class="hint">(${hint})</span>`:''}`;
  const right = document.createElement('div'); right.className='time';
  right.textContent = `${fmtLocalWithOffset(dt, localOffset)}L / ${fmtZ(dt)}`;
  l.appendChild(left); l.appendChild(right); out.appendChild(l);
}
function line(name, dt, off, hint){ lineDual(name, dt, off, hint); }

function tzLabelFromOffset(off){
  const sign = off>=0?'+':'';
  const hours = Math.trunc(off);
  const mins = Math.round((Math.abs(off) - Math.floor(Math.abs(off))) * 60);
  if(mins===0) return `UTC${sign}${hours}`;
  return `UTC${sign}${hours}:${String(mins).padStart(2,'0')}`;
}
function genTZOptions(select){
  const opts = [];
  for(let v=-12; v<=14; v+=0.5){ opts.push(v); }
  [5.75,12.75,8.75].forEach(v=>opts.push(v));
  const unique = [...new Set(opts)].sort((a,b)=>a-b);
  unique.forEach(v=>{
    const o = document.createElement('option');
    o.value = v; o.textContent = tzLabelFromOffset(v);
    select.appendChild(o);
  });
}

// --- Calculate "ready" state tracking ---
function getCalcSignature(){
  return JSON.stringify({
    date: dateEl.value,
    to: toEl.value,
    dur: durEl.value,
    tzDep: tzDepEl.value,
    tzArr: tzArrEl.value,
    offShow: offShowEl.value,
    offBrief: offBriefEl.value,
    offStep: offStepEl.value,
    offEng: offEngEl.value,
    mode,          // BASIC / AUG
    profile        // SINGLE / FORM
  });
}
let lastRunSig = ''; // updated after a successful calc()


const PRESETS = { SINGLE:{show:195,brief:165,step:120,eng:30}, FORM:{show:210,brief:180,step:120,eng:30} };
let mode='BASIC', profile='SINGLE';

function applyProfile(p){
  profile = p;
  const cfg = PRESETS[p];
  offShowEl.value = String(cfg.show);
  offBriefEl.value = String(cfg.brief);
  offStepEl.value = String(cfg.step);
  offEngEl.value = String(cfg.eng);
  setActive(singleBtn, p==='SINGLE'); setActive(formBtn, p==='FORM');
}
function applyMode(m){
  mode = m;
  setActive(basicBtn, m==='BASIC'); setActive(augBtn, m==='AUG');
}

function setValidity(el, isValid) {
  el.classList.remove('error','ok');
  // highlight blank OR invalid as error
  if (!el.value || !isValid) {
    el.classList.add('error');
  } else {
    el.classList.add('ok');
  }
}

function validateInputs() {
  const toValid  = !!parseHM(toEl.value);
  const durValid = parseDur(durEl.value) != null;

  setValidity(toEl, toValid);
  setValidity(durEl, durValid);

  // Reset to default "disarmed" state
  calcBtn.classList.remove('ready', 'needs-run');
  calcBtn.disabled = true;

  if (toValid && durValid) {
    calcBtn.classList.add('ready');
    calcBtn.disabled = false;

    // Detect if current inputs differ from last run
    const sig = getCalcSignature();
    if (sig !== lastRunSig) {
      calcBtn.classList.add('needs-run');
    }
  }

  return toValid && durValid;
}


// live validation + Enter closes keyboard (and runs calc if valid)
[toEl, durEl].forEach(el => {
  el.addEventListener('input',  validateInputs);
  el.addEventListener('blur',   validateInputs);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur();                // closes mobile keyboard
      if (validateInputs()) calc();   // optional: auto-run
    }
  });
});

function updateFdpNotice(landDt, fdpDt) {
  const notice = document.getElementById('fdpNotice');
  if (!notice) return;

  // Clear state
  notice.classList.remove('warn', 'bad');
  notice.style.display = 'none';
  notice.textContent = '';

  // Validate input
  if (!(landDt instanceof Date) || isNaN(landDt) || !(fdpDt instanceof Date) || isNaN(fdpDt)) {
    return;
  }

  const landMs = landDt.getTime();
  const fdpMs  = fdpDt.getTime();
  const THIRTY_MIN = 30 * 60 * 1000;

  if (landMs >= fdpMs) {
    notice.textContent = '⚠️ FDP EXCEEDED';
    notice.classList.add('bad');
    notice.style.display = 'inline-block';
  } else if (landMs >= fdpMs - THIRTY_MIN) {
    notice.textContent = '⚠️ Approaching FDP';
    notice.classList.add('warn');
    notice.style.display = 'inline-block';
  }
}

function calc(){
  out.innerHTML='';
  if (!validateInputs()) {
  // focus the first invalid input
  if (!parseHM(toEl.value)) toEl.focus();
  else if (parseDur(durEl.value) == null) durEl.focus();
  return;
}

  const d = new Date();
  if(!dateEl.value){
    const yyyy=d.getUTCFullYear(), mm=String(d.getUTCMonth()+1).padStart(2,'0'), dd=String(d.getUTCDate()).padStart(2,'0');
    dateEl.value = `${yyyy}-${mm}-${dd}`;
  }
  const dateStr = dateEl.value;
  const hmTO = parseHM(toEl.value);
  const dur = parseDur(durEl.value);
  const offDep = Number(tzDepEl.value);
  const offArr = Number(tzArrEl.value);
  if(!dateStr || !hmTO || dur==null){ out.textContent='Enter date, T/O (24h), duration.'; return; }

  const to = buildUTCDate(dateStr, hmTO);
  const ld = addMin(to, dur);

  const show = addMin(to, -Number(offShowEl.value||0));
  const brief = addMin(to, -Number(offBriefEl.value||0));
  const step = addMin(to, -Number(offStepEl.value||0));
  const eng = addMin(to, -Number(offEngEl.value||0));
  const alert = addMin(show, -60);
  const crewRest = addMin(alert, -12*60);
  const lastBeer = addMin(to, -12*60);
  const lastAmbien = addMin(alert, -6*60);

  const MOD = (mode==='BASIC') ? {fdp:16*60, cdt:18*60} : {fdp:24*60, cdt:24*60+45};
  const fdpEnd = addMin(show, MOD.fdp);
  const cdtEnd = addMin(show, MOD.cdt);

  // --- FDP Exceeded? Highlight BASIC/AUG box ---
basicBtn.classList.remove('bad');
augBtn.classList.remove('bad');

if (ld.getTime() >= fdpEnd.getTime()) {
  // FDP exceeded → highlight based on current mode
  if (mode === 'BASIC') basicBtn.classList.add('bad');
  else augBtn.classList.add('bad');
}

  const latestAlert = addMin(alert, 6*60);
  const picExtAlert = addMin(alert, 8*60);
  const reevalORM = addMin(to, 4*60);
  const train = addMin(show, 12*60);
  const opTac = addMin(show, 14*60);
  const minTurnTO = addMin(ld, 17*60);
  const lateTOCap = addMin(fdpEnd, -dur);

  line('Crew Rest', crewRest, offDep, 'alert−12');
  line('Last Beer', lastBeer, offDep, 'T/O−12');
  line('Last Ambien', lastAmbien, offDep, 'alert−6');
  line('Alert', alert, offDep, 'show−1');
  line('Show', show, offDep, `T/O−${hmm(Number(offShowEl.value||0))}`);
  line('Brief', brief, offDep, `T/O−${hmm(Number(offBriefEl.value||0))}`);
  line('Step', step, offDep, `T/O−${hmm(Number(offStepEl.value||0))}`);
  line('Eng St', eng, offDep, `T/O−${hmm(Number(offEngEl.value||0))}`);
  lineDual('T/O', to, offDep, null, 'Zulu');

  const durLine = document.createElement('div'); durLine.className='line';
  const dh = String(Math.floor(dur/60)).padStart(2,'0'), dm = String(dur%60).padStart(2,'0');
  durLine.innerHTML = `<div class="name">Sortie Dur</div><div class="time">${dh}${dm}</div>`;
  out.appendChild(durLine);

  line('Late T/O Cap', lateTOCap, offDep, 'FDP − Sortie Dur');
  line('Latest Alert', latestAlert, offDep, 'alert+6');
  line('PIC Extend Alert', picExtAlert, offDep, 'alert+8');
  line('Re-Eval ORM', reevalORM, offDep, 'T/O+4');
  line('Train', train, offDep, 'show+12');
  line('Operational TAC', opTac, offDep, 'show+14');
  lineDual('Land', ld, offArr, null, tzLabelFromOffset(offArr));
  line('FDP', fdpEnd, offDep, mode==='BASIC'?'show+16':'show+24');
  line('CDT', cdtEnd, offDep, mode==='BASIC'?'show+18':'show+24:45');
  line('Min Turn T/O', minTurnTO, offArr, 'land+17');
  
  // Build compact text for Copy (XXXXL/XXXXZ)
const pair = (label, dt, off) => `${label}: ${fmtLocalWithOffset(dt, off)}L/${fmtZ(dt)}`;

const durHHMM = `${String(Math.floor(dur/60)).padStart(2,'0')}${String(dur%60).padStart(2,'0')}`;

lastCopyText = [
  pair('Crew Rest', crewRest, offDep),
  pair('Alert',     alert,    offDep),
  pair('Show',      show,     offDep),
  pair('Brief',     brief,    offDep),
  pair('Step',      step,     offDep),
  pair('Eng St',    eng,      offDep),
  pair('T/O',       to,       offDep),
  `Dur: ${durHHMM}`,
  pair('Land',      ld,       offArr),
].join('\n');

if (copyBtn) copyBtn.disabled = false;

updateFdpNotice(ld, fdpEnd);
  
  // Smooth scroll to center "Sortie Dur" line for best timeline view
setTimeout(() => {
  const sortieLine = [...out.querySelectorAll('.line')]
    .find(l => l.textContent.includes('Sortie Dur'));
  if (!sortieLine) return;

  const scroller = document.scrollingElement || document.documentElement;
  const rect = sortieLine.getBoundingClientRect();
  const offsetY = rect.top + window.pageYOffset - (window.innerHeight / 2) + (rect.height / 2);

  scroller.scrollTo({
    top: offsetY,
    behavior: 'smooth'
  });
}, 300);

// mark this state as the last successful run
lastRunSig = getCalcSignature();

// ensure Calculate shows as ready (no glow) after a run
calcBtn.classList.add('ready');
calcBtn.classList.remove('needs-run');
calcBtn.disabled = false;

}

function resetAll(){
  const d=new Date();
  const yyyy=d.getUTCFullYear(), mm=String(d.getUTCMonth()+1).padStart(2,'0'), dd=String(d.getUTCDate()).padStart(2,'0');
  dateEl.value=`${yyyy}-${mm}-${dd}`;
  toEl.value=''; durEl.value='';
  const off = deviceOffsetHours();
  tzDepEl.value=String(off); tzArrEl.value=String(off);
  applyProfile('SINGLE'); applyMode('BASIC');
  out.innerHTML='';

// --- force-jump to the very top (robust on iOS/Android/Safari/Chrome/PWA) ---
if (document.activeElement && typeof document.activeElement.blur === 'function') {
  document.activeElement.blur();          // close keyboard; prevents viewport pin
}

const jumpTop = () => {
  // try every target some engines honor
  window.scrollTo(0, 0);
  const s = document.scrollingElement || document.documentElement || document.body;
  s.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

requestAnimationFrame(() => {
  jumpTop();              // immediately after DOM updates
  setTimeout(jumpTop, 300); // again after animations/resize bars settle
});

  lastCopyText = '';
  if (copyBtn) {
    copyBtn.disabled = true;
    copyBtn.textContent = 'Copy';
    copyBtn.style.background = '#22c55e'; }

  [toEl, durEl].forEach(el => el.classList.remove('error','ok'));
validateInputs();

basicBtn.classList.remove('bad','warn');
augBtn.classList.remove('bad','warn');

  const notice = document.getElementById('fdpNotice');
if (notice) {
  notice.classList.remove('warn','bad');
  notice.style.display = 'none';
  notice.textContent = '';
}


}

;['click','touchend'].forEach(ev=>{
  basicBtn.addEventListener(ev, ()=>applyMode('BASIC'));
  augBtn.addEventListener(ev, ()=>applyMode('AUG'));
  singleBtn.addEventListener(ev, ()=>applyProfile('SINGLE'));
  formBtn.addEventListener(ev, ()=>applyProfile('FORM'));
  calcBtn.addEventListener(ev, calc);
  resetBtn.addEventListener(ev, resetAll);
});

// whenever any of these change, recompute readiness/glow
[dateEl, tzDepEl, tzArrEl, offShowEl, offBriefEl, offStepEl, offEngEl]
  .forEach(el => el.addEventListener('change', validateInputs));

// mode/profile buttons should also trigger validate
['click','touchend'].forEach(ev => {
  basicBtn.addEventListener(ev, () => { applyMode('BASIC');  validateInputs(); });
  augBtn.addEventListener(ev,   () => { applyMode('AUG');    validateInputs(); });
  singleBtn.addEventListener(ev,() => { applyProfile('SINGLE'); validateInputs(); });
  formBtn.addEventListener(ev,  () => { applyProfile('FORM');   validateInputs(); });
});


// --- Ensure the lion badge link works inside the PWA (iOS/Android) ---
(() => {
  const badge = document.getElementById('badgeLink'); // <a id="badgeLink" ...>
  if (!badge) return;

  const url = badge.href;

  const openExternal = () => {
    // Some PWAs ignore target=_blank; force a new context
    try { window.open(url, '_blank'); } catch (_) { location.href = url; }
  };

  // Block any parent handlers and default navigation that might get swallowed
  ['click','touchend'].forEach(ev => {
    badge.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      openExternal();
    }, { passive: false });
  });
})();

if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    if (!lastCopyText) return;

    try {
      // Modern API (works on HTTPS + PWAs)
      await navigator.clipboard.writeText(lastCopyText);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
      return;
    } catch {
      // Fallback for older browsers or sandboxed contexts
      const ta = document.createElement('textarea');
      ta.value = lastCopyText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    }
  });
}

function buildOffsetOptions(select, def){
  for(let m=0; m<=300; m+=5){
    const h=Math.floor(m/60), mm=m%60;
    const o=document.createElement('option');
    o.value=m; o.textContent=`${h}:${String(mm).padStart(2,'0')}`;
    if(m===def) o.selected=true; select.appendChild(o);
  }
}

function genTZOptions(select){
  const opts = [];
  for(let v=-12; v<=14; v+=0.5){ opts.push(v); }
  [5.75,12.75,8.75].forEach(v=>opts.push(v));
  const unique = [...new Set(opts)].sort((a,b)=>a-b);
  unique.forEach(v=>{
    const o = document.createElement('option');
    o.value = v; o.textContent = tzLabelFromOffset(v);
    select.appendChild(o);
  });
}

function boot(){
  // Build selects
  genTZOptions(tzDepEl);
  genTZOptions(tzArrEl);
  buildOffsetOptions(offShowEl, 195);
  buildOffsetOptions(offBriefEl, 165);
  buildOffsetOptions(offStepEl, 120);
  buildOffsetOptions(offEngEl, 30);

  // Defaults
  const off = deviceOffsetHours();
  tzDepEl.value = String(off);
  tzArrEl.value = String(off);
  applyProfile('SINGLE');
  applyMode('BASIC');

  // Reset UI, start clock, validate
  resetAll();
  updateNowPanel();
  setInterval(updateNowPanel, 30000);
  validateInputs();
}

boot();
