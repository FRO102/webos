# WebOS: Guia para agentes de desenvolvimento

## Objetivo

O WebOS é um simulador de sistema operativo executado no navegador. Todo o projeto deve ser feito apenas com HTML, CSS e JavaScript, sem frameworks obrigatórios e sem backend necessário em runtime.

O sistema fornece um desktop, janelas, barra de tarefas, áreas de trabalho virtuais, menu Iniciar, filesystem virtual, notificações, sessões de utilizador e um SDK para aplicações isoladas.

## Regra principal

Uma aplicação é uma pasta autónoma dentro de `apps/`. O código, estilos, manifest, ícone, imagens, sons e outros assets próprios devem ficar dentro dessa pasta.

Estrutura recomendada:

```text
apps/to-do/
  manifest.json
  index.html
  app.js
  style.css
  icon.svg
  assets/
```

A app não deve exigir alterações ao shell, ao `main.js` ou ao gestor de janelas.

## Como uma aplicação é descoberta

O carregador está em `system/js/app-loader.js`.

1. Primeiro tenta ler `apps/registry.json`.
2. Se o registry existir, usa a lista explícita de IDs da app.
3. Se não existir, tenta obter a listagem HTTP de `apps/` em ambiente local.
4. Extrai nomes de pastas válidos, no formato `a-z`, `0-9` e hífen.
5. Carrega `apps/<id>/manifest.json` para cada pasta.
6. Manifests inválidos são ignorados e registados na consola.
7. As apps válidas aparecem no Menu Iniciar, na Loja e podem ser abertas pelo shell.

Este fallback é essencial para Cloudflare Pages, porque esse hosting não expõe listagem de diretórios de forma confiável. Em desenvolvimento local, ainda se pode usar um servidor que exponha `apps/` para descoberta automática.

## Manifest obrigatório

Exemplo mínimo:

```json
{
  "id": "to-do",
  "name": "To-Do List",
  "version": "1.0.0",
  "icon": "icon.svg",
  "entry": "index.html",
  "window": {
    "width": 520,
    "height": 420,
    "minWidth": 360,
    "minHeight": 260
  },
  "singleInstance": true,
  "permissions": [],
  "fileTypes": [".txt", ".md"]
}
```

Regras:

- `id` deve ser igual ao nome da pasta.
- `id` deve usar apenas letras minúsculas, números e hífen (`^[a-z0-9][a-z0-9-]*$`).
- `name`, `version`, `icon` e `entry` são obrigatórios.
- `icon` e `entry` são relativos à pasta da app.
- `permissions` é obrigatório e deve ser sempre um array, mesmo quando vazio.
- `window` é opcional; sem ele o shell usa `width: 480`, `height: 320`, `minWidth: 240` e `minHeight: 140` pixels.
- `singleInstance` é opcional, booleano e por defeito é `false`; quando `true`, abrir novamente foca a janela existente.
- `fileTypes` é opcional e, quando presente, é um array de extensões com ponto e em minúsculas, como `[".txt", ".md"]`. A comparação ignora maiúsculas e minúsculas. O runtime escolhe por extensão, não por MIME.
- Em produção no Cloudflare Pages, cada app nova também deve ser adicionada ao array de [`apps/registry.json`](apps/registry.json); sem esse registo, a app não é carregada.
- `version` é uma string livre no runtime atual; usar Semantic Versioning (`MAJOR.MINOR.PATCH`) por convenção.
- `icon` deve apontar para um SVG local. SVG é o formato recomendado pelo projeto.
- A permissão tem de estar na lista suportada pelo shell.
- Os scripts da app são scripts clássicos, não módulos ES.

O manifest de cada pasta é a fonte de verdade da app. Não existe catálogo separado para manter.

Permissões suportadas atualmente:

- `fs.read`
- `fs.write`
- `apps.launch`
- `settings.write`
- `notifications`
- `clipboard`
- `external.open` — abrir URLs `http`, `https` ou `mailto` fora do iframe;
- `profile.backup` — exportar/restaurar dados do perfil; reservado à app `backup-restauro`;

## Fluxo de arranque

O ponto de entrada é `index.html`, que carrega `system/js/main.js` como módulo.

`main.js` executa:

