const catalog = document.getElementById('catalog');
const search = document.getElementById('search');
const count = document.getElementById('count');
const categoryFilter = document.getElementById('category-filter');
let apps = [];
let categories = [];

const translate = text => os.i18n?.t(text) ?? text;
const categoryLabel = category => os.i18n?.language === 'en' ? category.nameEn : category.name;

const populateCategories = () => {
  const selected = categoryFilter.value;
  categoryFilter.replaceChildren();
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = translate('Todas as categorias');
  categoryFilter.append(allOption);
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = categoryLabel(category);
    categoryFilter.append(option);
  });
  categoryFilter.value = selected;
};

const render = () => {
  const query = search.value.trim().toLocaleLowerCase('pt');
  const selectedCategory = categoryFilter.value;
  const found = apps.filter(app => {
    const category = app.category;
    const searchableText = `${app.name} ${translate(app.name)} ${app.id} ${category.name} ${category.nameEn}`;
    return (!selectedCategory || category.id === selectedCategory)
      && searchableText.toLocaleLowerCase('pt').includes(query);
  });
  catalog.replaceChildren();
  count.textContent = `${found.length} ${found.length === 1 ? 'aplicação disponível' : 'aplicações disponíveis'}`;
  if (!found.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Nenhuma aplicação encontrada.'; catalog.append(empty); return; }
  categories.forEach(category => {
    const categoryApps = found.filter(app => app.category.id === category.id);
    if (!categoryApps.length) return;
    const section = document.createElement('section');
    section.className = 'category-section';
    const heading = document.createElement('h2');
    heading.textContent = `${categoryLabel(category)} · ${categoryApps.length}`;
    const grid = document.createElement('div');
    grid.className = 'app-grid';
    categoryApps.forEach(app => {
      const card = document.createElement('article');
      const icon = document.createElement('img'); icon.src = app.icon; icon.alt = '';
      const info = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = translate(app.name);
      const meta = document.createElement('p'); meta.textContent = `versão ${app.version}`;
      const button = document.createElement('button'); button.textContent = translate('Abrir'); button.onclick = () => os.shell.open(app.id);
      info.append(title, meta, button); card.append(icon, info); grid.append(card);
    });
    section.append(heading, grid);
    catalog.append(section);
  });
};

search.oninput = render;
categoryFilter.onchange = render;
os.i18n?.onChange?.(() => { populateCategories(); render(); });
os.shell.apps().then(data => {
  apps = data;
  categories = [...new Map(apps.map(app => [app.category.id, app.category])).values()]
    .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  populateCategories();
  render();
}).catch(error => { count.textContent = error.message; });