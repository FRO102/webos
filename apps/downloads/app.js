const list = document.getElementById('list');
const key = 'history';
async function render() { const items = await os.storage.get(key) || []; list.replaceChildren(); if (!items.length) { const p = document.createElement('p'); p.textContent = 'Nenhum download registado.'; list.append(p); return; } items.forEach(item => { const article = document.createElement('article'); const name = document.createElement('strong'); const meta = document.createElement('span'); name.textContent = item.name; meta.textContent = `${item.size} · ${os.i18n.date(item.time, { dateStyle: 'short', timeStyle: 'short' })}`; article.append(name, meta); list.append(article); }); }
document.getElementById('clear').onclick = async () => { await os.storage.remove(key); render(); };
render();
os.i18n.onChange(render);
