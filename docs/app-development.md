# Criar uma app

1. Cria `apps/<id>/` com `manifest.json`, `index.html` e um ícone SVG.
2. No `index.html`, carrega o SDK com um script normal: `<script src="../../system/sdk/os-sdk.js"></script>`.
3. Adiciona o `id` da app ao array em [`apps/registry.json`](apps/registry.json). No Cloudflare Pages, esse registry é a fonte de verdade e evita a falha de listagem de diretórios.
4. Em desenvolvimento local, pode continuar a usar um servidor que exponha a listagem de diretórios em `apps/` para descoberta automática; o sistema também faz fallback para o registry.

Regras:
- O `id` do manifest deve ser igual ao nome da pasta e conter apenas letras, números e hífen.
- O `id` deve usar apenas minúsculas, números e hífen.
- Cada manifest deve declarar uma das três categorias visuais: `system` (Sistema), `applications` (Aplicações) ou `games` (Jogos). Os nomes são apresentados conforme o idioma ativo.
- Exemplo de categoria no manifest:

  ```json
  "category": { "id": "applications", "name": "Aplicações", "nameEn": "Applications" }
  ```

- Todas as apps que usem o mesmo `category.id` devem declarar exatamente os mesmos `name` e `nameEn`. Não declares IDs adicionais: o loader e o validador rejeitam categorias fora das três secções suportadas.
- `os.shell.apps()` expõe a categoria como `{ id, name, nameEn }`. Não mantenhas um catálogo de categorias separado.
- Em Cloudflare Pages, o `id` também tem de aparecer em [`apps/registry.json`](apps/registry.json) para a app ser carregada.
- Todos os ficheiros e imagens específicos da app devem ficar dentro da própria pasta `apps/<id>/`.
- O `icon` e o `entry` são caminhos relativos à pasta da app.
- `fileTypes`, quando usado, é um array de extensões com ponto e em minúsculas, como `[".txt", ".md"]`.
- A app corre num iframe com `sandbox`, e agora usa `allow-same-origin` para permitir módulos locais e scripts do WebOS sem CORS, mantendo o isolamento do DOM do sistema e do `localStorage` principal.
- O sandbox permite `allow-popups` para links clicados abrirem no navegador; não usar isto para contornar as APIs do shell.
- Usa scripts clássicos, não `type="module"` (a origem do iframe é opaca).
- Fala com o sistema só através de `window.os` (`window.setTitle/resize/close`, `notify`, `theme.get`).
- Chamadas que exijam permissão (fase 5: `fs.*`) têm de estar listadas em `permissions` no manifest.
- `singleInstance` é opcional e booleano; o valor padrão é `false`.
- `external.open` permite abrir URLs `http`, `https` e `mailto` através do SDK.

## API (fase 5)
- `os.fs.list/read/stat/exists/write/mkdir/remove/move` (`exists` requer `fs.read`; as operações de leitura requerem `fs.read` e as de alteração requerem `fs.write`). `read` devolve texto como string e conteúdos binários como `Blob`; `write` aceita string, `Blob`, `ArrayBuffer` e `TypedArray`. `stat.size` é medido em bytes.
- `os.storage.get/set/remove` — armazenamento privado da app, sem permissão
- `os.args()` — argumentos de arranque, ex.: `{ path }` quando a app é aberta a partir de um ficheiro
- `os.shell.isFullscreen()` / `os.shell.toggleFullscreen()` — consultar ou alternar o modo ecrã inteiro do WebOS. A chamada para entrar deve partir diretamente de uma ação do utilizador e pode ser recusada pelas políticas do browser.
- `os.openFile(path)` — abre o ficheiro na app registada para a extensão (`fileTypes` no manifest); permissão `apps.launch`
- `os.openFile(path, appId)` — abre o ficheiro numa app compatível escolhida explicitamente; omite `appId` para usar o handler predefinido.
- O Explorador apresenta “Abrir com” quando mais de uma app declara a extensão do ficheiro. Declara apenas formatos que a app consegue importar.
- `os.on('fs:changed', fn)` — recebido por apps com `fs.read`
- `os.i18n.language` / `os.i18n.locale` — idioma ativo (`pt-PT` ou `en`) e localidade de formatação (`pt-PT` ou `en-GB`).
- `os.i18n.t(text)` — traduz texto conhecido pelo catálogo do sistema, mantendo o original como fallback.
- `os.i18n.date(value, options)` e `os.i18n.number(value, options)` — formatam datas e números na localidade ativa.
- `os.i18n.onChange(fn)` — recebe `{ language, locale, translations }` quando o idioma muda enquanto a app está aberta.
- `os.i18n.apply(root)` — aplica ao DOM indicado as traduções do catálogo comum e atualiza `lang`; o SDK também traduz automaticamente novos nós adicionados.

As apps devem manter as strings de origem em Português no HTML e usar `os.i18n.t()` para texto dinâmico conhecido. Para datas e números, usar `os.i18n.date()` e `os.i18n.number()` em vez de fixar `pt-PT`. O catálogo comum cobre as strings traduzidas pelo sistema, mas ainda não é uma tradução integral de todas as apps; texto sem entrada no catálogo permanece na língua de origem. Conteúdo escrito pelo utilizador, caminhos, IDs e dados persistidos não devem ser traduzidos.

