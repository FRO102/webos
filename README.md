# WebOS

Um ambiente de trabalho virtual executado no browser, construído com HTML,
CSS e JavaScript puro. O projeto disponibiliza janelas, aplicações isoladas,
um filesystem virtual persistente e uma interface inspirada num sistema
operativo de desktop.

> Projeto experimental e sem backend. Os dados do utilizador ficam localmente
> no browser através do IndexedDB.

## Funcionalidades

- Ambiente de trabalho com ícones, grelha, seleção e arrastar/soltar.
- Janelas redimensionáveis, minimizáveis, maximizáveis e encaixáveis.
- Menu Iniciar, barra de tarefas e quatro áreas de trabalho.
- Filesystem virtual com:
  - Pasta pessoal;
  - Desktop;
  - Documentos, Imagens, Música, Vídeos e Downloads;
  - Lixeira e restauro;
  - Pesquisa, cópia, movimento e importação de ficheiros.
- Drag and drop entre o Desktop e o Explorador de Ficheiros.
- Movimento de um ou vários itens entre pastas, Desktop e várias janelas do
  Explorador.
- Escolha entre mover, copiar ou cancelar ao largar itens internos; arrastar
  para a Lixeira move diretamente e preserva a origem para restauro.
- Importação de ficheiros e pastas do computador para o filesystem virtual.
- Temas, wallpapers, idioma, acessibilidade e modo de ecrã inteiro.
- Backup e restauro das definições, dados das aplicações e pasta pessoal.
- Aplicações executadas em iframes sandboxed através de um SDK próprio.
- Interface em Português e Inglês.

## Aplicações incluídas

O repositório contém **43 aplicações**, distribuídas pelas categorias:

- **Sistema** — Definições, Explorador de Ficheiros, Terminal, Downloads,
  Calculadora, Relógio, Calendário e outras ferramentas.
- **Aplicações** — Browser, Notepad, WordWebOS, ExcelWebOS, Kanban,
  Diagramas, Desenhador, PDFWebOS, Rádio e aplicações de produtividade.
- **Jogos** — Sudoku, Xadrez, Tetris, Pacman, Puzzle, Snake, Zombie
  Survival e outros jogos.

A lista de aplicações carregada em produção está em
[`apps/registry.json`](apps/registry.json). Cada aplicação tem uma pasta
própria em [`apps/`](apps/).

## Executar localmente

### Requisitos

- Browser moderno com suporte para:
  - JavaScript modules;
  - IndexedDB;
  - Web Components básicos;
  - iframes sandboxed.
- Python, PHP ou outro servidor HTTP estático.
- Node.js para executar os testes.

Não abrir o projeto com `file://`. O WebOS usa módulos ES e precisa de uma
origem HTTP.

### Python

Na raiz do repositório:

```bash
python -m http.server 8000
```

