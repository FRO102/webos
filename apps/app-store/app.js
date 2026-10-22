const catalog = document.getElementById('catalog');
const search = document.getElementById('search');
const count = document.getElementById('count');
let apps = [];

const render = () => {
  const query = search.value.trim().toLocaleLowerCase('pt');
  const found = apps.filter(app => `${app.name} ${app.id}`.toLocaleLowerCase('pt').includes(query));
  catalog.replaceChildren();
  count.textContent = `${found.length} ${found.length === 1 ? 'aplicação disponível' : 'aplicações disponíveis'}`;
  if (!found.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Nenhuma aplicação encontrada.'; catalog.append(empty); return; }
  found.forEach(app => {
    const card = document.createElement('article');
    const icon = document.createElement('img'); icon.src = app.icon; icon.alt = '';
    const info = document.createElement('div');
    const title = document.createElement('h2'); title.textContent = app.name;
    const meta = document.createElement('p'); meta.textContent = `${app.category} · versão ${app.version}`;
    const button = document.createElement('button'); button.textContent = 'Abrir'; button.onclick = () => os.shell.open(app.id);
    info.append(title, meta, button); card.append(icon, info); catalog.append(card);
  });
};

search.oninput = render;
os.shell.apps().then(data => { apps = data; render(); }).catch(error => { count.textContent = error.message; });