Ao adicionar rótulos novos à interface, incluir a tradução inglesa no catálogo `system/js/i18n.js` e cobrir o comportamento em Português e Inglês. Executar também `node .\tests\i18n.mjs`, além dos testes de smoke e manifests.

## Propriedade e persistência dos dados

- `os.storage` pertence à app identificada pelo manifest. Usa-o para dados privados e preferências específicas da app; as chaves não são partilhadas com outras apps.
- `os.settings` pertence ao perfil/shell. Usa-o apenas para preferências globais, como tema, idioma e papel de parede. Não guardes ali dados de domínio de uma app.
- `os.fs` contém ficheiros do utilizador no filesystem virtual. Guarda documentos que o utilizador espera encontrar no Explorador ou abrir noutra app.
- A pasta `/home/user/Desktop` é criada pelo filesystem e os seus ficheiros/pastas aparecem também como ícones no Desktop do WebOS. O shell atualiza os ícones quando essa pasta muda.
- O filesystem é local ao browser/perfil e guardado em IndexedDB; o alojamento estático no Cloudflare Pages não fornece um disco remoto nem sincroniza ficheiros entre dispositivos. `apps/registry.json` continua a servir apenas para descobrir apps.
- Esta configuração WebOS usa um único perfil chamado `User`; os dados antigos que eventualmente existam sob outros IDs não são apagados automaticamente pela inicialização.
- `os.fs.write(path, content, mime)` preserva conteúdo binário quando recebe `Blob`, `ArrayBuffer` ou `TypedArray`. `os.fs.read(path)` devolve strings para conteúdo textual e `Blob` para conteúdo binário; `os.fs.stat(path).size` é sempre em bytes. Ficheiros antigos em Data URL e texto continuam legíveis.
- O filesystem não fornece operações atómicas de substituição. `os.fs.write()` atualiza o caminho existente; para fluxos “Guardar como”, usa `os.dialog.save()`, que verifica e confirma a substituição antes de devolver o caminho.
- A app **Backup e Restauro** exporta/restaura as definições globais, chaves privadas das apps e pasta pessoal do perfil ativo. Não inclui contas, credenciais, auditoria, notificações nem a Lixeira. A permissão `profile.backup` é reservada pelo shell ao ID `backup-restauro`; apps comuns não devem declará-la.
- Não criar APIs globais de partilha de dados até existir um fluxo concreto que não possa ser resolvido por exportação/importação de ficheiros.

## Erros e estado de operações

As chamadas do SDK rejeitam a Promise com `Error` de nome `OSApiError`, com `code` e `message`. Códigos incluem `permission_denied`, `path_forbidden`, `not_found`, `invalid_args`, `already_exists`, `quota_exceeded` e `unsupported`. Consulta o código com `os.errors.is(error, 'not_found')` e apresenta texto com `os.errors.message(error, fallback)` em vez de depender de mensagens internas do shell.

Para operações iniciadas por um botão, `os.ui.run({ button, status, loading, success, failure }, operation)` desativa o botão, apresenta estado de carregamento e normaliza o estado de sucesso/erro. `status` aceita o ID ou elemento de destino; `os.ui.status(target, message, state)` também pode ser usado diretamente com estados `info`, `loading`, `success` ou `error`. Mantém `try/catch` junto de fluxos que precisem de recuperar após uma falha.

```js
try {
  await os.ui.run({ button: saveButton, status: 'status', loading: 'A guardar…', success: 'Guardado.' }, () => os.fs.write(path, content));
} catch (error) {
  if (os.errors.is(error, 'permission_denied')) return;
}
```

## Backup do perfil

`os.profileBackup.export()` e `os.profileBackup.restore(backup)` estão reservados à app `backup-restauro` e exigem `profile.backup`. A app deve validar/mostrar a origem e o tamanho antes de pedir confirmação de restauro. O shell valida os registos e aplica o restauro numa transação; as apps não devem implementar cópias diretas de IndexedDB.

## Tema e definições (fase 6)
- O SDK aplica automaticamente o tema do sistema ao `:root` da app: `data-theme` e as variáveis
  `--os-bg`, `--os-surface`, `--os-btn`, `--os-fg`, `--os-muted`, `--os-border`, `--os-field`, `--os-accent`.
  Usa-as com fallback, ex.: `background: var(--os-bg, #fff)`. Mudanças ao vivo chegam via `os.on('theme:changed', fn)`.
- `os.settings.get()` (aberto) e `os.settings.set({ theme, accent, wallpaper })` (permissão `settings.write`).
- `os.notify(mensagem)` mostra uma notificação (toast) com o nome da app.

## Diálogos de ficheiros
Inclui `<script src="../../system/sdk/os-dialogs.js"></script>` depois do `os-sdk.js` (requer `fs.read`):
 - `os.dialog.choose({ title, message, options })` → `value` escolhido ou `null`
 `prompt` devolve texto ou `null`; `confirm` devolve booleano; `choose` devolve o `value` escolhido ou `null`; `open` e `save` devolvem caminho ou `null`. `open` e `save` exigem `fs.read`. Preferir estes diálogos a `window.prompt`, `window.confirm` e `alert`.
- `os.dialog.prompt({ title, message, defaultValue, okLabel })` → texto ou `null`