1. `initFS()` para abrir/migrar o filesystem virtual.
2. `initUsers()` para carregar o utilizador atual.
3. `initSettings()` para aplicar tema e preferências.
4. `initNotifications()` para criar toasts e centro de notificações.
5. `loadRegistry()` para descobrir e validar aplicações.
6. `initTaskbar()` para barra de tarefas, relógio, bandeja e áreas de trabalho.
7. `initDesktop()` para os ícones do desktop.
8. `initStartMenu()` para pesquisa, apps recentes e sessão.
9. `initSwitcher()` para alternância de janelas.
10. `runBoot()` controla o ecrã de arranque e login.

O servidor local é necessário para módulos ES e para as URLs das aplicações. Usar `http://localhost:...`, não abrir diretamente com `file://`.

## Arquitetura do shell

### Janelas

`system/js/window-manager.js` controla:

- criação e remoção de janelas;
- foco e z-index;
- arrasto e redimensionamento;
- minimizar, maximizar e restaurar;
- snap esquerda, direita e topo;
- áreas de trabalho virtuais;
- limites de viewport;
- atalhos `Alt+F4`, `F11`, `Alt+setas` e `Esc`.
- alternador `Alt+Q`, com `Shift` para inverter a direção.

Cada aplicação é carregada num `iframe` sandbox. A app nunca deve manipular diretamente o DOM do shell.

### Desktop

`system/js/desktop.js` cria atualmente apenas estes ícones fixos:

- Lixeira;
- Pasta pessoal;
- Navegador.

Os outros programas continuam disponíveis pelo Menu Iniciar e pela Loja. As posições dos ícones são guardadas em `localStorage`.

### Barra de tarefas

`system/js/taskbar.js` gere:

- botões de janelas abertas;
- estado ativo/minimizado;
- áreas de trabalho;
- relógio;
- bandeja de rede, som e bateria simulados;
- acesso ao centro de notificações.

### Menu Iniciar

`system/js/start-menu.js` fornece:

- pesquisa de aplicações;
- pesquisa de ficheiros;
- aplicações recentes;
- navegação por teclado;
- fechar janelas;
- bloquear sessão;
- terminar sessão;
- reiniciar.

### Eventos

`system/js/event-bus.js` é o barramento central:

```js
import { bus } from './event-bus.js';

const unsubscribe = bus.on('evento', data => {});
bus.emit('evento', { value: 1 });
unsubscribe();
```

Eventos importantes:

- `window:opened`
- `window:closed`
- `window:focused`
- `window:minimized`
- `window:title`
- `workspace:changed`
- `fs:changed`
- `settings:changed`
- `theme:changed` — notificação enviada às apps quando as variáveis de tema mudam;
- `notify`
- `shell:changed`
- `app:launched`

`settings:changed` é um evento interno do shell. `theme:changed` é o evento público recebido pelas apps através de `os.on()`.

### Alternador de janelas

`system/js/switcher.js` implementa o alternador de janelas ativado por `Alt+Q`. Mantém `Alt` pressionado e repete `Q` para percorrer as janelas; `Shift` inverte a direção. `Alt+setas` faz snap ou restaura a janela ativa. Apps em iframe reenviam as teclas através do método interno `shell.key` do SDK.

## Isolamento e segurança

O shell cria cada app com:

```js
frame.sandbox = 'allow-scripts allow-forms allow-modals';
```

Decisões importantes:

- `allow-scripts` é necessário para executar o código da app.
- `allow-same-origin` é deliberadamente omitido; a app fica com origem opaca e não deve aceder ao DOM do parent.
- `allow-forms` permite formulários HTML locais.
- `allow-modals` existe por compatibilidade, mas as apps devem preferir `os.dialog`.
- `allow-popups` permite que links clicados pela app abram uma nova janela/aba do navegador. É usado pelo Portfolio para links externos e email.

A API identifica o cliente através de `event.source` e do `contentWindow` registado. Como o sandbox sem `allow-same-origin` produz uma origem opaca, a política atual não usa `event.origin` como controlo principal. Não adicionar `allow-same-origin` apenas para facilitar essa verificação.

As permissões atuais são capacidades globais dentro do espaço permitido. `fs.read` e `fs.write` restringem a app à pasta do utilizador atual e à Lixeira, mas ainda não têm escopo por subpasta. Isto é isolamento funcional de um simulador, não uma fronteira de segurança contra código malicioso.

