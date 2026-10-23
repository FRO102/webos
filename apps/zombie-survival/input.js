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
let joyZone, joyNub, fireBtn;
let scrollAccum = 0;

export function setupInput(canvas, joyZoneEl, joyNubEl, fireBtnEl) {
  joyZone = joyZoneEl;
  joyNub = joyNubEl;
  fireBtn = fireBtnEl;

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
  let joyActive = false, joyId = null;
  joyZone.addEventListener('touchstart', e => {
    joyActive = true;
    joyId = e.changedTouches[0].identifier;
  });
  window.addEventListener('touchmove', e => {
    for(const t of e.changedTouches) {
      if(t.identifier === joyId) {
        const rect = joyZone.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top + rect.height/2;
        let dx = t.clientX - cx;
        let dy = t.clientY - cy;
        const dist = Math.min(Math.hypot(dx,dy), 40);
        const ang = Math.atan2(dy,dx);
        dx = Math.cos(ang)*dist;
        dy = Math.sin(ang)*dist;
        joyNub.style.left = (32+dx)+'px';
        joyNub.style.top = (32+dy)+'px';
        joystickVec.x = dx/40;
        joystickVec.y = dy/40;
      }
    }
  }, {passive: true});
  window.addEventListener('touchend', e => {
    for(const t of e.changedTouches) {
      if(t.identifier === joyId) {
        joyActive = false; joyId = null;
        joystickVec = {x:0, y:0};
        joyNub.style.left = '32px';
        joyNub.style.top = '32px';
      }
    }
  });
  fireBtn.addEventListener('touchstart', e => { e.preventDefault(); touchFiring = true; });
  fireBtn.addEventListener('touchend', e => { touchFiring = false; });
}
