import { OUTFIT_PRESETS, SKIN_PRESETS, HAT_PRESETS, BACKPACK_PRESETS, MASK_PRESETS, CUSTOM_STORAGE_KEY } from './constants.js';
import { getStoredValue, setStoredValue } from './persistence.js';

export const playerLook = {
  outfit: 'militia',
  skin: 'warm',
  hat: 'none',
  backpack: 'none',
  mask: 'none',
  body: OUTFIT_PRESETS.militia.body,
  bodyDk: OUTFIT_PRESETS.militia.bodyDk,
  skinColor: SKIN_PRESETS.warm
};

let customPreviewCtx = null;
let customPreviewCanvas = null;

export function initCharacter() {
  const preview = document.getElementById('custom-preview');
  if(preview) {
    customPreviewCanvas = preview;
    customPreviewCtx = preview.getContext('2d');
  }
  loadCharacterLook();
}

export function applyCharacterLook(outfit, skin, save, hat, backpack, mask) {
  const outfitDef = OUTFIT_PRESETS[outfit] || OUTFIT_PRESETS.militia;
  const skinColor = SKIN_PRESETS[skin] || SKIN_PRESETS.warm;
  playerLook.outfit = OUTFIT_PRESETS[outfit] ? outfit : 'militia';
  playerLook.skin = SKIN_PRESETS[skin] ? skin : 'warm';
  playerLook.hat = HAT_PRESETS[hat] ? hat : (HAT_PRESETS[playerLook.hat] ? playerLook.hat : 'none');
  playerLook.backpack = BACKPACK_PRESETS[backpack] ? backpack : (BACKPACK_PRESETS[playerLook.backpack] ? playerLook.backpack : 'none');
  playerLook.mask = MASK_PRESETS[mask] ? mask : (MASK_PRESETS[playerLook.mask] ? playerLook.mask : 'none');
  playerLook.body = outfitDef.body;
  playerLook.bodyDk = outfitDef.bodyDk;
  playerLook.skinColor = skinColor;

  const customOutfit = document.getElementById('custom-outfit');
  const customSkin = document.getElementById('custom-skin');
  const customHat = document.getElementById('custom-hat');
  const customBackpack = document.getElementById('custom-backpack');
  const customMask = document.getElementById('custom-mask');
  if(customOutfit) customOutfit.value = playerLook.outfit;
  if(customSkin) customSkin.value = playerLook.skin;
  if(customHat) customHat.value = playerLook.hat;
  if(customBackpack) customBackpack.value = playerLook.backpack;
  if(customMask) customMask.value = playerLook.mask;

  drawCharacterPreview();
  if(save !== false) saveCharacterLook();
}

/** Lê os 5 selects de customização e aplica tudo de uma vez (usado pelo botão APPLY e pelos onInput). */
export function applyCharacterLookFromInputs(save) {
  const val = (id, fallback) => document.getElementById(id)?.value ?? fallback;
  applyCharacterLook(
    val('custom-outfit', playerLook.outfit),
    val('custom-skin', playerLook.skin),
    save,
    val('custom-hat', playerLook.hat),
    val('custom-backpack', playerLook.backpack),
    val('custom-mask', playerLook.mask)
  );
}

export function drawCharacterPreview() {
  if(!customPreviewCtx) return;
  const pctx = customPreviewCtx;
  const canvas = customPreviewCanvas;
  pctx.clearRect(0,0,canvas.width,canvas.height);
  pctx.fillStyle = '#0b0d08';
  pctx.fillRect(0,0,canvas.width,canvas.height);
  pctx.fillStyle = 'rgba(0,0,0,0.35)';
  pctx.beginPath();
  pctx.ellipse(60,76,20,9,0,0,Math.PI*2);
  pctx.fill();

  // Mochila (desenhada atrás do corpo)
  const bp = BACKPACK_PRESETS[playerLook.backpack];
  if (bp && playerLook.backpack !== 'none') {
    pctx.fillStyle = bp.color;
    pctx.fillRect(46, 54, 12, 20);
    pctx.strokeStyle = 'rgba(0,0,0,0.4)';
    pctx.lineWidth = 1;
    pctx.strokeRect(46, 54, 12, 20);
  }

  pctx.fillStyle = playerLook.body;
  pctx.beginPath();
  pctx.ellipse(60,62,20,17,0,0,Math.PI*2);
  pctx.fill();
  pctx.fillStyle = playerLook.bodyDk;
  pctx.beginPath();
  pctx.ellipse(60,68,17,10,0,0,Math.PI*2);
  pctx.fill();
  pctx.fillStyle = '#2a2a24';
  pctx.fillRect(76,58,20,7);
  pctx.fillStyle = playerLook.skinColor;
  pctx.beginPath();
  pctx.arc(67,62,10,0,Math.PI*2);
  pctx.fill();

  // Máscara (cobre a metade inferior da cara, tipo bandana/gasmask)
  const mask = MASK_PRESETS[playerLook.mask];
  if (mask && playerLook.mask !== 'none') {
    pctx.fillStyle = mask.color;
    pctx.beginPath();
    pctx.ellipse(67, 65, 9, 6, 0, 0, Math.PI * 2);
    pctx.fill();
  }

  // Chapéu (calote alinhada com o círculo da cabeça, centro em 67,62 raio 10)
  const hat = HAT_PRESETS[playerLook.hat];
  if (hat && playerLook.hat !== 'none') {
    pctx.fillStyle = hat.color;
    if (playerLook.hat === 'helmet') {
      pctx.beginPath();
      pctx.arc(67, 60, 11, Math.PI, Math.PI * 2);
      pctx.fill();
      pctx.fillRect(56, 58, 22, 3);
    } else if (playerLook.hat === 'bandana') {
      pctx.fillRect(57, 55, 20, 5);
    } else {
      // cap / beanie: calote simples
      pctx.beginPath();
      pctx.arc(67, 54, 10, Math.PI, Math.PI * 2);
      pctx.fill();
    }
  }
}

export function loadCharacterLook() {
  try{
    const raw = getStoredValue(CUSTOM_STORAGE_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && OUTFIT_PRESETS[parsed.outfit] && SKIN_PRESETS[parsed.skin]) {
      applyCharacterLook(parsed.outfit, parsed.skin, false, parsed.hat, parsed.backpack, parsed.mask);
    }
  } catch(err){}
}

export function saveCharacterLook() {
  try{
    setStoredValue(CUSTOM_STORAGE_KEY, JSON.stringify({
      outfit: playerLook.outfit,
      skin: playerLook.skin,
      hat: playerLook.hat,
      backpack: playerLook.backpack,
      mask: playerLook.mask
    }));
  } catch(err){}
}
