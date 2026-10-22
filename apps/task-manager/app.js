const tasks = document.getElementById('tasks');
const summary = document.getElementById('summary');
const empty = document.getElementById('empty');

const render = async () => {
  const windows = await os.shell.windows();
  tasks.replaceChildren();
  empty.hidden = windows.length > 0;
  summary.textContent = `${windows.length} ${windows.length === 1 ? 'janela aberta' : 'janelas abertas'}`;
  windows.forEach(window => {
    const row = document.createElement('tr');
    const name = document.createElement('td'); name.textContent = window.title;
    const workspace = document.createElement('td'); workspace.textContent = `Área ${window.workspace}`;
    const state = document.createElement('td'); state.textContent = window.minimized ? 'Minimizada' : window.maximized ? 'Maximizada' : 'Ativa';
    const actions = document.createElement('td');
    const focus = document.createElement('button'); focus.textContent = 'Focar'; focus.onclick = () => os.shell.focus(window.id);
    const close = document.createElement('button'); close.textContent = 'Fechar'; close.onclick = () => os.shell.close(window.id);
    actions.append(focus, close); row.append(name, workspace, state, actions); tasks.append(row);
  });
};

document.getElementById('refresh').onclick = render;
setInterval(render, 1000);
os.on('shell:changed', render);
render().catch(error => { summary.textContent = error.message; });