Abrir [http://localhost:8000](http://localhost:8000).

### PHP

```bash
php -S localhost:8000
```

### VS Code

Também é possível usar Five Server ou outra extensão de servidor local.
Quando o Five Server estiver ativo, abrir a página pela mesma origem e porta
do servidor, normalmente [http://localhost:5500](http://localhost:5500).

Se o browser mostrar um erro CORS para
`/fiveserver/status`, trata-se do script da extensão Five Server e não de uma
chamada feita pelo WebOS. Nesse caso, usar a porta do Five Server ou desligar a
extensão e utilizar o servidor Python/PHP.

## Testes

Executar a suíte completa a partir da raiz:

```bash
node tests/validate-manifests.mjs
node tests/smoke.mjs
node tests/i18n.mjs
node tests/sandbox.mjs
node tests/filesystem-paths.mjs
node tests/filesystem-content.mjs
node tests/desktop-dnd.mjs
node tests/sudoku.mjs
node tests/excel-data.mjs
node tests/pacman.mjs
node tests/tetris.mjs
node tests/zombie-defense.mjs
node tests/zombie-survival-engine.mjs
node tests/zombie-survival-objectives.mjs
node tests/zombie-survival-content.mjs
node tests/zombie-survival-settings.mjs
node tests/zombie-survival-persistence.mjs
```

Alguns testes opcionais podem ser ignorados quando o ambiente não tiver o
loader específico necessário, como o teste TypeScript de Zombie Defense.

Para verificar a sintaxe dos scripts JavaScript no PowerShell:

```powershell
Get-ChildItem -Path . -Recurse -Filter *.js |
  ForEach-Object { node --check $_.FullName }
```

## Estrutura do repositório

```text
index.html             Entrada principal do WebOS
apps/                  Aplicações, manifests e registry.json
assets/                Ícones, fontes e recursos partilhados
docs/                  Documentação para desenvolvimento de apps
system/js/             Shell, janelas, filesystem e serviços
system/sdk/            SDK utilizado pelas aplicações sandboxed
system/css/            Estilos do shell
tests/                 Testes de manifests, shell, filesystem e apps
```

## Criar uma aplicação

1. Criar uma pasta `apps/<id>/`.
2. Adicionar `manifest.json`, `index.html` e um ícone SVG.
3. Adicionar o ID ao array de [`apps/registry.json`](apps/registry.json).
4. Declarar apenas as permissões necessárias.
5. Executar os testes de manifests e smoke.

Exemplo mínimo de manifest:

```json
{
  "id": "minha-app",
  "name": "Minha App",
  "version": "1.0.0",
  "icon": "icon.svg",
  "entry": "index.html",
  "category": {
    "id": "applications",
    "name": "Aplicações",
    "nameEn": "Applications"
  },
  "permissions": []
}
```

No `index.html`, carregar o SDK como script clássico:

```html
<script src="../../system/sdk/os-sdk.js"></script>
```

Usar `window.os` para comunicar com o shell. Não aceder diretamente ao DOM do
WebOS nem utilizar `localStorage` para dados da aplicação.

O guia completo está em
[`docs/app-development.md`](docs/app-development.md).

## Sandbox e segurança

As aplicações são carregadas em iframes sandboxed. Por defeito, o sandbox não
inclui `allow-same-origin`, mantendo a aplicação isolada da origem do shell.

`allowSameOrigin: true` só deve ser utilizado quando uma aplicação depender
comprovadamente de módulos/workers locais, armazenamento próprio ou iframes
aninhados. Esta exceção reduz o isolamento e deve ser evitada quando não for
necessária.

As permissões disponíveis incluem filesystem, notificações, clipboard,
abertura de URLs externas, lançamento de aplicações e backup/restauro. O
manifest deve declarar apenas as permissões que a aplicação realmente utiliza.

## Dados e persistência

- O filesystem virtual é guardado no IndexedDB do browser.
- Os dados não são sincronizados entre browsers ou dispositivos.
- O alojamento estático, incluindo Cloudflare Pages, não fornece disco remoto.
- `os.storage` é privado para cada aplicação.
- `os.settings` é reservado para definições globais do shell.
- O Backup e Restauro não inclui credenciais, contas, auditoria, notificações
  nem a Lixeira.

## Atalhos

| Atalho | Ação |
| --- | --- |
| `Alt+Q` | Alternar entre janelas abertas |
| `Shift+Alt+Q` | Alternar na direção inversa |
| `Alt+←` / `Alt+→` | Encaixar a janela à esquerda ou direita |
| `Alt+↑` / `Alt+↓` | Maximizar ou restaurar a janela |
| `Esc` | Fechar menus e o alternador |
| `Ctrl+S` | Guardar em aplicações compatíveis |
| `Tab` | Completar comandos no Terminal |

O browser reserva `Alt+Tab` ao sistema operativo anfitrião.

## Deploy

O projeto é estático e pode ser publicado em Cloudflare Pages ou qualquer
servidor HTTP estático. Antes do deploy:

1. Confirmar que todas as aplicações estão listadas em
   [`apps/registry.json`](apps/registry.json).
2. Executar a suíte de testes.
3. Confirmar que os caminhos dos manifests são relativos e válidos.
4. Verificar que os recursos das aplicações estão dentro das respetivas
   pastas.

## Licença

Este repositório não contém atualmente um ficheiro de licença. Até ser
adicionada uma licença, não assumir que o código pode ser reutilizado,
redistribuído ou modificado fora dos direitos concedidos pela legislação
aplicável.
