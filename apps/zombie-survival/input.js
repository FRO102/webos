import { initAudioIfNeeded, resumeAudio } from './audio.js';
import { tryDash, switchWeapon, cycleWeapon, reload, meleeAttack, tryUseMedkit } from './player.js';

export const keys = {};
export let mouseX = window.innerWidth/2, mouseY = window.innerHeight/2;
export let mouseDown = false;
export let rightMouseDown = false;
export let joystickVec = {x:0, y:0};
export let touchFiring = false;
export let lastKeyPressed = '';

// Referências para joystick (preenchidas depois)
let joyZone, joyNub, fireBtn, aimZoneEl, aimNub;
const tryAim = (x,y) => {};
let scrollAccum = 0;

export function setupInput(canvas, joyZoneEl, joyNubEl, fireBtnEl, aimZoneElParam, aimNubElParam) {
  joyZone = joyZoneEl;
  joyNub = joyNubEl;
  fireBtn = fireBtnEl;
  aimZoneEl = aimZoneElParam;
  aimNub = aimNubElParam;

  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    lastKeyPressed = e.key;
    if(e.key === 'Escape' && !e.repeat) {
      e.preventDefault();
      // togglePause é importado do game.js de forma dinâmica para evitar ciclo direto
      import('./game.js').then(module => module.togglePause());
    }
    if(e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      tryDash();
    }
    if (['1','2','3','4','5','6','7','8','9'].includes(e.key)) {
      switchWeapon(parseInt(e.key, 10) - 1);
    } else if (e.key === '0') {
      switchWeapon(9);
    }
    if(e.key.toLowerCase() === 'r') {
      reload();
    }
    if(e.key.toLowerCase() === 'f') {
      meleeAttack();
      import('./world.js').then(m => { if(m.tryInteract) m.tryInteract(); });
    }
    if(e.key.toLowerCase() === 'q') {
      tryUseMedkit();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  });

  canvas.addEventListener('mousedown', e => {
    initAudioIfNeeded();
    resumeAudio();
    if(e.button === 0) mouseDown = true;
    if(e.button === 2) rightMouseDown = true;
  });

  window.addEventListener('mouseup', e => {
    if(e.button === 0) mouseDown = false;
    if(e.button === 2) rightMouseDown = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Scroll do rato para trocar de arma (útil com 13 armas e só 10 teclas numéricas)
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    scrollAccum += e.deltaY;
    const threshold = 40;
    if (scrollAccum > threshold) {
      cycleWeapon(1);
      scrollAccum = 0;
    } else if (scrollAccum < -threshold) {
      cycleWeapon(-1);
      scrollAccum = 0;
    }
  }, { passive: false });

// Joystick touch
  let joyActive = false, joyId = null, joyLeft = 0;
  const joyEl = joyZone; const aimEl = aimZoneEl;

  joyZone.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      if (joyId === null) {
        joyId = t.identifier;
        joyActive = true;
        updateJoy(t.clientX, t.clientY);
      }
    }
  }, { passive: true });

  function updateJoy(cx, cy) {
    const rect = joyZone.getBoundingClientRect();
    const ccx = rect.left + rect.width/2;
    const ccy = rect.top + rect.height/2;
    let dx = cx - ccx;
    let dy = cy - ccy;
    const ang = Math.atan2(dy, dx);
    const dist = Math.min(Math.hypot(dx, dy), 40);
    dx = Math.cos(ang)*dist; dy = Math.sin(ang)*dist;
    joyNub.style.left = (32+dx)+'px';
    joyNub.style.top = (32+dy)+'px';
    joystickVec.x = dx/40;
    joystickVec.y = dy/40;
  }

  window.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        updateJoy(t.clientX, t.clientY);
      }
      if (t.identifier === aimId) {
        updateAim(t.clientX, t.clientY);
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyActive = false; joyId = null;
        joystickVec = {x:0, y:0};
        if (joyNub) { joyNub.style.left = '32px'; joyNub.style.top = '32px'; }
      }
      if (t.identifier === aimId) {
        aimId = null;
        if (aimNub) { aimNub.style.left = '32px'; aimNub.style.top = '32px'; }
        // mira mantém último ponto
      }
    }
  });

  // Aim pad
  let aimId = null;
  function updateAim(cx, cy) {
    const rect = aimZoneEl.getBoundingClientRect();
    const ccx = rect.left + rect.width/2;
    const ccy = rect.top + rect.height/2;
    let dx = cx - ccx;
    let dy = cy - ccy;
    const ang = Math.atan2(dy, dx);
    const dist = Math.min(Math.hypot(dx, dy), 40);
    dx = Math.cos(ang)*dist; dy = Math.sin(ang)*dist;
    if (aimNub) { aimNub.style.left = (32+dx)+'px'; aimNub.style.top = (32+dy)+'px'; }
    // Ajusta mouseX/mouseY relativamente ao canvas
    const canvasRect = canvas.getBoundingClientRect();
    const worldX = (ccx + dx - canvasRect.left) * (canvas.width / canvasRect.width);
    const worldY = (ccy + dy - canvasRect.top) * (canvas.height / canvasRect.height);
    mouseX = worldX;
    mouseY = worldY;
  }

  if (aimZoneEl) {
    aimZoneEl.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (aimId === null) {
          aimId = t.identifier;
          updateAim(t.clientX, t.clientY);
        }
      }
    }, { passive: false });
  }

  // Botões mobile
  const bindBtn = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
    el.addEventListener('click', e => { e.preventDefault(); fn(); });
  };
  bindBtn('mobile-reload-btn', () => { try { reload(); } catch(e){} });
  bindBtn('mobile-medkit-btn', () => { try { tryUseMedkit(); } catch(e){} });
  bindBtn('mobile-dash-btn', () => { try { tryDash(); } catch(e){} });
  bindBtn('mobile-weapon-btn', () => { try { cycleWeapon(1); } catch(e){} });
  bindBtn('mobile-pause-btn', () => { import('./game.js').then(m => m.togglePause()); });
  bindBtn('mobile-fired-btn', () => { touchFiring = true; setTimeout(()=> touchFiring=false, 120); });
  bindBtn('mobile-called-btn', () => { rightMouseDown = true; setTimeout(()=> rightMouseDown=false, 120); });

  if (fireBtn) {
    fireBtn.addEventListener('touchstart', e => { e.preventDefault(); touchFiring = true; });
    fireBtn.addEventListener('touchend', e => { touchFiring = false; });
  }
}
