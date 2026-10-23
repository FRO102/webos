import assert from 'node:assert/strict';
import { localeFor, translate } from '../system/js/i18n.js';

assert.equal(localeFor('pt-PT'), 'pt-PT');
assert.equal(localeFor('en'), 'en-GB');
assert.equal(translate('Definições', 'en'), 'Settings');
assert.equal(translate('Definições', 'pt-PT'), 'Definições');
assert.equal(translate('5 itens', 'en'), '5 items');
assert.equal(translate('2 formas', 'en'), '2 shapes');
assert.equal(translate('Cor #3cb6a4', 'en'), 'Color #3cb6a4');
assert.equal(translate('Texto de utilizador', 'en'), 'Texto de utilizador');
console.log('Localization tests: OK');