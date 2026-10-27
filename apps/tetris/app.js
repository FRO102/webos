import {
  BOARD_W, BOARD_H, COLORS, PACE, pieceMatrix, eachCell,
  newGame, canPlace, gravityPiece, softDropPiece, hardDropPiece, movePiece,
  rotatePiece, holdPiece, startPause, restartGame, selectPace,
} from './engine.js';

const CELL = 30;
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
canvas.width = BOARD_W * CELL;
canvas.height = BOARD_H * CELL;

// ---- estado global ----
let bestScore = 0;
let soundOn = true;
let theme = 'dark';
let pace = 'normal';
let previousBest = 0;
const bestScores = { relaxed: 0, normal: 0, fast: 0 };
const defaultBindings = { left: 'ArrowLeft', right: 'ArrowRight', rotate: 'ArrowUp', rotateCCW: 'z', softDrop: 'ArrowDown', hold: 'c', hardDrop: ' ', pause: 'p', restart: 'r' };
let keyBindings = { ...defaultBindings };
let bindingCapture = null;
let announcedState = '';

const storage = (window.os && window.os.storage) ? window.os.storage : null;
function loadPrefs(){
  if(!storage) return Promise.resolve();
  return Promise.all([
    ...Object.keys(bestScores).map(key=>storage.get(`tetris-best-${key}`).then(value=>{if(value!=null)bestScores[key]=Number(value)||0;}).catch(()=>{})),
    storage.get('tetris-best').then(value=>{if(value!=null&&!bestScores.normal)bestScores.normal=Number(value)||0;}).catch(()=>{}),
    storage.get('tetris-sound').then(v=>{if(v!=null)soundOn=(v!=='off');}).catch(()=>{}),
    storage.get('tetris-theme').then(v=>{if(v==='light'||v==='dark'||v==='retro')theme=v;}).catch(()=>{}),
    storage.get('tetris-controls').then(value=>{if(value&&typeof value==='object')keyBindings={...defaultBindings,...value};}).catch(()=>{})
  ]);
}
function saveBest(){bestScores[pace]=bestScore;if(storage){storage.set(`tetris-best-${pace}`,bestScore).catch(()=>{});storage.set('tetris-best',bestScore).catch(()=>{});}}
function saveSound(){if(storage)storage.set('tetris-sound',soundOn?'on':'off').catch(()=>{});}
function saveTheme(){if(storage)storage.set('tetris-theme',theme).catch(()=>{});}
function saveBindings(){if(storage)storage.set('tetris-controls',keyBindings).catch(()=>{});}

let game = newGame(bestScore, pace);

// ---- audio ----
let audioCtx=null;
function playSound(name){
  if(!soundOn)return;
  const notes={rotate:[520,760],softDrop:[300],hardDrop:[210,140],hold:[440,660],control:[420],lineClear:[620,780,980],gameOver:[320,240,170]}[name];
  if(!notes)return;
  try{
    audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();
    const c=audioCtx;if(c.state==='suspended')c.resume();
    const now=c.currentTime;
    notes.forEach((f,i)=>{
      const start=now+i*0.055;
      const osc=c.createOscillator();const gain=c.createGain();
      osc.type='triangle';osc.frequency.setValueAtTime(f,start);
      gain.gain.setValueAtTime(0.0001,start);
      gain.gain.exponentialRampToValueAtTime(0.035,start+0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001,start+0.12);
      osc.connect(gain);gain.connect(c.destination);
      osc.start(start);osc.stop(start+0.13);
    });
  }catch(e){}
}

// ---- dom ----
const $=id=>document.getElementById(id);
const els={score:$('score'),best:$('best'),paceBest:$('pace-best'),lines:$('lines'),level:$('level'),status:$('status-pill'),overlay:$('overlay'),ot:$('overlay-title'),oc:$('overlay-copy'),start:$('btn-start'),pause:$('btn-pause'),hold:$('btn-hold'),sound:$('btn-sound'),themeBtn:$('btn-theme'),restart:$('btn-restart'),holdGrid:$('hold-grid'),nextGrid:$('next-grid'),announcer:$('announcer')};

