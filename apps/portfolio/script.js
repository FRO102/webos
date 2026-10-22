const DATA = {
  name: 'Frederico Oliveira',
  role: 'Engenharia Informática',
  location: 'Leiria, Portugal',
  email: 'froliveira10213@gmail.com',
  linkedin: 'https://www.linkedin.com/in/frederico-oliveira-3598a614b/',
  github: 'https://github.com/FRO102',
  summary: 'Licenciado em Engenharia Informática, proativo e focado em soluções eficientes. Interessado em sistemas informáticos, administração de sistemas, segurança e desenvolvimento web.',
  experience: [{ company: 'Capgemini', role: 'Estágio Curricular - Help Desk', period: '2019 · 3,5 meses', details: 'Suporte técnico, diagnóstico de problemas, instalação e configuração de hardware e software, formação de utilizadores e manutenção preventiva.' }],
  education: [{ degree: 'Licenciatura em Engenharia Informática', institution: 'Instituto Politécnico de Leiria (ESTG)', period: '2021 – 2026' }, { degree: 'Curso Profissional de Técnico e Gestão de Equipamentos Informáticos', institution: 'Instituto dos Pupilos do Exército', period: '2013 – 2019' }],
  skills: { Desenvolvimento: ['HTML', 'CSS', 'JavaScript', 'C', 'Java', 'SQL', 'Vue', 'Tailwind', 'Laravel'], Redes: ['Cisco', 'Mikrotik', 'TCP/IP', 'OSI'], Virtualização: ['Proxmox', 'ESXi', 'Citrix', 'VMWare', 'VirtualBox', 'GNS3'], Cloud: ['Google Cloud', 'AWS Foundations', 'AWS Security'], Outros: ['Linux', 'Bash', 'Docker', 'Git', 'n8n', 'HTTP', 'REST API'] },
  projects: [{ name: 'Obsidian: Assistente Virtual para Idosos', year: '2026', description: 'Protótipo de um assistente virtual inteligente integrado num ambiente de casa inteligente, pensado para apoiar idosos e cuidadores.', link: 'https://github.com/FRO102/Prototipo_Assistente_Virtual_para_Idosos' }],
  certs: [{ name: 'AWS Academy Cloud Foundations', link: 'https://www.credly.com/badges/c8ef9340-6f73-4da4-baf4-c23590edd89f/public_url' }, { name: 'AWS Academy Cloud Security Foundations', link: 'https://www.credly.com/badges/4df0c06a-8ac9-44a3-a3c6-23afb18cc67e/public_url' }]
};
const output = document.getElementById('output');
const terminal = document.getElementById('terminal-content');
const input = document.getElementById('command-input');
const form = document.getElementById('command-form');
const count = document.getElementById('command-count');
const historyKey = 'portfolio:history';
let history = [];
let historyIndex = 0;
let language = 'pt';

const text = { pt: { about: 'Sobre mim', skills: 'Competências', experience: 'Experiência', education: 'Educação', projects: 'Projetos', certs: 'Certificações', contact: 'Contactos', help: 'Ajuda' }, en: { about: 'About me', skills: 'Skills', experience: 'Experience', education: 'Education', projects: 'Projects', certs: 'Certifications', contact: 'Contact', help: 'Help' } };
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const entry = (html, type = '') => { const node = document.createElement('article'); node.className = `output-entry ${type}`; node.innerHTML = html; output.append(node); output.scrollTop = output.scrollHeight; };
const commandEcho = command => entry(`<span style="color:#51d1b7">fro@portfolio:~$</span> ${esc(command)}`, 'command');
const tags = values => `<div class="tag-list">${values.map(value => `<span class="tag">${esc(value)}</span>`).join('')}</div>`;

