const $ = id => document.getElementById(id);
const frame = $('frame'), addr = $('addr'), msg = $('msg');
const hist = [];
let hi = -1;

const normalize = u => (!u || u === 'about:home' ? 'about:home' : u.startsWith('file:') || /^https?:\/\//i.test(u) ? u : 'https://' + u);

async function load(url) {
  msg.textContent = '';
  addr.value = url === 'about:home' ? '' : url;
  if (url === 'about:home') { frame.hidden = true; $('home-page').hidden = false; frame.removeAttribute('srcdoc'); return; }
  $('home-page').hidden = true;
  frame.hidden = false;
  if (url.startsWith('file:')) {
    try { const html = await os.fs.read(url.slice(5)); frame.sandbox = 'allow-scripts allow-forms'; frame.srcdoc = html; }
    catch (e) { msg.textContent = e.message; }
    return;
  }
  frame.sandbox = 'allow-scripts allow-forms allow-popups allow-same-origin';
  frame.removeAttribute('srcdoc');
  frame.src = url;
  msg.textContent = 'A carregar… (alguns sites bloqueiam a incorporação)';
}

function buttons() { $('back').disabled = hi <= 0; $('fwd').disabled = hi >= hist.length - 1; }
function nav(url, push = true) {
  const target = normalize(url);
  if (push) { hist.splice(hi + 1); hist.push(target); hi = hist.length - 1; }
  buttons();
  load(target);
}

frame.addEventListener('load', () => { if (msg.textContent.startsWith('A carregar')) msg.textContent = ''; });
addr.addEventListener('keydown', e => { if (e.key === 'Enter') nav(addr.value.trim()); });
$('back').onclick = () => { if (hi > 0) { hi--; buttons(); load(hist[hi]); } };
$('fwd').onclick = () => { if (hi < hist.length - 1) { hi++; buttons(); load(hist[hi]); } };
$('reload').onclick = () => load(hist[hi]);
$('home').onclick = () => nav('about:home');
document.querySelectorAll('[data-url]').forEach(button => button.addEventListener('click', () => nav(button.dataset.url)));

nav('about:home');
