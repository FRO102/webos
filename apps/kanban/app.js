function t(en, pt) { return (window.os && os.i18n && os.i18n.language === 'en') ? en : pt; }
function escapeHtml(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
let tasks = [];

async function loadTasks() {
  try {
    const saved = await os.storage.get("tasks");
    if (saved && Array.isArray(saved)) tasks = saved;
    else tasks = [
      { id:"1", title:t("Explore WebOS ecosystem","Explorar o ecossistema do WebOS"), status:"done" },
      { id:"2", title:t("Implement Kanban board","Implementar o Quadro Kanban"), status:"inprogress" },
      { id:"3", title:t("Organize weekly tasks","Organizar tarefas semanais"), status:"todo" }
    ];
    renderTasks();
  } catch (e) { console.error("Erro ao carregar tarefas", e); }
}
async function saveTasks() { try { await os.storage.set("tasks", tasks); } catch (e) { console.error("Erro ao guardar tarefas", e); } }
function renderTasks() {
  const columns = { todo: document.getElementById("list-todo"), inprogress: document.getElementById("list-inprogress"), done: document.getElementById("list-done") };
  const counts = { todo:0, inprogress:0, done:0 };
  Object.values(columns).forEach((col) => { if (col) col.innerHTML = ""; });
  tasks.forEach((task) => {
    counts[task.status]++;
    const card = document.createElement("div");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.id = task.id;
    card.innerHTML = `<div class="task-title">${escapeHtml(task.title)}</div><button class="task-delete" title="${t('Delete','Eliminar')}" aria-label="${t('Delete task','Eliminar tarefa')}">✕</button>`;
    card.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", task.id));
    const del = card.querySelector(".task-delete");
    del.onclick = async (e) => {
      e.stopPropagation();
      const ok = (window.os && os.dialog) ? await os.dialog.confirm({ title:t('Delete task','Eliminar tarefa'), message:t('Delete this task?','Apagar esta tarefa?'), okLabel:t('Delete','Eliminar'), danger:true }) : true;
      if (!ok) return;
      deleteTask(task.id);
    };
    if (columns[task.status]) columns[task.status].appendChild(card);
  });
  const ct = document.getElementById("count-todo"); if (ct) ct.textContent = counts.todo;
  const ci = document.getElementById("count-inprogress"); if (ci) ci.textContent = counts.inprogress;
  const cd = document.getElementById("count-done"); if (cd) cd.textContent = counts.done;
}
function allowDrop(e) { e.preventDefault(); }
function drop(e, newStatus) {
  e.preventDefault();
  const taskId = e.dataTransfer.getData("text/plain");
  const task = tasks.find((t) => t.id === taskId);
  if (task && task.status !== newStatus) { task.status = newStatus; saveTasks(); renderTasks(); if (window.os && os.notify) os.notify(t("Task moved.","Tarefa movida.")); }
}
function deleteTask(id) { tasks = tasks.filter((t) => t.id !== id); saveTasks(); renderTasks(); }
function addTask() {
  const titleInput = document.getElementById("task-title");
  const statusSelect = document.getElementById("task-column");
  const title = titleInput.value.trim();
  if (!title) return;
  tasks.push({ id: Date.now().toString(), title, status: statusSelect.value });
  saveTasks(); renderTasks();
  titleInput.value = "";
  if (window.os && os.notify) os.notify(t("Task created.","Tarefa criada com sucesso."));
}
const addBtn = document.getElementById("add-btn"); if (addBtn) addBtn.onclick = addTask;
const titleInputEl = document.getElementById("task-title"); if (titleInputEl) titleInputEl.onkeypress = (e) => { if (e.key === "Enter") addTask(); };
(async () => {
  try { if (window.os && os.i18n && typeof os.i18n.onChange === 'function') os.i18n.onChange(() => renderTasks()); } catch (e) {}
  await loadTasks();
})();