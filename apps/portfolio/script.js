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
const DATA_EN = {
  role: 'Computer Engineering',
  summary: 'Computer Engineering graduate, proactive and focused on efficient solutions. Interested in computer systems, system administration, security, and web development.',
  experience: [{ ...DATA.experience[0], role: 'Internship - Help Desk', details: 'Technical support, troubleshooting, hardware and software installation and configuration, user training, and preventive maintenance.' }],
  education: [{ ...DATA.education[0], degree: 'BSc in Computer Engineering' }, { ...DATA.education[1], degree: 'Vocational Course in IT Equipment Management' }],
  skills: { Development: DATA.skills.Desenvolvimento, Networking: DATA.skills.Redes, Virtualization: DATA.skills.Virtualização, Cloud: DATA.skills.Cloud, Other: DATA.skills.Outros },
  projects: [{ ...DATA.projects[0], name: 'Obsidian: Virtual Assistant for Older Adults', description: 'Prototype of an intelligent virtual assistant integrated into a smart home environment, designed to support older adults and caregivers.' }]
};
const output = document.getElementById('output');
const terminal = document.getElementById('terminal-content');
const input = document.getElementById('command-input');
const form = document.getElementById('command-form');
const count = document.getElementById('command-count');
const historyKey = 'portfolio:history';
let history = [];
let historyIndex = 0;
let language = window.os?.i18n?.language === 'en' ? 'en' : 'pt';
let lastView = null;

const text = {
  pt: {
    about: 'Sobre mim', skills: 'Competências', experience: 'Experiência', education: 'Educação', projects: 'Projetos', certs: 'Certificações', contact: 'Contactos', help: 'Ajuda',
    portfolio: 'Portefólio pessoal', explore: 'Explorar', downloadCv: 'Descarregar CV', clearTerminal: 'Limpar terminal', available: 'disponível', interactive: 'Portefólio interativo', greeting: 'Olá, sou o Frederico', profile: 'perfil', skillsCount: 'competências', project: 'projeto', inputPlaceholder: 'escreve help para começar', commandLabel: 'Comando do portefólio', runCommand: 'Executar comando', commandsAvailable: 'Comandos disponíveis:', historyHint: '↑ ↓ histórico',
    name: 'Nome', location: 'Localização', area: 'Área', openProject: 'Abrir projeto ↗', sendIntro: 'Envia-me uma mensagem através do formulário ou do teu cliente de email.', email: 'Email', message: 'Mensagem', yourName: 'O teu nome', emailPlaceholder: 'o-teu@email.com', messagePlaceholder: 'Escreve a tua mensagem', send: 'Enviar mensagem', sending: 'A enviar...', transmitting: 'A transmitir a mensagem...', sent: 'Mensagem enviada com sucesso.', fillFields: 'Preenche todos os campos.', emailClient: 'Abrir cliente de email ↗', notFound: 'Comando não encontrado. Escreve help.', useCommands: 'Usa um dos comandos:', extraInfo: 'Informação adicional', native: 'nativo', drivingLicence: 'Licença de condução', languageChanged: 'Idioma alterado para', downloadStarted: 'Download iniciado:', sendFailed: 'Não foi possível enviar a mensagem', contactSubject: 'Contacto através do portefólio'
  },
  en: {
    about: 'About me', skills: 'Skills', experience: 'Experience', education: 'Education', projects: 'Projects', certs: 'Certifications', contact: 'Contact', help: 'Help',
    portfolio: 'Personal portfolio', explore: 'Explore', downloadCv: 'Download CV', clearTerminal: 'Clear terminal', available: 'available', interactive: 'Interactive portfolio', greeting: "Hi, I'm Frederico", profile: 'profile', skillsCount: 'skills', project: 'project', inputPlaceholder: 'type help to get started', commandLabel: 'Portfolio command', runCommand: 'Run command', commandsAvailable: 'Available commands:', historyHint: '↑ ↓ history',
    name: 'Name', location: 'Location', area: 'Field', openProject: 'Open project ↗', sendIntro: 'Send me a message using the form or your email client.', email: 'Email', message: 'Message', yourName: 'Your name', emailPlaceholder: 'you@email.com', messagePlaceholder: 'Write your message', send: 'Send message', sending: 'Sending...', transmitting: 'Sending your message...', sent: 'Message sent successfully.', fillFields: 'Please complete all fields.', emailClient: 'Open email client ↗', notFound: 'Command not found. Type help.', useCommands: 'Available commands:', extraInfo: 'Additional information', native: 'native', drivingLicence: 'Driving licence', languageChanged: 'Language changed to', downloadStarted: 'Download started:', sendFailed: 'Could not send the message', contactSubject: 'Portfolio contact'
  }
};
const t = key => text[language][key] || key;
const portfolioData = () => language === 'en' ? DATA_EN : DATA;
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const entry = (html, type = '') => { const node = document.createElement('article'); node.className = `output-entry ${type}`; node.innerHTML = html; output.append(node); output.scrollTop = output.scrollHeight; };
const commandEcho = command => entry(`<span style="color:#51d1b7">fro@portfolio:~$</span> ${esc(command)}`, 'command');
const tags = values => `<div class="tag-list">${values.map(value => `<span class="tag">${esc(value)}</span>`).join('')}</div>`;