Ainda não existem CSP específica por app, quotas de recursos, timeout de RPC ou limites centrais de payload. São evoluções futuras, não contratos atuais.

## SDK das aplicações

Todas as apps devem incluir, antes do seu `app.js`:

```html
<script src="../../system/sdk/os-sdk.js"></script>
```

O SDK cria `window.os`.

### Diálogos

Para diálogos dentro da app, carregar também `system/sdk/os-dialogs.js` depois do SDK:

```html
<script src="../../system/sdk/os-sdk.js"></script>
<script src="../../system/sdk/os-dialogs.js"></script>
```

API disponível:

```js
await os.dialog.prompt({ title, message, defaultValue, okLabel });
await os.dialog.confirm({ title, message, okLabel, danger });
await os.dialog.open({ title, start, filter });
await os.dialog.save({ title, start, defaultName });
```

`prompt` devolve texto ou `null`; `confirm` devolve booleano; `open` e `save` devolvem caminho ou `null`. `open` e `save` exigem `fs.read`. Preferir estes diálogos a `window.prompt`, `window.confirm` e `alert`.

### Janela

```js
os.window.setTitle('Título');
os.window.resize(600, 400);
os.window.close();
```

### Aplicação e ficheiros

```js
const args = await os.args();
await os.openFile('/home/user/Documentos/exemplo.txt');
```

`os.openFile()` exige `apps.launch`.

`os.openFile(path)` emite `file:open` no Event Bus interno do shell. Não é um evento público recebido por `os.on()`. O shell escolhe a primeira app cujo manifest declare a extensão em `fileTypes`; se não houver correspondência, usa o Notepad quando disponível. A app escolhida recebe `{ path }` por `os.args()`. Sem app compatível, nenhuma janela é aberta.

`os.args()` devolve os argumentos fornecidos ao criar a janela. O uso principal é `{ path }` ao abrir um ficheiro pelo Explorador.

Filesystem disponível:

```js
await os.fs.list(path);
await os.fs.read(path);
await os.fs.stat(path);
await os.fs.write(path, content, mime);
await os.fs.mkdir(path);
await os.fs.move(from, to);
await os.fs.remove(path);
await os.fs.trash(path);
await os.fs.restore(path);
await os.fs.emptyTrash();
await os.fs.search(query, path);
```

- Operações de leitura exigem `fs.read`.
- Operações de escrita exigem `fs.write`.
- O shell limita o acesso da app à pasta do utilizador e à Lixeira.
- `/` e `/home` são interpretados como a pasta pessoal pelo SDK.
- O filesystem real do computador não é exposto diretamente.

### Armazenamento privado

```js
await os.storage.set('tasks', tasks);
const tasks = await os.storage.get('tasks');
await os.storage.remove('tasks');
```

As chaves são prefixadas pelo ID da app no shell. Apps diferentes não partilham este armazenamento.

### Propriedade dos dados

- `os.storage`: dados privados e preferências próprias de cada app.
- `os.settings`: preferências globais do perfil/shell, como tema, idioma e papel de parede.
- `os.fs`: documentos do utilizador que devem aparecer no Explorador ou ser abertos por outras apps.
- `os.profileBackup`: API reservada à app `backup-restauro`; inclui definições, dados privados das apps e pasta pessoal do perfil ativo. Exclui contas, credenciais, auditoria, notificações e a Lixeira. Apps comuns não devem declarar `profile.backup` nem aceder diretamente ao IndexedDB.

Não criar armazenamento global partilhado para dados de domínio de apps sem um fluxo concreto de partilha; preferir formatos de ficheiro explícitos.

### Notificações

```js
await os.notify('Operação concluída.');
```

O manifest deve declarar `notifications`.

### Clipboard

```js
await os.clipboard.write('texto');
const text = await os.clipboard.read();
```

O manifest deve declarar `clipboard`.

### Links externos e email

```js
await os.external.open('https://example.com');
await os.external.open('mailto:contacto@example.com?subject=Olá');
```

O manifest deve declarar `external.open`. O shell aceita apenas URLs `http:`, `https:` e `mailto:` e abre-as numa nova janela/handler do navegador.

O método interno `shell.key` não deve ser chamado diretamente pelas apps. O `os-sdk.js` usa-o apenas para reenviar ao shell teclas capturadas dentro do iframe, como as usadas pelo alternador de janelas.

