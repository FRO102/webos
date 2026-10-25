(function () {
  'use strict';

  let currentPath = null;
  let currentZoom = 100;
  let pdfIframe = null;
  let currentObjectUrl = null; // Para libertar memória

  const els = {};
  const RECENT_KEY = 'recent_pdfs';
  const formatDate = value => window.os?.i18n?.date ? os.i18n.date(value, { dateStyle: 'short' }) : new Date(value).toLocaleDateString('pt-PT');

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    bindEvents();
    setupDragAndDrop();
    await loadRecentFiles();
    
    // Abrir via Explorer (os.args)
    if (window.os && typeof os.args === 'function') {
      try {
        const args = await os.args();
        if (args && args.path) {
          await loadPdfFromPath(args.path);
        }
      } catch (e) { /* noop */ }
    }
  }

  function cacheElements() {
    els.sidebar = document.getElementById('sidebar');
    els.container = document.getElementById('viewer-container');
    els.docName = document.getElementById('doc-name');
    
    els.btnOpen = document.getElementById('btn-open');
    els.btnImportPc = document.getElementById('btn-import-pc');
    els.pcFileInput = document.getElementById('pc-file-input');
    
    els.btnZoomIn = document.getElementById('btn-zoom-in');
    els.btnZoomOut = document.getElementById('btn-zoom-out');
    els.btnPrint = document.getElementById('btn-print');
    els.btnFullscreen = document.getElementById('btn-fullscreen');
    els.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    els.zoomLabel = document.getElementById('zoom-level');
    
    els.infoName = document.getElementById('info-name');
    els.infoSize = document.getElementById('info-size');
    els.infoDate = document.getElementById('info-date');
    els.recentList = document.getElementById('recent-list');
  }

  function bindEvents() {
    els.btnOpen.addEventListener('click', openDialog);
    els.btnImportPc.addEventListener('click', () => els.pcFileInput.click());
    els.pcFileInput.addEventListener('change', handlePcImport);
    
    els.btnZoomIn.addEventListener('click', () => setZoom(currentZoom + 25));
    els.btnZoomOut.addEventListener('click', () => setZoom(currentZoom - 25));
    els.btnToggleSidebar.addEventListener('click', () => els.sidebar.classList.toggle('collapsed'));
    
    els.btnFullscreen.addEventListener('click', async () => {
      if (window.os && os.shell && os.shell.toggleFullscreen) {
        try { await os.shell.toggleFullscreen(); } 
        catch (e) { os.notify('Ecrã inteiro não suportado.'); }
      }
    });

    els.btnPrint.addEventListener('click', () => {
      if (pdfIframe) {
        try { pdfIframe.contentWindow.print(); } 
        catch (e) { window.print(); } 
      }
    });

    // Atalhos de Teclado
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'o') { e.preventDefault(); openDialog(); }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(currentZoom + 25); }
        if (e.key === '-') { e.preventDefault(); setZoom(currentZoom - 25); }
      }
      if (e.key === 'f' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        els.btnFullscreen.click();
      }
    });
  }

  // ------------------------------------------------------------- Importar do PC (Local)

  async function handlePcImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      os.notify('Por favor, selecione um ficheiro PDF.');
      return;
    }

    // 1. Limpar o input para permitir selecionar o mesmo ficheiro novamente
    els.pcFileInput.value = '';

    // 2. Renderizar localmente
    renderLocalFile(file);
    
    // 3. Atualizar UI
    currentPath = null; // Não está no WebOS ainda
    els.docName.textContent = file.name + ' (Local)';
    els.infoName.textContent = file.name;
    els.infoSize.textContent = formatBytes(file.size);
    els.infoDate.textContent = formatDate(file.lastModified);
    
    if (os.window && os.window.setTitle) {
      os.window.setTitle('PDFWebos - ' + file.name);
    }
    
    enableControls(true);
    setZoom(100);

    // 4. Perguntar se quer guardar no WebOS
    if (window.os && os.dialog && os.fs) {
      try {
        const confirmSave = await os.dialog.confirm({
          title: 'Guardar no WebOS',
          message: 'Deseja guardar este PDF na sua pasta de Documentos para o abrir mais tarde?',
          okLabel: 'Guardar',
          danger: false
        });

        if (confirmSave) {
          await saveToWebos(file);
        }
      } catch (err) { /* cancelado */ }
    }
  }

  function renderLocalFile(file) {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(file);
    
    els.container.querySelectorAll('.pdf-viewer, .fallback-msg').forEach(el => el.remove());
    els.container.classList.add('has-document');

    pdfIframe = document.createElement('iframe');
    pdfIframe.className = 'pdf-viewer';
    pdfIframe.src = currentObjectUrl;
    els.container.appendChild(pdfIframe);
  }

  async function saveToWebos(file) {
    try {
      let path = await os.dialog.save({
        title: 'Guardar PDF no WebOS',
        start: '/home/user/Documentos/',
        defaultName: file.name
      });
      
      if (!path) return;
      if (!path.toLowerCase().endsWith('.pdf')) path += '.pdf';

      // Escrever o Blob diretamente no sistema de ficheiros virtual
      await os.fs.write(path, file, 'application/pdf');
      
      os.notify('PDF guardado no WebOS.');
      els.docName.textContent = path.split('/').pop();
      currentPath = path;
      addToRecent(path);
      
      // Atualizar metadados com os dados do WebOS
      try {
        const stat = await os.fs.stat(path);
        if (stat) {
          els.infoSize.textContent = formatBytes(stat.size);
          els.infoDate.textContent = formatDate(stat.mtime);
        }
      } catch(e) {}
      
    } catch (err) {
      console.error(err);
      os.notify('Erro ao guardar o ficheiro no WebOS.');
    }
  }

  // ------------------------------------------------------------- Abrir Ficheiros (WebOS)

  async function openDialog() {
    if (!window.os || !os.dialog) return;
    try {
      const path = await os.dialog.open({
        title: 'Abrir PDF do WebOS',
        start: '/home/user/Documentos/',
        filter: ['.pdf']
      });
      if (path) await loadPdfFromPath(path);
    } catch (err) {
      os.notify('Erro ao abrir o diálogo.');
    }
  }

  async function loadPdfFromPath(path) {
    if (!window.os || !os.fs) return;
    try {
      const content = await os.fs.read(path);
      
      let stat = null;
      if (os.fs.stat) {
        try { stat = await os.fs.stat(path); } catch(e) {}
      }

      await renderPdf(content, path, stat);
      
      currentPath = path;
      const name = path.split('/').pop();
      els.docName.textContent = name;
      
      if (os.window && os.window.setTitle) {
        os.window.setTitle('PDFWebos - ' + name);
      }
      
      enableControls(true);
      setZoom(100);
      addToRecent(path);
      
    } catch (err) {
      os.notify('Erro ao ler o ficheiro PDF.');
    }
  }

  async function renderPdf(content, path, stat) {
    els.container.querySelectorAll('.pdf-viewer, .fallback-msg').forEach(el => el.remove());
    els.container.classList.add('has-document');

    els.infoName.textContent = path.split('/').pop();
    els.infoSize.textContent = stat && stat.size ? formatBytes(stat.size) : '—';
    els.infoDate.textContent = stat && stat.mtime ? formatDate(stat.mtime) : '—';

    let url = '';
    if (content instanceof Blob) {
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = URL.createObjectURL(content);
      url = currentObjectUrl;
    } else if (typeof content === 'string') {
      if (content.startsWith('data:')) url = content;
      else url = 'data:application/pdf;base64,' + content;
    }

    if (!url) return;

    pdfIframe = document.createElement('iframe');
    pdfIframe.className = 'pdf-viewer';
    pdfIframe.src = url;
    els.container.appendChild(pdfIframe);
  }

  function enableControls(enabled) {
    els.btnZoomIn.disabled = !enabled;
    els.btnZoomOut.disabled = !enabled;
    els.btnPrint.disabled = !enabled;
    els.btnFullscreen.disabled = !enabled;
  }

  // ------------------------------------------------------------- Zoom

  function setZoom(level) {
    currentZoom = Math.max(50, Math.min(300, level));
    els.zoomLabel.textContent = currentZoom + '%';
    
    if (pdfIframe) {
      pdfIframe.style.transform = `scale(${currentZoom / 100})`;
      pdfIframe.style.transformOrigin = 'top center';
      pdfIframe.style.width = (100 / (currentZoom / 100)) + '%';
      pdfIframe.style.height = (100 / (currentZoom / 100)) + '%';
    }
  }

  // ------------------------------------------------------------- Recentes

  async function loadRecentFiles() {
    try {
      const recent = await os.storage.get(RECENT_KEY) || [];
      els.recentList.innerHTML = '';
      
      if (recent.length === 0) {
        els.recentList.innerHTML = '<li class="empty-recent">Nenhum documento aberto.</li>';
        return;
      }

      recent.forEach(path => {
        const li = document.createElement('li');
        li.textContent = path.split('/').pop();
        li.title = path;
        li.addEventListener('click', () => loadPdfFromPath(path));
        els.recentList.appendChild(li);
      });
    } catch (e) { /* noop */ }
  }

  async function addToRecent(path) {
    try {
      let recent = await os.storage.get(RECENT_KEY) || [];
      recent = recent.filter(p => p !== path);
      recent.unshift(path);
      recent = recent.slice(0, 5);
      await os.storage.set(RECENT_KEY, recent);
      await loadRecentFiles();
    } catch (e) { /* noop */ }
  }

  // ------------------------------------------------------------- Drag & Drop (Entre abas/janelas do browser)

  function setupDragAndDrop() {
    els.container.addEventListener('dragover', e => {
      e.preventDefault();
      els.container.classList.add('dragover');
    });

    els.container.addEventListener('dragleave', e => {
      if (e.target === els.container) els.container.classList.remove('dragover');
    });

    els.container.addEventListener('drop', e => {
      e.preventDefault();
      els.container.classList.remove('dragover');

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const file = files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        os.notify('Por favor, arraste apenas ficheiros PDF.');
        return;
      }
      
      // Reutiliza a lógica de importação do PC
      renderLocalFile(file);
      els.docName.textContent = file.name + ' (Arrastado)';
      enableControls(true);
      setZoom(100);
    });
  }

  // ------------------------------------------------------------- Helpers

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

})();