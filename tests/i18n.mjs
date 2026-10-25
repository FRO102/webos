import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { localeFor, translate } from '../system/js/i18n.js';

assert.equal(localeFor('pt-PT'), 'pt-PT');
assert.equal(localeFor('en'), 'en-GB');
assert.equal(translate('Definições', 'en'), 'Settings');
assert.equal(translate('Definições', 'pt-PT'), 'Definições');
assert.equal(translate('5 itens', 'en'), '5 items');
assert.equal(translate('2 formas', 'en'), '2 shapes');
assert.equal(translate('Cor #3cb6a4', 'en'), 'Color #3cb6a4');
assert.equal(translate('Texto de utilizador', 'en'), 'Texto de utilizador');
assert.equal(translate('Céu limpo', 'en'), 'Clear sky');
assert.equal(translate('Chuva moderada', 'en'), 'Moderate rain');
assert.equal(translate('Feed de Notícias', 'en'), 'News Feed');
assert.equal(translate('há 3h', 'en'), '3h ago');
assert.equal(translate('Área', 'en'), 'Area');
assert.equal(translate('Área de trabalho', 'en'), 'Workspace');
assert.equal(translate('Página inicial', 'en'), 'Home');
assert.equal(translate('Português (Portugal)', 'en'), 'Portuguese (Portugal)');
const ptParts = new Intl.NumberFormat(localeFor('pt-PT')).formatToParts(1234567.5);
const enParts = new Intl.NumberFormat(localeFor('en')).formatToParts(1234567.5);
assert.equal(ptParts.find(part => part.type === 'decimal').value, ',');
assert.equal(enParts.find(part => part.type === 'decimal').value, '.');
assert.ok(ptParts.some(part => part.type === 'group'), 'Portuguese formatting groups large numbers');
assert.ok(enParts.some(part => part.type === 'group'), 'English formatting groups large numbers');

for (const [path, expected] of [
	['apps/conversor/app.js', 'os.i18n.locale'],
	['apps/terminal/app.js', 'os.i18n.date'],
	['apps/backup-restauro/app.js', 'os.i18n.date'],
	['apps/meteo/app.js', 'os.i18n.locale'],
	['apps/media-player/app.js', 'os.i18n.locale'],
]) {
	assert.ok((await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).includes(expected), `${path} must use the active locale`);
}

const appDirectories = await readdir(new URL('../apps/', import.meta.url), { withFileTypes: true });
for (const directory of appDirectories.filter(entry => entry.isDirectory())) {
	let html;
	try { html = await readFile(new URL(`../apps/${directory.name}/index.html`, import.meta.url), 'utf8'); }
	catch { continue; }
	const language = html.match(/<html\s+[^>]*lang=["']([^"']+)["']/i)?.[1];
	assert.ok(['pt-PT', 'en'].includes(language), `${directory.name}/index.html declares a supported base language`);
}
console.log('Localization tests: OK');