### Definições

```js
const settings = await os.settings.get();
await os.settings.set({ theme: 'dark' });
```

Alterar definições exige `settings.write`.

### `singleInstance`

Com `singleInstance: true`, uma nova tentativa de abrir a app foca a janela existente em vez de criar outra. Os argumentos originais não são substituídos automaticamente. Com `false`, cada abertura cria uma janela e iframe novos.

### Erros e compatibilidade

As chamadas assíncronas rejeitam a Promise com `Error` de nome `OSApiError`, incluindo `code` e `message`. Códigos conhecidos incluem `permission_denied`, `path_forbidden`, `not_found`, `invalid_args`, `already_exists`, `quota_exceeded` e `unsupported`. Usar `os.errors.is(error, code)` e `os.errors.message(error, fallback)` em vez de analisar texto de erro.

`os.ui.status(target, message, state)` apresenta estados `info`, `loading`, `success` ou `error`. `os.ui.run({ button, status, loading, success, failure }, operation)` desativa o botão durante a operação e mostra estados padronizados. As apps continuam responsáveis por `try/catch` quando precisam de recuperar da falha.

Não existe ainda `sdkVersion` no manifest nem handshake de compatibilidade. Alterações incompatíveis ao SDK exigem primeiro uma camada de compatibilidade.

### Ciclo de vida

- Abrir cria o iframe.
- Minimizar apenas oculta a janela.
- Fechar remove a janela e o iframe.
- Logout ou reinício recarrega a página e destrói as apps.

Não existem ainda eventos públicos `app:ready`, `app:beforeclose` ou `app:visibility`. Guardar estado durante as operações, usando `os.storage`, em vez de depender de um evento de encerramento.

### Eventos do shell

```js
os.on('fs:changed', data => {});
os.on('theme:changed', data => {});
os.on('shell:changed', data => {});
```

`file:open` é interno ao shell e não deve ser escutado pelas apps.

## Comunicação interna

`system/js/api.js` recebe mensagens `postMessage` dos iframes.

O fluxo é:

1. A app chama uma função de `window.os`.
2. O SDK envia `{ id, method, params }` ao parent.
3. A API encontra o cliente pelo `contentWindow` do iframe.
4. A API verifica a permissão declarada no manifest.
5. Executa o método do shell.
6. Responde com `{ id, result }` ou `{ id, error }`.

Para adicionar uma nova capacidade do sistema:

1. Implementar a operação num módulo do shell.
2. Adicionar o método em `system/js/api.js`.
3. Verificar a permissão necessária.
4. Expor uma função em `system/sdk/os-sdk.js`.
5. Atualizar `docs/app-development.md` e este ficheiro.
6. Adicionar validação ou smoke test.

Não dar acesso direto ao DOM, IndexedDB ou estado interno do shell às apps.

## Filesystem e persistência

`system/js/storage.js` gere IndexedDB `webos`, atualmente na versão `2`.

Object stores:

- `kv`: definições, utilizadores e dados privados das apps;
- `fs`: filesystem virtual, com índices `parent`, `type` e `mtime`;
- `audit`: logs de diagnóstico.

`system/js/filesystem.js` cria estas pastas padrão:

```text
/
├── .Trash/
└── home/user/
    ├── Documentos/
    ├── Imagens/
    ├── Música/
    ├── Vídeos/
    └── Downloads/
```

As alterações ao schema devem ser feitas com incremento de `DB_VERSION` e migração em `onupgradeneeded`. Nunca apagar stores existentes sem uma migração explícita.

## Utilizadores e sessão

`system/js/users.js` gere perfis persistentes. `system/js/boot.js` gere:

- login;
- seleção de perfil;
- logout;
- bloqueio de sessão;
- reinício visual.

O sistema atual tem perfis e sessão, mas não implementa autenticação por palavra-passe. Não documentar isto como segurança real.

## Notificações e diagnóstico

`system/js/notifications.js` fornece:

- toasts temporários;
- centro de notificações;
- histórico persistente;
- contador de não lidas;
- limpar histórico.

`system/js/logger.js` fornece logs `debug`, `info`, `warn` e `error`, persistidos na store `audit`. Usar o logger em novas funcionalidades do shell em vez de `console.log` solto.

