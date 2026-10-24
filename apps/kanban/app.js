let tasks = [];

async function loadTasks() {
  try {
    const saved = await os.storage.get("tasks");
    if (saved && Array.isArray(saved)) {
      tasks = saved;
    } else {
      tasks = [
        { id: "1", title: "Explorar o ecossistema do WebOS", status: "done" },
        { id: "2", title: "Implementar o Quadro Kanban", status: "inprogress" },
        { id: "3", title: "Organizar tarefas semanais", status: "todo" }
      ];
    }
    renderTasks();
  } catch (e) {
    console.error("Erro ao carregar tarefas", e);
  }
}

async function saveTasks() {
  try {
    await os.storage.set("tasks", tasks);
  } catch (e) {
    console.error("Erro ao guardar tarefas", e);
  }
}

function renderTasks() {
  const columns = {
    todo: document.getElementById("list-todo"),
    inprogress: document.getElementById("list-inprogress"),
    done: document.getElementById("list-done")
  };

  const counts = { todo: 0, inprogress: 0, done: 0 };

  Object.values(columns).forEach(col => col.innerHTML = "");

  tasks.forEach(task => {
    counts[task.status]++;
    const card = document.createElement("div");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.id = task.id;
    card.innerHTML = `
      <div class="task-title">${escapeHtml(task.title)}</div>
      <button class="task-delete" title="Eliminar">✕</button>
    `;

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", task.id);
    });

    card.querySelector(".task-delete").onclick = (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    };

    if (columns[task.status]) {
      columns[task.status].appendChild(card);
    }
  });

  document.getElementById("count-todo").textContent = counts.todo;
  document.getElementById("count-inprogress").textContent = counts.inprogress;
  document.getElementById("count-done").textContent = counts.done;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function allowDrop(e) {
  e.preventDefault();
}

function drop(e, newStatus) {
  e.preventDefault();
  const taskId = e.dataTransfer.getData("text/plain");
  const task = tasks.find(t => t.id === taskId);
  if (task && task.status !== newStatus) {
    task.status = newStatus;
    saveTasks();
    renderTasks();
  }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}

function addTask() {
  const titleInput = document.getElementById("task-title");
  const statusSelect = document.getElementById("task-column");
  const title = titleInput.value.trim();

  if (!title) return;

  const newTask = {
    id: Date.now().toString(),
    title: title,
    status: statusSelect.value
  };

  tasks.push(newTask);
  saveTasks();
  renderTasks();

  titleInput.value = "";
  os.notify("Tarefa criada com sucesso.");
}

document.getElementById("add-btn").onclick = addTask;
document.getElementById("task-title").onkeypress = (e) => {
  if (e.key === "Enter") addTask();
};

(async () => {
  await loadTasks();
})();