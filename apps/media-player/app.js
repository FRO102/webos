const file = document.getElementById('file');
const player = document.getElementById('player');
const name = document.getElementById('name');
file.onchange = () => { const selected = file.files?.[0]; if (!selected) return; name.textContent = selected.name; player.src = URL.createObjectURL(selected); player.play().catch(() => {}); };