A store `audit` deve conter eventos técnicos curtos, sem palavras-passe, tokens ou conteúdo privado de ficheiros. Atualmente não existe uma UI de diagnóstico nem expurgo automático; futuras ferramentas devem limitar o histórico e permitir limpá-lo.

## Depurar uma aplicação

1. Iniciar o WebOS por servidor local.
2. Abrir a app pelo Menu Iniciar ou diretamente pelo desktop, quando existir atalho.
3. Usar as ferramentas de desenvolvimento do navegador e selecionar o iframe da app na árvore de frames.
4. Verificar primeiro erros de `manifest.json`, `entry`, caminhos relativos e permissões.
5. Confirmar que o SDK é carregado antes do `app.js`.
6. Tratar todas as chamadas `os.*` com `try/catch`.
7. Testar a app pelo shell, não apenas abrindo o seu HTML isoladamente, porque `window.os` só é criado pelo SDK no iframe registado.

As apps não devem depender de acesso direto a `window.parent`, `document` do shell ou `localStorage`.

## Compatibilidade do navegador

O alvo principal é um navegador moderno com suporte para ES Modules, IndexedDB, sandboxed iframes, `postMessage`, `inert`, CSS `color-mix` e APIs HTML5. Chrome/Edge são o ambiente de validação principal; Firefox e Safari podem exigir ajustes de CSS ou suporte alternativo para APIs recentes.

O runtime deve degradar graciosamente quando uma capacidade opcional não existir, por exemplo Clipboard, autoplay de media ou directory listing HTTP.

## Regras de UI e CSS

- Manter HTML sem frameworks.
- Usar CSS local da app para estilos específicos.
- Usar variáveis de tema `--os-*` nas apps.
- Implementar estados `hover`, `focus-visible`, `active`, `disabled` e erro.
- Garantir navegação por teclado.
- Usar `aria-label`, `role` e `aria-live` quando necessário.
- Respeitar `prefers-reduced-motion`.
- Preferir ícones SVG locais em vez de símbolos Unicode para novas interfaces.
- Não adicionar dependências externas sem necessidade.
- Não usar `localStorage` nas apps sandbox; usar `os.storage`.
- Não usar `type="module"` dentro das apps.

## Como adicionar uma nova app

1. Criar `apps/<id>/`.
2. Adicionar `manifest.json`, `index.html`, `app.js`, `style.css` e `icon.svg`.
3. Colocar imagens, sons e fontes dentro de `apps/<id>/assets/`.
4. Incluir o SDK no HTML.
5. Declarar apenas as permissões necessárias.
6. Usar `os.storage` para dados privados.
7. Usar `os.fs` apenas com permissões e caminhos permitidos.
8. Confirmar que o servidor lista `apps/`.
9. Reiniciar/recarregar o WebOS.
10. Executar a validação de manifestos e o smoke test.

## Validação local

A partir da raiz do projeto:

```powershell
node .\tests\validate-manifests.mjs
node .\tests\smoke.mjs
node .\tests\i18n.mjs
```

Validar sintaxe de todos os scripts:

```powershell
Get-ChildItem -Path . -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Executar com servidor local, por exemplo Five Server, Python ou PHP. Não testar a aplicação principal abrindo `index.html` diretamente com `file://`.

Em CI, executar os três testes e falhar o job quando qualquer um terminar com código diferente de zero:

```powershell
node .\tests\validate-manifests.mjs
node .\tests\smoke.mjs
node .\tests\i18n.mjs
```

Ainda não existe uma configuração CI oficial nem uma suíte de testes de browser.

## Princípios para outra IA

- Ler primeiro os módulos locais relacionados antes de editar.
- Preservar alterações existentes do utilizador.
- Fazer a menor alteração compatível com a arquitetura.
- Não reescrever apps não relacionadas.
- Validar imediatamente depois de editar.
- Não adicionar funcionalidades ao shell quando uma app autónoma resolve o problema.
- A regra anterior tem uma exceção: capacidades que precisam de serviços globais, permissões, janelas, filesystem, notificações ou integração com o shell devem ser adicionadas ao SDK/API e documentadas antes de serem usadas por apps.
- Não assumir que uma funcionalidade está completa só porque existe um botão: testar o comportamento.
- Manter a separação entre shell, SDK e aplicações.
- Atualizar a documentação quando um contrato público mudar.
- Usar português europeu nos textos visíveis existentes, salvo pedido contrário.
