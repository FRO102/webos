(function () {
  'use strict';

  const CANVAS_SIZE = 512;
  const DEFAULT_COLOR = '#000000';
  const DEFAULT_THICKNESS = 4;
  const MAX_UNDO = 100;

  const state = {
    color: DEFAULT_COLOR,
    thickness: DEFAULT_THICKNESS,
    eraser: false,
    strokes: [],       // array de strokes concluídos: { color, thickness, eraser, points: [{x,y}, ...] }
    current: null,     // stroke em progresso
    drawing: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    saving: false
  };

  let canvas, ctx;
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    canvas = document.getElementById('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    els.palette = document.getElementById('palette');
    els.colorPicker = document.getElementById('color-picker');
    els.thickness = document.getElementById('thickness');
    els.thicknessValue = document.getElementById('thickness-value');
    els.thicknessPreview = document.getElementById('thickness-preview');
    els.eraser = document.getElementById('eraser');
    els.undo = document.getElementById('undo');
    els.clear = document.getElementById('clear');
    els.save = document.getElementById('save');
    els.status = document.getElementById('status');

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    els.palette.addEventListener('click', onPaletteClick);
    els.colorPicker.addEventListener('input', onColorPickerInput);
    els.thickness.addEventListener('input', onThicknessInput);
    els.eraser.addEventListener('click', onToggleEraser);
    els.undo.addEventListener('click', onUndo);
    els.clear.addEventListener('click', onClear);
    els.save.addEventListener('click', onSave);

    setupI18n();
    updateToolbarUI();
    updateThicknessPreview();
    redraw();
  }

  // ---------------------------------------------------------------- desenho

  function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function onPointerDown(event) {
    if (state.saving) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (state.drawing) return;

    event.preventDefault();
    try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* noop */ }

    state.drawing = true;
    state.pointerId = event.pointerId;

    const pt = getCanvasPoint(event);
    state.current = {
      color: state.color,
      thickness: state.thickness,
      eraser: state.eraser,
      points: [pt]
    };
    state.lastX = pt.x;
    state.lastY = pt.y;

    drawDot(state.current, pt);
  }

  function onPointerMove(event) {
    if (!state.drawing || event.pointerId !== state.pointerId) return;
    event.preventDefault();

    let events = [event];
    if (typeof event.getCoalescedEvents === 'function') {
      const coalesced = event.getCoalescedEvents();
      if (coalesced && coalesced.length) events = coalesced;
    }

    for (const e of events) {
      const pt = getCanvasPoint(e);
      if (pt.x === state.lastX && pt.y === state.lastY) continue;
      drawSegment(state.current, state.lastX, state.lastY, pt.x, pt.y);
      state.current.points.push(pt);
      state.lastX = pt.x;
      state.lastY = pt.y;
    }
  }

  function onPointerUp(event) {
    if (!state.drawing || event.pointerId !== state.pointerId) return;
    state.drawing = false;
    try { canvas.releasePointerCapture(event.pointerId); } catch (e) { /* noop */ }
    state.pointerId = null;

    if (state.current && state.current.points.length) {
      state.strokes.push(state.current);
      if (state.strokes.length > MAX_UNDO) state.strokes.shift();
    }
    state.current = null;
    updateToolbarUI();
  }

  function applyStrokeStyle(stroke) {
    ctx.save();
    ctx.lineWidth = stroke.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    if (stroke.eraser) ctx.globalCompositeOperation = 'destination-out';
    else ctx.globalCompositeOperation = 'source-over';
  }

  function drawDot(stroke, pt) {
    applyStrokeStyle(stroke);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(0.5, stroke.thickness / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSegment(stroke, x0, y0, x1, y1) {
    applyStrokeStyle(stroke);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  function drawFullStroke(stroke) {
    if (!stroke.points.length) return;

    if (stroke.points.length === 1) {
      drawDot(stroke, stroke.points[0]);
      return;
    }

    applyStrokeStyle(stroke);
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of state.strokes) drawFullStroke(stroke);
  }

  // ---------------------------------------------------------------- toolbar

  function onPaletteClick(event) {
    const btn = event.target.closest('[data-color]');
    if (!btn) return;
    state.eraser = false;
    state.color = btn.dataset.color;
    els.colorPicker.value = state.color;
    updateToolbarUI();
    updateThicknessPreview();
  }

  function onColorPickerInput() {
    state.eraser = false;
    state.color = els.colorPicker.value;
    updateToolbarUI();
    updateThicknessPreview();
  }

  function onThicknessInput() {
    const n = Number(els.thickness.value);
    state.thickness = isFinite(n) ? Math.max(1, Math.min(40, n)) : DEFAULT_THICKNESS;
    updateThicknessPreview();
  }

  function onToggleEraser() {
    state.eraser = !state.eraser;
    updateToolbarUI();
    updateThicknessPreview();
  }

  function onUndo() {
    if (!state.strokes.length) return;
    state.strokes.pop();
    redraw();
    updateToolbarUI();
    setStatus('');
  }

  async function onClear() {
    if (!state.strokes.length) return;

    let confirmed = true;
    if (window.os && os.dialog && typeof os.dialog.confirm === 'function') {
      try {
        confirmed = await os.dialog.confirm({
          title: t('Limpar tela'),
          message: t('Todo o desenho será apagado. Esta ação não pode ser desfeita.'),
          okLabel: t('Limpar'),
          danger: true
        });
      } catch (err) {
        confirmed = false;
      }
    } else {
      try { confirmed = window.confirm(t('Limpar a tela?')); }
      catch (err) { confirmed = false; }
    }

    if (!confirmed) return;

    state.strokes = [];
    redraw();
    updateToolbarUI();
    setStatus('');
  }

  function updateToolbarUI() {
    els.palette.querySelectorAll('[data-color]').forEach(btn => {
      const active = !state.eraser &&
        btn.dataset.color.toLowerCase() === state.color.toLowerCase();
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    els.eraser.setAttribute('aria-pressed', state.eraser ? 'true' : 'false');

    els.undo.disabled = state.strokes.length === 0 || state.saving;
    els.clear.disabled = state.strokes.length === 0 || state.saving;
    els.save.disabled = state.strokes.length === 0 || state.saving;

    els.thicknessValue.textContent = String(state.thickness);
  }

  function updateThicknessPreview() {
    const el = els.thicknessPreview;
    const size = Math.max(6, Math.min(40, state.thickness));
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    if (state.eraser) {
      el.style.background = 'transparent';
      el.style.border = '1px dashed var(--os-border, #999)';
    } else {
      el.style.background = state.color;
      el.style.border = '1px solid transparent';
    }
  }

  // ---------------------------------------------------------------- guardar

  async function onSave() {
    if (state.saving) return;

    if (!state.strokes.length) {
      setStatus(t('Nada para guardar.'), 'error');
      return;
    }

    if (!window.os || !os.dialog || !os.fs) {
      setStatus(t('SDK indisponível.'), 'error');
      return;
    }

    // 1. Gerar Blob PNG (fundo branco composto)
    let blob;
    try {
      blob = await canvasToPngBlob();
    } catch (err) {
      console.error('Desenhador: falha a gerar Blob PNG', err);
      setStatus(t('Falha ao gerar a imagem.'), 'error');
      return;
    }

    // 2. Pedir caminho via diálogo do shell
    let path;
    try {
      path = await os.dialog.save({
        title: t('Guardar imagem'),
        start: '/home/user/Imagens/',
        defaultName: 'desenho.png'
      });
    } catch (err) {
      setStatus(errorMessage(err, t('Falha ao abrir o diálogo.')), 'error');
      return;
    }

    if (!path) return; // cancelado

    // 3. Garantir extensão .png
    if (!/\.png$/i.test(path)) {
      path += '.png';
      try {
        if (await os.fs.exists(path)) {
          const overwrite = await os.dialog.confirm({
            title: t('Substituir ficheiro'),
            message: t('Já existe um ficheiro com este nome. Substituir?'),
            okLabel: t('Substituir'),
            danger: true
          });
          if (!overwrite) return;
        }
      } catch (err) {
        setStatus(errorMessage(err, t('Falha ao verificar o ficheiro.')), 'error');
        return;
      }
    }

    // 4. Escrever (o teste central a os.fs.write + Blob + mime)
    state.saving = true;
    updateToolbarUI();
    setStatus(t('A guardar…'), 'info');

    try {
      const dataUrl = await blobToDataUrl(blob);
      await writeWithOverwrite(path, dataUrl, 'image/png');
      setStatus(t('Guardado em') + ' ' + path, 'success');
    } catch (err) {
      console.error('Desenhador: falha ao guardar PNG — se o código for "invalid_args" ou "unsupported", o shell não está a aceitar Blob em os.fs.write.', err);
      setStatus(errorMessage(err, t('Falha ao guardar a imagem.')), 'error');
    } finally {
      state.saving = false;
      updateToolbarUI();
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Formato de imagem inválido'));
      reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a imagem'));
      reader.readAsDataURL(blob);
    });
  }

  async function writeWithOverwrite(path, blob, mime) {
    try {
      await os.fs.write(path, blob, mime);
    } catch (err) {
      if (window.os && os.errors && typeof os.errors.is === 'function' &&
          os.errors.is(err, 'already_exists')) {
        await os.fs.remove(path);
        await os.fs.write(path, blob, mime);
      } else {
        throw err;
      }
    }
  }

  function canvasToPngBlob() {
    return new Promise((resolve, reject) => {
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const octx = out.getContext('2d');
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, out.width, out.height);
      octx.drawImage(canvas, 0, 0);

      if (typeof out.toBlob !== 'function') {
        reject(new Error('toBlob indisponível'));
        return;
      }
      out.toBlob(b => {
        if (b) resolve(b);
        else reject(new Error('toBlob devolveu null'));
      }, 'image/png');
    });
  }

  // ---------------------------------------------------------------- i18n + erros

  function setupI18n() {
    if (!window.os || !os.i18n) return;
    try {
      if (typeof os.i18n.apply === 'function') os.i18n.apply(document.body);
    } catch (err) { /* noop */ }

    if (typeof os.i18n.onChange === 'function') {
      os.i18n.onChange(() => {
        try {
          if (typeof os.i18n.apply === 'function') os.i18n.apply(document.body);
        } catch (err) { /* noop */ }
        updateToolbarUI();
      });
    }
  }

  function t(text) {
    if (window.os && os.i18n && typeof os.i18n.t === 'function') {
      try { return os.i18n.t(text); } catch (err) { return text; }
    }
    return text;
  }

  function errorMessage(err, fallback) {
    if (window.os && os.errors && typeof os.errors.message === 'function') {
      try { return os.errors.message(err, fallback); } catch (e) { /* noop */ }
    }
    return fallback;
  }

  function setStatus(message, kind) {
    if (!els.status) return;
    els.status.textContent = message || '';
    if (kind) els.status.dataset.state = kind;
    else delete els.status.dataset.state;
  }
})();