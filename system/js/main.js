import { bus } from './event-bus.js';
import { loadRegistry } from './app-loader.js';
import { initDesktop } from './desktop.js';
import { initTaskbar } from './taskbar.js';
import { initStartMenu } from './start-menu.js';
import { initFS } from './filesystem.js';
import { initSettings } from './settings.js';
import { initNotifications } from './notifications.js';
import { initSwitcher } from './switcher.js';
import { runBoot } from './boot.js';
import { logger } from './logger.js';
import { initUsers } from './users.js';
import { initLocalization } from './i18n.js';

async function init() {
  logger.info('Inicialização do WebOS iniciada');
  await initFS();
  await initUsers();
  await initSettings();
  initLocalization();
  await initNotifications();
  const apps = await loadRegistry();
  initTaskbar();
  initDesktop(apps);
  initStartMenu(apps);
  initSwitcher();
  bus.on('window:focused', () => bus.emit('menus:close')); // inclui cliques dentro de apps (iframes)
  logger.info('WebOS pronto', { apps: apps.length });
}

await runBoot(init()); // o ecrã de arranque corre em paralelo com a inicialização