function miniGrid(el,type){
  el.innerHTML='';
  if(!type){el.classList.add('empty');return;}
  el.classList.remove('empty');
  const m=pieceMatrix(type,0);
  el.style.gridTemplateColumns=`repeat(${m[0].length},14px)`;
  el.style.gridTemplateRows=`repeat(${m.length},14px)`;
  m.forEach(row=>row.forEach(v=>{
    const d=document.createElement('div');d.className='mini-cell';
    d.style.width='14px';d.style.height='14px';
    if(v){d.classList.add('tetris-color-'+type);}
    el.appendChild(d);
  }));
}

function drawCell(x,y,type){
  ctx.fillStyle=COLORS[type]||'#888';
  ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2);
  ctx.fillStyle='rgba(255,255,255,.18)';
  ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,4);
}
function drawGhost(x,y){
  ctx.fillStyle='rgba(148,163,184,.18)';
  ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2);
  ctx.strokeStyle='rgba(148,163,184,.45)';
  ctx.strokeRect(x*CELL+1.5,y*CELL+1.5,CELL-3,CELL-3);
}

function render(){
  ctx.fillStyle=(theme==='dark')?'#0e1517':'#f4f1df';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle=(theme==='dark')?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)';
  ctx.lineWidth=1;
  for(let x=0;x<=BOARD_W;x++){ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,canvas.height);ctx.stroke();}
  for(let y=0;y<=BOARD_H;y++){ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(canvas.width,y*CELL);ctx.stroke();}
  for(let y=0;y<BOARD_H;y++)for(let x=0;x<BOARD_W;x++){const t=game.board[y][x];if(t)drawCell(x,y,t);}
  let ghost={...game.current};
  while(canPlace(game.board,{...ghost,y:ghost.y+1}))ghost={...ghost,y:ghost.y+1};
  eachCell(ghost,(x,y)=>{if(y>=0&&y<BOARD_H&&game.board[y][x]===null)drawGhost(x,y);});
  eachCell(game.current,(x,y)=>{if(y>=0&&y<BOARD_H)drawCell(x,y,game.current.type);});
  els.score.textContent=os.i18n.number(game.score);
  els.best.textContent=os.i18n.number(Math.max(...Object.values(bestScores),game.bestScore));
  els.lines.textContent=game.lines;
  els.level.textContent=game.level;
  els.status.textContent=game.status==='playing'?'Em jogo':game.status==='paused'?'Pausa':game.status==='gameover'?'Fim de jogo':'Pronto';
  if(game.hold){els.hold.querySelector('.label').textContent='Guardada';miniGrid(els.holdGrid,game.hold);els.holdGrid.classList.remove('empty');}
  else{els.hold.querySelector('.label').textContent='Guardada (vazia)';els.holdGrid.innerHTML='';els.holdGrid.classList.add('empty');}
  els.nextGrid.innerHTML='';
  game.queue.forEach((type,index)=>{
    const preview=document.createElement('div');
    preview.className='next-piece mini-grid';
    preview.setAttribute('aria-label',`Peça seguinte ${index+1}: ${type}`);
    miniGrid(preview,type);
    els.nextGrid.appendChild(preview);
  });
  els.paceBest.textContent=os.i18n.number(bestScores[game.pace]||0);
  document.querySelectorAll('[data-bind]').forEach(button=>{
    const action=button.dataset.bind;
    button.classList.toggle('capturing',bindingCapture===action);
    const label=button.firstChild;
    if(label)label.textContent=`${({left:'Esquerda',right:'Direita',rotate:'Rodar',rotateCCW:'Rodar inverso',softDrop:'Descer',hold:'Guardar',hardDrop:'Queda',pause:'Pausa',restart:'Reiniciar'})[action]}: `;
    const key=button.querySelector('kbd');
    if(key)key.textContent=displayKey(keyBindings[action]);
  });
  const show=game.status!=='playing';
  els.overlay.classList.toggle('active',show);
  if(show){
    els.ot.textContent=game.status==='ready'?'Pronto?':game.status==='paused'?'Pausa':'Bom jogo!';
    els.oc.textContent=game.status==='ready'?'Escolhe ritmo e começa.':game.status==='paused'?'A stack espera-te.':`Limpaste ${game.lines} ${game.lines===1?'linha':'linhas'}.`;
    document.querySelectorAll('#pace button').forEach(b=>b.classList.toggle('active',b.dataset.pace===game.pace));
  }
  const clearMessage=game.lastClear?.spin?`; T-Spin ${game.lastClear.spin}`:game.lastClear?.lines?`; ${game.lastClear.lines} linhas limpas${game.lastClear.combo>0?`; combo ${game.lastClear.combo}`:''}${game.lastClear.backToBack?'; consecutivo':''}`:'';
  const announcement=`${game.status}; ${game.lines} linhas; nível ${game.level}${clearMessage}`;
  const announcementKey=[game.status,game.lines,game.level,game.clearSerial,game.lastClear?.spin,game.lastClear?.combo,game.lastClear?.backToBack].join('|');
  if(announcementKey!==announcedState){els.announcer.textContent=`${game.status}; pontuação ${game.score}; ${game.lines} linhas; nível ${game.level}${clearMessage}`;announcedState=announcementKey;}
}

