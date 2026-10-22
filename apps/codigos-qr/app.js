const $ = id => document.getElementById(id);
let contentType = 'text', qr = null;
function makeQr() {
  const value = $('content').value.trim(), error = $('error');
  $('download').disabled = $('save-virtual').disabled = true;
  if (!value) { error.textContent = ''; $('placeholder').hidden = false; $('qr-frame').hidden = true; qr = null; return; }
  if (contentType === 'url' && !/^(https?:\/\/|mailto:)/i.test(value)) { error.textContent = 'Indica um endereço http, https ou mailto.'; $('placeholder').hidden = false; $('qr-frame').hidden = true; qr = null; return; }
  try {
    qr = qrcode(0, $('error-level').value); qr.addData(value, 'Byte'); qr.make();
    const modules = qr.getModuleCount(), requested = Number($('size').value), quiet = 4, total = modules + quiet * 2, scale = Math.max(1, Math.floor(requested / total)), actual = scale * total;
    const canvas = $('qr-canvas'), context = canvas.getContext('2d'); canvas.width = canvas.height = actual;
    context.fillStyle = '#fff'; context.fillRect(0, 0, actual, actual); context.fillStyle = '#152d29';
    for (let row = 0; row < modules; row++) for (let col = 0; col < modules; col++) if (qr.isDark(row, col)) context.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
    $('qr-caption').textContent = value; $('placeholder').hidden = true; $('qr-frame').hidden = false; error.textContent = '';
    $('download').disabled = $('save-virtual').disabled = false; $('status').textContent = `Código ${modules} × ${modules} · ${value.length} caracteres`;
  } catch (exception) { qr = null; error.textContent = exception.message.includes('code length overflow') ? 'Conteúdo demasiado longo para este nível de correção. Reduz o texto ou escolhe correção baixa.' : 'Não foi possível gerar o código QR.'; $('placeholder').hidden = false; $('qr-frame').hidden = true; }
}
document.querySelectorAll('[data-type]').forEach(button => button.onclick = () => { contentType = button.dataset.type; document.querySelectorAll('[data-type]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); $('content').placeholder = contentType === 'url' ? 'https://exemplo.pt' : 'Escreve ou cola o texto'; if (contentType === 'url' && $('content').value && !/^(https?:\/\/|mailto:)/i.test($('content').value.trim())) $('content').value = ''; makeQr(); });
$('content').oninput = makeQr; $('size').onchange = makeQr; $('error-level').onchange = makeQr;
$('download').onclick = () => { if (!qr) return; const link = document.createElement('a'); link.download = 'codigo-qr.png'; link.href = $('qr-canvas').toDataURL('image/png'); link.click(); };
$('save-virtual').onclick = async () => { if (!qr) return; const path = await os.dialog.save({ title: 'Guardar código QR', start: '/home/user/Imagens', defaultName: 'codigo-qr.png' }); if (!path) return; try { const blob = await new Promise(resolve => $('qr-canvas').toBlob(resolve, 'image/png')); const data = await blob.arrayBuffer(); const bytes = new Uint8Array(data); let binary = ''; for (let start = 0; start < bytes.length; start += 0x8000) binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000)); await os.fs.write(path, `data:image/png;base64,${btoa(binary)}`, 'image/png'); $('status').textContent = `Imagem guardada em ${path}`; } catch (error) { $('status').textContent = error.message; } };
makeQr();