function render(name, args = []) {
  const title = text[language][name] || name;
  if (name === 'about') return `<h2>${title}</h2><p>${esc(DATA.summary)}</p><dl class="meta-list"><dt>Nome</dt><dd>${esc(DATA.name)}</dd><dt>Localização</dt><dd>${esc(DATA.location)}</dd><dt>Área</dt><dd>${esc(DATA.role)}</dd></dl>`;
  if (name === 'skills') return `<h2>${title}</h2>${Object.entries(DATA.skills).map(([group, values]) => `<p><strong>${esc(group)}</strong></p>${tags(values)}`).join('')}`;
  if (name === 'experience') return `<h2>${title}</h2>${DATA.experience.map(item => `<div class="project"><strong>${esc(item.role)}</strong><p>${esc(item.company)} · ${esc(item.period)}</p><p>${esc(item.details)}</p></div>`).join('')}`;
  if (name === 'education') return `<h2>${title}</h2>${DATA.education.map(item => `<div class="project"><strong>${esc(item.degree)}</strong><p>${esc(item.institution)} · ${esc(item.period)}</p></div>`).join('')}`;
  if (name === 'projects') return `<h2>${title}</h2>${DATA.projects.map(item => `<div class="project"><strong>${esc(item.name)} · ${esc(item.year)}</strong><p>${esc(item.description)}</p><a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">Abrir projeto ↗</a></div>`).join('')}`;
  if (name === 'certs') return `<h2>${title}</h2>${DATA.certs.map(item => `<div class="project"><a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${esc(item.name)} ↗</a></div>`).join('')}`;
  if (name === 'contact') { const mailto = `mailto:${DATA.email}?subject=${encodeURIComponent('Contacto através do portefólio')}`; return `<h2>${title}</h2><p>Envia-me uma mensagem através do formulário ou do teu cliente de email.</p><form id="contact-form" class="contact-form"><label for="contact-name">Nome</label><input id="contact-name" name="name" type="text" required maxlength="80" placeholder="O teu nome"><label for="contact-email">Email</label><input id="contact-email" name="email" type="email" required maxlength="160" placeholder="o-teu@email.com"><label for="contact-message">Mensagem</label><textarea id="contact-message" name="message" required maxlength="4000" rows="5" placeholder="Escreve a tua mensagem"></textarea><button id="send-btn" type="submit">Enviar mensagem</button><p id="form-status" class="form-status" role="status" aria-live="polite"></p></form><p><a class="email-action" href="${esc(mailto)}">Abrir cliente de email ↗</a></p><dl class="meta-list"><dt>LinkedIn</dt><dd><a href="${esc(DATA.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></dd><dt>GitHub</dt><dd><a href="${esc(DATA.github)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a></dd></dl>`; }
  if (name === 'help') return `<h2>${title}</h2><p>Usa um dos comandos:</p><p><strong>about</strong> · <strong>skills</strong> · <strong>experience</strong> · <strong>education</strong> · <strong>projects</strong> · <strong>certs</strong> · <strong>contact</strong> · <strong>cv</strong> · <strong>clear</strong> · <strong>lang pt|en</strong></p>`;
  if (name === 'whoami') return render('about');
  if (name === 'others') return `<h2>Informação adicional</h2><p>Português: nativo<br>Inglês: B2<br>Licença de condução: B</p>`;
  if (name === 'clear') { output.replaceChildren(); return null; }
  if (name === 'cv') { const file = language === 'en' ? 'Frederico_Oliveira_EN.pdf' : 'Frederico_Oliveira_PT.pdf'; const link = document.createElement('a'); link.href = file; link.download = file; link.click(); return `<p>Download iniciado: ${esc(file)}</p>`; }
  if (name === 'lang') { language = args[0] === 'en' ? 'en' : 'pt'; document.querySelectorAll('.language').forEach(button => button.classList.toggle('active', button.textContent.toLowerCase() === language)); return `<p>Idioma alterado para <strong>${language.toUpperCase()}</strong>.</p>`; }
  return `<p>Comando não encontrado. Escreve <strong>help</strong>.</p>`;
}

async function restore() { try { const saved = await os.storage.get(historyKey); history = Array.isArray(saved) ? saved.slice(-50) : []; historyIndex = history.length; } catch {} count.textContent = history.length; }
function showFormStatus(message, type) { const status = document.getElementById('form-status'); if (!status) return; status.className = `form-status ${type}`; status.textContent = message; }
function attachFormListener() {
  const form = document.getElementById('contact-form');
  if (!form || form.dataset.listenerAttached === 'true') return;
  form.dataset.listenerAttached = 'true';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('send-btn');
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const message = form.elements.message.value.trim();
    if (!name || !email || !message) { showFormStatus('Preenche todos os campos.', 'error'); return; }
    button.disabled = true;
    button.textContent = 'A enviar...';
    showFormStatus('A transmitir a mensagem...', 'info');
    try {
      const response = await fetch('https://formspree.io/f/mljennyo', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, email, message }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      showFormStatus('Mensagem enviada com sucesso.', 'success');
    } catch (error) {
      showFormStatus(`Não foi possível enviar a mensagem (${error.message}). Usa o cliente de email abaixo.`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Enviar mensagem';
    }
  });
}
async function run(command) { const clean = command.trim(); if (!clean) return; commandEcho(clean); const [name, ...args] = clean.toLowerCase().split(/\s+/); if (name === 'clear') render('clear'); else { entry(render(name, args) || ''); attachFormListener(); } if (!['clear'].includes(name)) { history.push(clean); history = history.slice(-50); historyIndex = history.length; count.textContent = history.length; try { await os.storage.set(historyKey, history); } catch {} } }
form.addEventListener('submit', event => { event.preventDefault(); const value = input.value; input.value = ''; run(value); });
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => run(button.dataset.command)));
input.addEventListener('keydown', event => { if (event.key === 'ArrowUp') { event.preventDefault(); if (historyIndex > 0) input.value = history[--historyIndex]; } if (event.key === 'ArrowDown') { event.preventDefault(); historyIndex = Math.min(history.length, historyIndex + 1); input.value = history[historyIndex] || ''; } if (event.key === 'Tab') { event.preventDefault(); const match = ['about','skills','experience','education','projects','certs','contact','help','clear','cv'].find(command => command.startsWith(input.value)); if (match) input.value = match; } });
restore(); input.focus();
