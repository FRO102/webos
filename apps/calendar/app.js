const title = document.getElementById('title');
const grid = document.getElementById('grid');
let date = new Date();
function render() {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  title.textContent = date.toLocaleDateString(os.i18n.locale, { month: 'long', year: 'numeric' });
  grid.replaceChildren();
  for (let i = 0; i < first; i++) grid.append(document.createElement('span'));
  for (let day = 1; day <= days; day++) {
    const button = document.createElement('button');
    button.textContent = day;
    if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) button.className = 'today';
    button.onclick = () => os.notify(os.i18n.language === 'en' ? `Selected day: ${day} ${title.textContent}` : `Dia selecionado: ${day} de ${title.textContent}`);
    grid.append(button);
  }
}
document.getElementById('prev').onclick = () => { date.setMonth(date.getMonth() - 1); render(); };
document.getElementById('next').onclick = () => { date.setMonth(date.getMonth() + 1); render(); };
render();
os.i18n.onChange(render);