function render(name, args = []) {
  const title = text[language][name] || name;
  const data = portfolioData();
  if (name === 'about') return `<h2>${title}</h2><p>${esc(data.summary)}</p><dl class="meta-list"><dt>${t('name')}</dt><dd>${esc(DATA.name)}</dd><dt>${t('location')}</dt><dd>${esc(DATA.location)}</dd><dt>${t('area')}</dt><dd>${esc(data.role)}</dd></dl>`;
  if (name === 'skills') return `<h2>${title}</h2>${Object.entries(data.skills).map(([group, values]) => `<p><strong>${esc(group)}</strong></p>${tags(values)}`).join('')}`;
  if (name === 'experience') return `<h2>${title}</h2>${data.experience.map(item => `<div class="project"><strong>${esc(item.role)}</strong><p>${esc(item.company)} · ${esc(item.period)}</p><p>${esc(item.details)}</p></div>`).join('')}`;
  if (name === 'education') return `<h2>${title}</h2>${data.education.map(item => `<div class="project"><strong>${esc(item.degree)}</strong><p>${esc(item.institution)} · ${esc(item.period)}</p></div>`).join('')}`;
  if (name === 'projects') return `<h2>${title}</h2>${data.projects.map(item => `<div class="project"><strong>${esc(item.name)} · ${esc(item.year)}</strong><p>${esc(item.description)}</p><a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${t('openProject')}</a></div>`).join('')}`;
  if (name === 'certs') return `<h2>${title}</h2>${DATA.certs.map(item => `<div class="project"><a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${esc(item.name)} ↗</a></div>`).join('')}`;
  if (name === 'contact') { const mailto = `mailto:${DATA.email}?subject=${encodeURIComponent(t('contactSubject'))}`; return `<h2>${title}</h2><p>${t('sendIntro')}</p><form id="contact-form" class="contact-form"><label for="contact-name">${t('name')}</label><input id="contact-name" name="name" type="text" required maxlength="80" placeholder="${t('yourName')}"><label for="contact-email">${t('email')}</label><input id="contact-email" name="email" type="email" required maxlength="160" placeholder="${t('emailPlaceholder')}"><label for="contact-message">${t('message')}</label><textarea id="contact-message" name="message" required maxlength="4000" rows="5" placeholder="${t('messagePlaceholder')}"></textarea><button id="send-btn" type="submit">${t('send')}</button><p id="form-status" class="form-status" role="status" aria-live="polite"></p></form><p><a class="email-action" href="${esc(mailto)}">${t('emailClient')}</a></p><dl class="meta-list"><dt>LinkedIn</dt><dd><a href="${esc(DATA.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></dd><dt>GitHub</dt><dd><a href="${esc(DATA.github)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a></dd></dl>`; }
  if (name === 'help') return `<h2>${title}</h2><p>${t('useCommands')}</p><p><strong>about</strong> · <strong>skills</strong> · <strong>experience</strong> · <strong>education</strong> · <strong>projects</strong> · <strong>certs</strong> · <strong>contact</strong> · <strong>cv</strong> · <strong>clear</strong> · <strong>lang pt|en</strong></p>`;
  if (name === 'whoami') return render('about');
  if (name === 'others') return `<h2>${t('extraInfo')}</h2><p>Português: ${t('native')}<br>English: B2<br>${t('drivingLicence')}: B</p>`;
  if (name === 'clear') { output.replaceChildren(); return null; }
  if (name === 'cv') { const file = language === 'en' ? 'Frederico_Oliveira_EN.pdf' : 'Frederico_Oliveira_PT.pdf'; const link = document.createElement('a'); link.href = file; link.download = file; link.click(); return `<p>${t('downloadStarted')} ${esc(file)}</p>`; }
  if (name === 'lang') { setLanguage(args[0] === 'en' ? 'en' : 'pt'); return `<p>${t('languageChanged')} <strong>${language.toUpperCase()}</strong>.</p>`; }
  return `<p>${t('notFound')}</p>`;
}

