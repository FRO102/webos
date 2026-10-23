import { clamp } from './utils.js';

let audioCtx = null;
let masterGain = null;
let audioMuted = false;
let audioVolume = 0.7;

export function initAudioIfNeeded() {
  if(audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if(!Ctx) return;
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = audioMuted ? 0 : audioVolume;
  masterGain.connect(audioCtx.destination);
}

export function setAudioVolume(v) {
  audioVolume = clamp(v,0,1);
  if(masterGain) masterGain.gain.value = audioMuted ? 0 : audioVolume;
}

export function setAudioMuted(muted) {
  audioMuted = !!muted;
  if(masterGain) masterGain.gain.value = audioMuted ? 0 : audioVolume;
}

export function playSound(freq, duration, type, vol) {
  if(!audioCtx || !masterGain || audioMuted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.value = freq;
  gain.gain.value = vol || 0.05;
  osc.connect(gain);
  gain.connect(masterGain);
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

export function resumeAudio() {
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

export function getAudioState() {
  return { muted: audioMuted, volume: audioVolume, ctx: audioCtx };
}