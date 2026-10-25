let currentTab = 'feed'; // feed, saved, history
let currentSource = 'hn'; // hn, devto
let currentSort = 'score'; // score, date
let searchQuery = '';
let currentTag = '';
let allStories = [];
let savedStories = [];
let readIds = [];
let rssFeeds = [];
let displayLimit = 15;
let hasMoreStories = true;
let fetchSequence = 0;
let userSettings = { textSize: '0.95rem', notifications: true };
const DEFAULT_RSS_FEEDS = [
  { id: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', title: 'NYT: World' },
  { id: 'https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml', title: 'NYT: Europe' },
  { id: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', title: 'NYT: Technology' },
  { id: 'https://rss.nytimes.com/services/xml/rss/nyt/PersonalTech.xml', url: 'https://rss.nytimes.com/services/xml/rss/nyt/PersonalTech.xml', title: 'NYT: Personal Tech' }
];

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} ao consultar notícias`);
  return response.json();
}

const NewsFetchers = {
  hn: async (limit) => {
    const ids = await fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json");
    const batchIds = ids.slice(0, limit + 10);
    const promises = batchIds.map(id => 
      fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)
    );
    return (await Promise.all(promises)).filter(item => item && item.title).map(item => ({
      id: item.id,
      title: item.title,
      url: item.url,
      score: item.score || 0,
      time: item.time,
      by: item.by,
      domain: item.url ? new URL(item.url).hostname : 'hacker-news.firebaseio.com',
      kids: item.kids || []
    }));
  },
  devto: async (limit, tag = '') => {
    const url = `https://dev.to/api/articles?per_page=${limit}${tag ? `&tag=${tag}` : ''}`;
    const data = await fetchJson(url);
    if (!Array.isArray(data)) throw new Error('Resposta inválida do Dev.to');
    return data.map(item => ({
      id: item.id,
      title: item.title,
      url: item.url,
      score: item.positive_reactions_count || 0,
      time: new Date(item.published_at).getTime() / 1000,
      by: item.user?.name || 'Anónimo',
      domain: 'dev.to',
      tags: item.tags,
      kids: []
    }));
  }
};

function xmlChildText(parent, localName) {
  const element = Array.from(parent.children).find(child => child.localName === localName);
  return element?.textContent?.trim() || '';
}

function parseRssFeed(xmlText, feedUrl) {
  const documentXml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (documentXml.querySelector('parsererror')) throw new Error('O ficheiro recebido não é XML válido.');

  const feedUrlObject = new URL(feedUrl);
  const items = Array.from(documentXml.getElementsByTagName('*'))
    .filter(element => element.localName === 'item' || element.localName === 'entry');
  if (!items.length) throw new Error('O feed não contém artigos RSS ou Atom.');

  return items.slice(0, 100).map((item, index) => {
    const isAtom = item.localName === 'entry';
    const linkElement = Array.from(item.children).find(child =>
      child.localName === 'link' && (!child.getAttribute('rel') || child.getAttribute('rel') === 'alternate')
    );
    const rawLink = isAtom ? linkElement?.getAttribute('href') : xmlChildText(item, 'link');
    let articleUrl = feedUrl;
    try {
      articleUrl = new URL(rawLink || xmlChildText(item, isAtom ? 'id' : 'guid') || feedUrl, feedUrl).href;
    } catch { /* Keep the feed URL when an article link is malformed. */ }

    const author = xmlChildText(item, isAtom ? 'name' : 'author')
      || xmlChildText(item, 'creator')
      || xmlChildText(item, 'author');
    const dateValue = xmlChildText(item, isAtom ? 'updated' : 'pubDate')
      || xmlChildText(item, 'published')
      || xmlChildText(item, 'date');
    const parsedDate = Date.parse(dateValue);
    const title = xmlChildText(item, 'title');
    const stableId = xmlChildText(item, isAtom ? 'id' : 'guid') || articleUrl || `${feedUrl}:${index}`;

    return {
      id: `rss:${feedUrl}:${stableId}`,
      title: title || 'Artigo sem título',
      url: articleUrl,
      score: 0,
      time: Number.isFinite(parsedDate) ? parsedDate / 1000 : 0,
      by: author,
      domain: new URL(articleUrl).hostname.replace(/^www\./, ''),
      kids: []
    };
  });
}