function displayKey(key){return key===' '?'Espaço':key.startsWith('Arrow')?({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓'}[key]||key):key.length===1?key.toUpperCase():key;}

function applyTheme(){
  document.documentElement.dataset.theme=theme;
  document.body.classList.toggle('dark',theme==='dark');
  els.themeBtn.textContent=theme==='dark'?'MODO ESCURO':'MODO CLARO';
  els.themeBtn.setAttribute('aria-pressed',String(theme==='dark'));
  render();
}

// ---- agendamento de gravidade ----
let gravTimeout=null;
function scheduleGravity(){
  if(gravTimeout)clearTimeout(gravTimeout);
  if(game.status!=='playing')return;
  const speed=Math.max(PACE[game.pace].min, PACE[game.pace].gravity*Math.pow(PACE[game.pace].mult,game.level-1));
  gravTimeout=setTimeout(()=>{
    if(game.status==='playing'){
      setGame(gravityPiece(game));
      scheduleGravity();
    }
  },speed);
}

// ---- ações ----
function setGame(next){
  const clearedLines=next.lines>game.lines;
  const gameEnded=next.status==='gameover'&&game.status!=='gameover';
  game=next;
  if(clearedLines)playSound('lineClear');
  if(gameEnded)playSound('gameOver');
  checkRecord();
  render();
}
function doMove(dir){if(game.status!=='playing')return;setGame(movePiece(game,dir));}
function doRotate(direction=1){if(game.status!=='playing')return;playSound('rotate');setGame(rotatePiece(game,direction));}
function doHold(){if(game.status!=='playing'||game.holdUsed)return;playSound('hold');setGame(holdPiece(game));}
function doSoft(){if(game.status!=='playing')return;playSound('softDrop');setGame(softDropPiece(game));scheduleGravity();}
function doHard(){if(game.status!=='playing')return;playSound('hardDrop');setGame(hardDropPiece(game));scheduleGravity();}
function doPause(){playSound('control');game=startPause(game);if(game.status==='playing')scheduleGravity();else if(gravTimeout)clearTimeout(gravTimeout);render();}
function doRestart(){playSound('control');if(gravTimeout)clearTimeout(gravTimeout);game=restartGame(game);game.bestScore=bestScore;previousBest=bestScore;scheduleGravity();render();}
function checkRecord(){if(game.score>bestScore){previousBest=game.score;bestScore=game.score;game.bestScore=bestScore;saveBest();if(game.status==='gameover'&&window.os&&window.os.notify)window.os.notify('Novo recorde no Tetris: '+bestScore);}}

// ---- eventos ----
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(bindingCapture){
    e.preventDefault();
    keyBindings={...keyBindings,[bindingCapture]:e.key};
    bindingCapture=null;
    saveBindings();
    render();
    return;
  }
  if(t&&(t.isContentEditable||t.closest('input, textarea, select, a')))return;
  const k=e.key.toLowerCase();
  const action=Object.entries(keyBindings).find(([,key])=>key.toLowerCase()===k)?.[0];
  if(action||k==='escape')e.preventDefault();
  if(e.repeat&&!['left','right','softDrop'].includes(action))return;
  if(action==='left')doMove(-1);
  else if(action==='right')doMove(1);
  else if(action==='softDrop')doSoft();
  else if(action==='rotate')doRotate(1);
  else if(action==='rotateCCW')doRotate(-1);
  else if(action==='hold')doHold();
  else if(action==='hardDrop'){if(game.status!=='playing')doPause();else doHard();}
  else if(action==='pause'||k==='escape'){if(game.status==='playing'||game.status==='paused')doPause();}
  else if(action==='restart')doRestart();
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&game.status==='playing')doPause();});
function bindRepeat(button,action){
  let delay=null,repeat=null;
  const stop=()=>{clearTimeout(delay);clearInterval(repeat);delay=null;repeat=null;};
  button.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    stop();
    action();
    delay=setTimeout(()=>{repeat=setInterval(action,55);},170);
  });
  for(const eventName of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(eventName,stop);
  button.addEventListener('click',event=>{if(event.detail===0)action();});
}
bindRepeat(document.getElementById('btn-left'),()=>doMove(-1));
bindRepeat(document.getElementById('btn-right'),()=>doMove(1));
bindRepeat(document.getElementById('btn-drop'),doSoft);
document.getElementById('btn-rotate').addEventListener('click',doRotate);
document.getElementById('btn-hard').addEventListener('click',doHard);
document.getElementById('btn-pause').addEventListener('click',doPause);
document.getElementById('btn-restart').addEventListener('click',doRestart);
els.start.addEventListener('click',()=>{if(game.status!=='playing')doPause();});
els.hold.addEventListener('click',doHold);
els.sound.addEventListener('click',()=>{soundOn=!soundOn;saveSound();els.sound.textContent=soundOn?'SOM':'MUDO';});
els.themeBtn.addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';applyTheme();saveTheme();});
els.restart.addEventListener('click',doRestart);
document.querySelectorAll('#pace button').forEach(b=>b.addEventListener('click',()=>{if(game.status==='ready'){pace=b.dataset.pace;bestScore=bestScores[pace]||0;game=selectPace(game,pace);game.bestScore=bestScore;previousBest=bestScore;render();}}));
document.querySelectorAll('[data-bind]').forEach(button=>button.addEventListener('click',()=>{bindingCapture=button.dataset.bind;render();button.focus();}));
canvas.addEventListener('pointerdown',()=>canvas.focus());

if(window.os){
  window.os.on('theme:changed',t=>{if(t&&t.theme){theme=(t.theme==='dark'||t.theme==='retro'?'dark':'light');applyTheme();}});
  window.os.theme.get().then(t=>{if(t&&t.theme){theme=(t.theme==='dark'||t.theme==='retro'?'dark':'light');applyTheme();}}).catch(()=>{});
}

loadPrefs().then(()=>{
  bestScore=bestScores[pace]||0;
  game=newGame(bestScore,pace);game.bestScore=bestScore;previousBest=bestScore;
  applyTheme();
  els.sound.textContent=soundOn?'SOM':'MUDO';
  render();
  scheduleGravity();
}).catch(()=>{applyTheme();render();scheduleGravity();});