function setLanguage(nextLanguage) {
  language = nextLanguage === 'en' ? 'en' : 'pt';
  applyLanguage();
  if (lastView) {
    output.replaceChildren();
    entry(render(lastView) || '');
    attachFormListener();
  }
}

function applyLanguage() {
  const en = language === 'en';
  const d = portfolioData();
  document.documentElement.lang = en ? 'en' : 'pt-PT';
  document.title = `${en ? 'Portfolio' : 'Portefólio'} — ${DATA.name}`;
  document.querySelector('.command-panel').setAttribute('aria-label', t('explore'));
  document.querySelector('.terminal').setAttribute('aria-label', en ? 'Portfolio terminal' : 'Terminal do portefólio');
  document.querySelector('.brand small').textContent = t('portfolio');
  document.querySelector('.profile strong').textContent = d.role;
  document.querySelector('.nav-label').textContent = t('explore');
  document.querySelectorAll('.nav-groups [data-command]').forEach(button => { button.textContent = text[language][button.dataset.command]; });
  document.querySelector('[data-command="cv"]').textContent = t('downloadCv');
  document.querySelector('[data-command="help"]').textContent = t('help');
  document.querySelector('[data-command="clear"]').textContent = t('clearTerminal');
  const online = document.querySelector('.online');
  online.lastChild.textContent = ` ${t('available')}`;
  const welcome = document.getElementById('welcome');
  welcome.innerHTML = `<div class="welcome-kicker">${t('interactive')}</div><h1>${t('greeting')}<span>.</span></h1><p>${esc(d.summary)}</p><div class="quick-stats"><span><b>01</b> ${t('profile')}</span><span><b>09</b> ${t('skillsCount')}</span><span><b>01</b> ${t('project')}</span></div>`;
  input.placeholder = t('inputPlaceholder');
  input.setAttribute('aria-label', t('commandLabel'));
  form.querySelector('button').setAttribute('aria-label', t('runCommand'));
  const footer = document.querySelector('.terminal-footer');
  footer.children[0].firstChild.textContent = `${t('commandsAvailable')} `;
  footer.children[1].textContent = t('historyHint');
  document.querySelectorAll('.language').forEach(button => button.classList.toggle('active', button.textContent.toLowerCase() === language));
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
    if (!name || !email || !message) { showFormStatus(t('fillFields'), 'error'); return; }
    button.disabled = true;
    button.textContent = t('sending');
    showFormStatus(t('transmitting'), 'info');
    try {
      const response = await fetch('https://formspree.io/f/mljennyo', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, email, message }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      showFormStatus(t('sent'), 'success');
    } catch (error) {
      showFormStatus(`${t('sendFailed')} (${error.message}). ${t('emailClient')}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = t('send');
    }
  });
}
async function run(command) { const clean = command.trim(); if (!clean) return; commandEcho(clean); const [name, ...args] = clean.toLowerCase().split(/\s+/); if (name === 'clear') { lastView = null; render('clear'); } else { const html = render(name, args); if (name !== 'lang') lastView = name; entry(html || ''); attachFormListener(); } if (!['clear'].includes(name)) { history.push(clean); history = history.slice(-50); historyIndex = history.length; count.textContent = history.length; try { await os.storage.set(historyKey, history); } catch {} } }
form.addEventListener('submit', event => { event.preventDefault(); const value = input.value; input.value = ''; run(value); });
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => run(button.dataset.command)));
os.i18n.onChange(({ language: systemLanguage }) => setLanguage(systemLanguage === 'en' ? 'en' : 'pt'));
input.addEventListener('keydown', event => { if (event.key === 'ArrowUp') { event.preventDefault(); if (historyIndex > 0) input.value = history[--historyIndex]; } if (event.key === 'ArrowDown') { event.preventDefault(); historyIndex = Math.min(history.length, historyIndex + 1); input.value = history[historyIndex] || ''; } if (event.key === 'Tab') { event.preventDefault(); const match = ['about','skills','experience','education','projects','certs','contact','help','clear','cv'].find(command => command.startsWith(input.value)); if (match) input.value = match; } });
applyLanguage();
restore(); input.focus();