async function fetchRssFeed(feed) {
  const response = await fetch(feed.url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
  if (!response.ok) throw new Error(`O servidor do feed respondeu com HTTP ${response.status}.`);
  return parseRssFeed(await response.text(), feed.url);
}

function updateSourceOptions() {
  const select = document.getElementById('source-select');
  select.querySelectorAll('option[data-rss-id]').forEach(option => option.remove());
  rssFeeds.forEach(feed => {
    const option = document.createElement('option');
    option.value = `rss:${feed.id}`;
    option.dataset.rssId = feed.id;
    option.textContent = feed.title || new URL(feed.url).hostname;
    select.appendChild(option);
  });
  select.value = currentSource;
  document.getElementById('remove-rss-btn').style.display = currentSource.startsWith('rss:') ? 'inline-block' : 'none';
}

async function loadPreferences() {
  try {
    const saved = await os.storage.get('news_settings');
    if (saved) userSettings = saved;
    applySettings();

    const sFavs = await os.storage.get('saved_stories');
    if (sFavs && Array.isArray(sFavs)) savedStories = sFavs;

    const sReads = await os.storage.get('read_stories');
    if (sReads && Array.isArray(sReads)) readIds = sReads;

    const sRssFeeds = await os.storage.get('news_rss_feeds');
    if (Array.isArray(sRssFeeds)) rssFeeds = sRssFeeds.filter(feed => feed && typeof feed.url === 'string' && typeof feed.id === 'string');

    const defaultsSeeded = await os.storage.get('news_rss_defaults_seeded');
    if (!defaultsSeeded) {
      const existingUrls = new Set(rssFeeds.map(feed => feed.url));
      rssFeeds.push(...DEFAULT_RSS_FEEDS.filter(feed => !existingUrls.has(feed.url)));
      await savePreferences();
      await os.storage.set('news_rss_defaults_seeded', true);
    }
  } catch (e) { console.error(e); }
  updateSourceOptions();
}

async function savePreferences() {
  try {
    await os.storage.set('news_settings', userSettings);
    await os.storage.set('saved_stories', savedStories);
    await os.storage.set('read_stories', readIds);
    await os.storage.set('news_rss_feeds', rssFeeds);
  } catch (e) { console.error(e); }
}

function applySettings() {
  document.documentElement.style.setProperty('--text-size', userSettings.textSize);
}

async function fetchStories() {
  const requestId = ++fetchSequence;
  const container = document.getElementById("news-container");
  if (currentTab === 'saved') {
    renderStories(savedStories);
    document.getElementById('load-more-container').style.display = 'none';
    return;
  }
  if (currentTab === 'history') {
    const historyStories = allStories.filter(s => readIds.includes(s.id));
    renderStories(historyStories);
    document.getElementById('load-more-container').style.display = 'none';
    return;
  }

  container.innerHTML = `<p style="color: var(--os-muted); text-align: center; margin-top: 20px;">A carregar notícias...</p>`;
  document.getElementById('load-more-container').style.display = 'none';

  try {
    os.ui.status(null, "A carregar notícias...", "loading");
    
    const selectedFeed = currentSource.startsWith('rss:')
      ? rssFeeds.find(feed => `rss:${feed.id}` === currentSource)
      : null;
    const fetcher = NewsFetchers[currentSource];
    if (!selectedFeed && !fetcher) throw new Error("Fonte não suportada");

    const stories = selectedFeed
      ? await fetchRssFeed(selectedFeed)
      : await fetcher(displayLimit, currentTag);
    if (requestId !== fetchSequence) return;

    allStories = stories;
    hasMoreStories = currentSource === 'hn' || (currentSource === 'devto' && stories.length >= displayLimit && displayLimit < 100);

    sortAndRender();
    updateTagBar();
    os.ui.status(null, "", "success");
  } catch (error) {
    if (requestId !== fetchSequence) return;
    console.error(error);
    const errorMessage = error instanceof TypeError
      ? 'O browser bloqueou este feed (CORS) ou não foi possível ligar ao servidor.'
      : error.message || 'Falha ao carregar o feed.';
    os.notify(errorMessage);
    container.innerHTML = `<p style="color: #ff5555; text-align: center; margin-top: 20px;">${escapeHtml(errorMessage)}</p>`;
    os.ui.status(null, "", "error");
  }
}

function sortAndRender() {
  let list = currentTab === 'saved'
    ? [...savedStories]
    : currentTab === 'history'
      ? allStories.filter(story => readIds.includes(story.id))
      : [...allStories];
  
  if (currentSort === 'score') {
    list.sort((a, b) => (b.score || 0) - (a.score || 0));
  } else if (currentSort === 'date') {
    list.sort((a, b) => (b.time || 0) - (a.time || 0));
  }

  renderStories(list);
  
  const canLoadMore = currentTab === 'feed' && currentSource === 'hn'
    || currentTab === 'feed' && currentSource === 'devto' && hasMoreStories;
  document.getElementById('load-more-container').style.display = canLoadMore ? 'block' : 'none';
}

function renderStories(stories) {
  const container = document.getElementById("news-container");
  container.innerHTML = "";

  const filtered = stories.filter(story => 
    story.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    container.innerHTML = `<p style="color: var(--os-muted); text-align: center; margin-top: 20px;">Nenhuma notícia encontrada.</p>`;
    return;
  }

  filtered.forEach(story => {
    const card = document.createElement("div");
    const isRead = readIds.includes(story.id);
    card.className = `news-card ${isRead ? 'read' : ''}`;
    
    const timeAgo = Math.floor((Date.now() / 1000 - (story.time || Date.now()/1000)) / 3600);
    let domain = story.domain || 'news.ycombinator.com';
    if (story.url && !story.domain) {
      try { domain = new URL(story.url).hostname.replace('www.', ''); } catch(e){}
    }

    const isSaved = savedStories.some(s => s.id === story.id);

    card.innerHTML = `
      <div class="news-title">${escapeHtml(story.title)}</div>
      <div class="news-meta">
        <span>${escapeHtml(domain)} • ${story.by ? 'por ' + escapeHtml(story.by) + ' • ' : ''} 👍 ${story.score || 0} • há ${timeAgo < 0 ? 0 : timeAgo}h</span>
        <div class="card-actions">
          ${story.kids && story.kids.length > 0 ? `<button class="action-icon-btn comment-btn" title="Ver Comentários">💬 ${story.kids.length}</button>` : ''}
          <button class="action-icon-btn share-btn" title="Copiar Link">🔗</button>
          <button class="action-icon-btn save-btn ${isSaved ? 'saved' : ''}" title="${isSaved ? 'Remover dos favoritos' : 'Guardar'}">${isSaved ? '★' : '☆'}</button>
        </div>
      </div>
    `;

    // Abrir Artigo
    card.querySelector(".news-title").onclick = async () => {
      markAsRead(story.id);
      const targetUrl = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
      try {
        await os.external.open(targetUrl);
      } catch (e) {
        os.notify("Não foi possível abrir o link externo.");
      }
    };

    // Guardar Favorito
    card.querySelector(".save-btn").onclick = (e) => {
      e.stopPropagation();
      toggleSave(story);
    };

    // Copiar Link (Clipboard API)
    card.querySelector(".share-btn").onclick = async (e) => {
      e.stopPropagation();
      const targetUrl = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
      try {
        await os.clipboard.write(targetUrl);
        os.notify("Link copiado para a área de transferência!");
      } catch (err) {
        os.notify("Erro ao copiar link.");
      }
    };

    // Ver Comentários
    const commentBtn = card.querySelector(".comment-btn");
    if (commentBtn) {
      commentBtn.onclick = (e) => {
        e.stopPropagation();
        openCommentsModal(story);
      };
    }

    container.appendChild(card);
  });
}

function updateTagBar() {
  const tagBar = document.getElementById('tag-bar');
  if (currentSource !== 'devto') {
    tagBar.style.display = 'none';
    return;
  }

  tagBar.style.display = 'flex';
  const tags = ['javascript', 'webdev', 'python', 'rust', 'ai', 'productivity'];
  tagBar.innerHTML = `<button class="tag-btn ${currentTag === '' ? 'active' : ''}" data-tag="">Tudo</button>`;
  tags.forEach(tag => {
    tagBar.innerHTML += `<button class="tag-btn ${currentTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</button>`;
  });

  tagBar.querySelectorAll('.tag-btn').forEach(btn => {
    btn.onclick = () => {
      currentTag = btn.dataset.tag;
      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      fetchStories();
    };
  });
}

function markAsRead(id) {
  if (!readIds.includes(id)) {
    readIds.push(id);
    savePreferences();
  }
}

function toggleSave(story) {
  const index = savedStories.findIndex(s => s.id === story.id);
  if (index >= 0) {
    savedStories.splice(index, 1);
    os.notify("Removido dos favoritos.");
  } else {
    savedStories.push(story);
    os.notify("Adicionado aos favoritos.");
  }
  savePreferences();
  sortAndRender();
}

async function openCommentsModal(story) {
  const modal = document.getElementById("modal-overlay");
  const titleEl = document.getElementById("modal-title");
  const bodyEl = document.getElementById("modal-body");

  titleEl.textContent = `${os.i18n.t('Comentários:')} ${story.title}`;
  bodyEl.innerHTML = `<p style="color: var(--os-muted);">A carregar comentários...</p>`;
  modal.style.display = 'flex';

  try {
    const commentIds = (story.kids || []).slice(0, 10);
    if (commentIds.length === 0) {
      bodyEl.innerHTML = `<p style="color: var(--os-muted);">Sem comentários disponíveis.</p>`;
      return;
    }

    const promises = commentIds.map(id =>
      fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)
    );
    const comments = (await Promise.all(promises)).filter(c => c && c.text);

    if (comments.length === 0) {
      bodyEl.innerHTML = `<p style="color: var(--os-muted);">Nenhum comentário textual encontrado.</p>`;
      return;
    }

    bodyEl.innerHTML = "";
    comments.forEach(c => {
      const div = document.createElement("div");
      div.className = "comment-item";
      div.innerHTML = `
        <div class="comment-author">${escapeHtml(c.by || 'Anónimo')}</div>
        <div>${escapeHtml(c.text)}</div>
      `;
      bodyEl.appendChild(div);
    });
  } catch (err) {
    bodyEl.innerHTML = `<p style="color: #ff5555;">Erro ao carregar comentários.</p>`;
  }
}

