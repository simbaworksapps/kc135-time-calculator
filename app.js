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

// ---------- Defaults for Mission Profiles ----------

// Safe deep clone helper (covers older Safari/Android that lack structuredClone)
const SC = (obj) => (typeof structuredClone === 'function'
  ? structuredClone(obj)
  : JSON.parse(JSON.stringify(obj)));

const DEFAULTS_KEY = 'kc135.defaults.v2';

const el = {
  modal: $('defaultsModal'),
  btn: $('defaultsBtn'),
  save: $('defaultsSave'),
  cancel: $('defaultsCancel'),
  reset: $('defaultsReset'),

  // Modal dropdowns
  d_single_show:  $('d_single_show'),
  d_single_brief: $('d_single_brief'),
  d_single_step:  $('d_single_step'),
  d_single_eng:   $('d_single_eng'),

  d_form_show:  $('d_form_show'),
  d_form_brief: $('d_form_brief'),
  d_form_step:  $('d_form_step'),
  d_form_eng:   $('d_form_eng'),
};

// Always-available zero set (minutes, not H:MM)
const ZERO_DEFAULTS = {
  enabled: false,
  single:   { show: 0, brief: 0, step: 0, eng: 0 },
  formation:{ show: 0, brief: 0, step: 0, eng: 0 },
};

const PROMPT_KEY = 'kc135.defaults.prompted.v1';

function markPrompted(){
  try { localStorage.setItem(PROMPT_KEY, '1'); } catch(_) {}
}

function maybeAskForDefaults(){
  try {
    const already = localStorage.getItem(PROMPT_KEY);
    const d = loadDefaults();
    if (already || d.enabled) return;   // do not ask if user already chose or has saved defaults
    // show once
    openDefaultsModal();
  } catch(_) {}
}


function loadDefaults(){
  try {
    return JSON.parse(localStorage.getItem(DEFAULTS_KEY)) || SC(ZERO_DEFAULTS);
  } catch {
    return SC(ZERO_DEFAULTS);
  }
}

function saveDefaults(obj){
  try { localStorage.setItem(DEFAULTS_KEY, JSON.stringify(obj)); }
  catch (_) { /* no-op: defaults just won't persist */ }
}

// Copies the live dropdown's options into the modal dropdowns
function cloneOptions(fromSelect, toSelect){
  toSelect.innerHTML = '';
  [...fromSelect.options].forEach(o=>{
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.textContent;
    toSelect.appendChild(opt);
  });
}

// Sync modal options with your app's real dropdown options
function hydrateModalOptions(){
  cloneOptions(offShowEl,  el.d_single_show);  cloneOptions(offShowEl,  el.d_form_show);
  cloneOptions(offBriefEl, el.d_single_brief); cloneOptions(offBriefEl, el.d_form_brief);
  cloneOptions(offStepEl,  el.d_single_step);  cloneOptions(offStepEl,  el.d_form_step);
  cloneOptions(offEngEl,   el.d_single_eng);   cloneOptions(offEngEl,   el.d_form_eng);
}

// Load saved defaults into the modal UI
function setModalFromDefaults(d){
  const s = d.single, f = d.formation;
  setSelectValueAndPaint(el.d_single_show,  s.show);
  setSelectValueAndPaint(el.d_single_brief, s.brief);
  setSelectValueAndPaint(el.d_single_step,  s.step);
  setSelectValueAndPaint(el.d_single_eng,   s.eng);

  setSelectValueAndPaint(el.d_form_show,    f.show);
  setSelectValueAndPaint(el.d_form_brief,   f.brief);
  setSelectValueAndPaint(el.d_form_step,    f.step);
  setSelectValueAndPaint(el.d_form_eng,     f.eng);
}

function getDefaultsFromModal(){
  return {
    enabled: true,
    single: {
      show:  parseInt(el.d_single_show.value  || '0', 10),
      brief: parseInt(el.d_single_brief.value || '0', 10),
      step:  parseInt(el.d_single_step.value  || '0', 10),
      eng:   parseInt(el.d_single_eng.value   || '0', 10),
    },
    formation: {
      show:  parseInt(el.d_form_show.value  || '0', 10),
      brief: parseInt(el.d_form_brief.value || '0', 10),
      step:  parseInt(el.d_form_step.value  || '0', 10),
      eng:   parseInt(el.d_form_eng.value   || '0', 10),
    }
  };
}

// Opens the modal
function openDefaultsModal(){
  const ready = () =>
    [offShowEl, offBriefEl, offStepEl, offEngEl].every(s => s && s.options.length > 0);

  const spin = () => {
    if (!ready()) { requestAnimationFrame(spin); return; }

    hydrateModalOptions();
    el.modal.style.display = 'block';

    void el.modal.offsetHeight; // force layout on mobile

    // Set values on the next frame so mobile paints correctly
    requestAnimationFrame(() => {
      const d = loadDefaults();
      setModalFromDefaults(d);
    });
  };
  spin();
}

function closeDefaultsModal(){
  el.modal.style.display = 'none';
}

