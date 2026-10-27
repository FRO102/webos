const thumb = document.getElementById("thumbnail");
if (thumb) {
  setTimeout(() => {
    try { thumb.remove(); } catch (e) {}
  }, 3000);
}

// Fullscreen via the WebOS SDK, only as a direct user action.
document.addEventListener("keydown", (event) => {
  if (!event || (event.key !== "f" && event.key !== "F")) return;
  const os = window.os;
  if (os && os.shell && typeof os.shell.toggleFullscreen === "function") {
    os.shell.toggleFullscreen().catch(() => {});
  }
});

// Translate fullscreen basic page
if (window.os && window.os.i18n) {
  try { window.os.i18n.apply(); } catch (e) {}
}