function openSettingsModal() {
  const modal = document.getElementById("modal-overlay");
  const titleEl = document.getElementById("modal-title");
  const bodyEl = document.getElementById("modal-body");

  titleEl.textContent = "Definições de Leitura";
  bodyEl.innerHTML = `
    <label style="display:flex; flex-direction:column; gap:6px;">
      Tamanho do Texto:
      <select id="setting-text-size" style="padding:6px; background:var(--os-field); color:var(--os-fg); border:1px solid var(--os-border); border-radius:4px;">
        <option value="0.85rem" ${userSettings.textSize === '0.85rem' ? 'selected' : ''}>Pequeno</option>
        <option value="0.95rem" ${userSettings.textSize === '0.95rem' ? 'selected' : ''}>Normal</option>
        <option value="1.1rem" ${userSettings.textSize === '1.1rem' ? 'selected' : ''}>Grande</option>
      </select>
    </label>
    <label style="display:flex; align-items:center; gap:10px; margin-top:15px; cursor:pointer;">
      <input type="checkbox" id="setting-notifications" ${userSettings.notifications ? 'checked' : ''}>
      <span>Ativar Notificações de Notícias Virais</span>
    </label>
    <button id="save-settings-btn" style="margin-top:20px; padding:8px; background:var(--os-btn); border:1px solid var(--os-border); color:var(--os-fg); border-radius:4px; cursor:pointer;">Guardar Preferências</button>
  `;
  modal.style.display = 'flex';

  document.getElementById("save-settings-btn").onclick = () => {
    userSettings.textSize = document.getElementById("setting-text-size").value;
    userSettings.notifications = document.getElementById("setting-notifications").checked;
    applySettings();
    savePreferences();
    modal.style.display = 'none';
    os.notify("Preferências guardadas.");
  };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Event Listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentTab = e.target.dataset.tab;
    fetchStories();
  };
});