// Modal button actions
el.btn.addEventListener('click', openDefaultsModal);

// Save -> enable defaults and reflect immediately
el.save.addEventListener('click', () => {
  const newDefs = getDefaultsFromModal();
  saveDefaults(newDefs);         // persist only on Save
  markPrompted();
  const isForm = formBtn.classList.contains('active');
  applyProfile(isForm ? 'FORM' : 'SINGLE'); // reflect in main UI
  closeDefaultsModal();
});

// Reset -> only reset modal fields to zeros (no save, no apply)
el.reset.addEventListener('click', () => {
  const z = SC(ZERO_DEFAULTS);
  setModalFromDefaults(z);       // just update the modal controls
  // do not save, do not applyProfile, do not markPrompted
});

// Cancel -> close without saving anything
el.cancel.addEventListener('click', () => {
  // optional: remove this next line if you do not want to suppress the first-run prompt when user cancels
  // markPrompted();
  closeDefaultsModal();
});

// First-run behavior: no forced modal. Start with zeros unless the user saves defaults later.
(function primeDefaults(){
  if (!localStorage.getItem(DEFAULTS_KEY)) {
    saveDefaults(SC(ZERO_DEFAULTS));
  }
})();

function setSelectValueAndPaint(sel, val) {
  const v = String(val);
  sel.value = v;

  // If the browser didn't accept .value (rare), select by walking options
  if (sel.value !== v) {
    const idx = [...sel.options].findIndex(o => o.value === v);
    if (idx >= 0) sel.selectedIndex = idx;
  }

  // Nudge WebKit/Chrome mobile to repaint the visible text
  sel.blur?.();
  // Force a reflow
  // eslint-disable-next-line no-unused-expressions
  sel.offsetHeight;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}


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

let mode='BASIC', profile='SINGLE';

function applyProfile(p){
  profile = p;
  const d = loadDefaults();
  const src = d.enabled ? (p === 'SINGLE' ? d.single : d.formation)
                        : ZERO_DEFAULTS[p === 'SINGLE' ? 'single' : 'formation'];

  setSelectValueAndPaint(offShowEl,  src.show);
  setSelectValueAndPaint(offBriefEl, src.brief);
  setSelectValueAndPaint(offStepEl,  src.step);
  setSelectValueAndPaint(offEngEl,   src.eng);


  // notify dependents
  ['change'].forEach(evt=>{
    offShowEl.dispatchEvent(new Event(evt));
    offBriefEl.dispatchEvent(new Event(evt));
    offStepEl.dispatchEvent(new Event(evt));
    offEngEl.dispatchEvent(new Event(evt));
  });

  setActive(singleBtn, p === 'SINGLE');
  setActive(formBtn,   p === 'FORM');
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
  lineDual('T/O', to, offDep, null, tzLabelFromOffset(offDep));

  const durLine = document.createElement('div'); durLine.className='line';
  const dh = String(Math.floor(dur/60)).padStart(2,'0'), dm = String(dur%60).padStart(2,'0');
  durLine.innerHTML = `<div class="name">Sortie Dur</div><div class="time">${dh}${dm}</div>`;
  out.appendChild(durLine);

  lineDual('Land', ld, offArr, null, tzLabelFromOffset(offArr));
  line('Late T/O Cap', lateTOCap, offDep, 'FDP − Dur');
  line('Latest Alert', latestAlert, offDep, 'alert+6');
  line('PIC Extend Alert', picExtAlert, offDep, 'alert+8');
  line('Re-Eval ORM', reevalORM, offDep, 'T/O+4');
  line('Train', train, offDep, 'show+12');
  line('Tactical', opTac, offDep, 'show+14');
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
  basicBtn.addEventListener(ev, ()=>{ applyMode('BASIC');  validateInputs(); });
  augBtn.addEventListener(ev,   ()=>{ applyMode('AUG');    validateInputs(); });
  singleBtn.addEventListener(ev,()=>{ applyProfile('SINGLE'); validateInputs(); });
  formBtn.addEventListener(ev,  ()=>{ applyProfile('FORM');   validateInputs(); });
  calcBtn.addEventListener(ev,  calc);
  resetBtn.addEventListener(ev, resetAll);
});

// whenever any of these change, recompute readiness/glow
[dateEl, tzDepEl, tzArrEl, offShowEl, offBriefEl, offStepEl, offEngEl]
  .forEach(el => el.addEventListener('change', validateInputs));


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

function boot(){
  genTZOptions(tzDepEl);
  genTZOptions(tzArrEl);

  buildOffsetOptions(offShowEl,195);
  buildOffsetOptions(offBriefEl,165);
  buildOffsetOptions(offStepEl,120);
  buildOffsetOptions(offEngEl,30);

  const off = deviceOffsetHours();
  tzDepEl.value = String(off);
  tzArrEl.value = String(off);

  resetAll();
  updateNowPanel();
  setInterval(updateNowPanel, 30000);

  validateInputs();
  setTimeout(maybeAskForDefaults, 0);
}

boot();