document.getElementById("source-select").onchange = (e) => {
  currentSource = e.target.value;
  displayLimit = 15;
  updateSourceOptions();
  fetchStories();
};

document.getElementById('rss-feed-form').onsubmit = async (event) => {
  event.preventDefault();
  const input = document.getElementById('rss-feed-url');
  let feedUrl;
  try {
    feedUrl = new URL(input.value.trim());
    if (!['http:', 'https:'].includes(feedUrl.protocol)) throw new Error('URL inválida');
  } catch {
    os.notify('Introduz um endereço RSS ou Atom válido (HTTP ou HTTPS).');
    return;
  }

  const normalizedUrl = feedUrl.href;
  const existingFeed = rssFeeds.find(feed => feed.url === normalizedUrl);
  if (existingFeed) {
    currentSource = `rss:${existingFeed.id}`;
  } else {
    const feed = { id: normalizedUrl, url: normalizedUrl, title: feedUrl.hostname };
    rssFeeds.push(feed);
    currentSource = `rss:${feed.id}`;
    await savePreferences();
  }
  input.value = '';
  updateSourceOptions();
  fetchStories();
};

document.getElementById('remove-rss-btn').onclick = async () => {
  if (!currentSource.startsWith('rss:')) return;
  rssFeeds = rssFeeds.filter(feed => `rss:${feed.id}` !== currentSource);
  currentSource = 'hn';
  await savePreferences();
  updateSourceOptions();
  fetchStories();
};

document.getElementById("sort-select").onchange = (e) => {
  currentSort = e.target.value;
  sortAndRender();
};

document.getElementById("refresh-btn").onclick = fetchStories;
document.getElementById("settings-btn").onclick = openSettingsModal;

document.getElementById("load-more-btn").onclick = () => {
  displayLimit = currentSource === 'devto'
    ? Math.min(displayLimit + 15, 100)
    : displayLimit + 15;
  fetchStories();
};

document.getElementById("search-input").oninput = (e) => {
  searchQuery = e.target.value.trim();
  sortAndRender();
};

document.getElementById("modal-close").onclick = () => {
  document.getElementById("modal-overlay").style.display = 'none';
};

window.onclick = (e) => {
  const modal = document.getElementById("modal-overlay");
  if (e.target === modal) modal.style.display = 'none';

};

function checkViralNews() {
  if (!userSettings.notifications) return;
  
  // Verifica HN por padrão para notificações virais
  NewsFetchers.hn(10).then(stories => {
    const viral = stories.find(s => s.score > 500);
    if (viral) {
      os.notify(`🔥 Notícia Viral: ${viral.title}`);
    }
  }).catch(() => {});
}

// Inicia a verificação de notícias virais a cada 30 minutos
setInterval(checkViralNews, 30 * 60 * 1000);

(async () => {
  await loadPreferences();
  fetchStories();
})();