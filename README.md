# WebOS

Um ambiente de trabalho virtual que corre no browser. O WebOS reúne janelas, áreas de trabalho, um sistema de ficheiros virtual e aplicações isoladas, sem backend nem processo de build.

> Projeto experimental, construído com HTML, CSS e JavaScript.

## O que inclui

- Ambiente de trabalho com janelas redimensionáveis, minimizáveis e encaixáveis.
- Menu Iniciar, barra de tarefas, quatro áreas de trabalho e alternador de janelas.
- Sistema de ficheiros virtual persistente no browser, com Pasta pessoal, Desktop e Lixeira.
- Definições de tema, papel de parede, acessibilidade e idioma.
- Opção para colocar o WebOS em ecrã inteiro através das Definições.
- Notificações, perfis de utilizador e cópia de segurança/restauro de dados do perfil.
- Aplicações executadas em iframes sandbox e integradas com o sistema através de um SDK próprio.
- Interface em Português e Inglês. Textos ainda sem tradução mantêm a língua de origem.

## Aplicações

O projeto inclui 21 aplicações:

| Sistema e produtividade | Ferramentas e conteúdo |
| --- | --- |
| Definições, Aplicações, Ficheiros, Terminal | Calculadora, Calendário, Relógio, Snake |
| Navegador, Gestor de Tarefas, Gestor de Downloads | Diagramas, Despesas, Conversor de Unidades |
| Backup e Restauro, Portefolio Terminal | Códigos QR, Paleta de Cores, Imagens, Leitor Multimédia, Bloco de Notas |

Cada aplicação vive na sua própria pasta dentro de [`apps/`](apps/).

## Começar

### Requisitos

- Um browser moderno com suporte para JavaScript modules, IndexedDB e iframes sandbox.
- Python ou PHP para servir o projeto localmente. Também podes usar Five Server no VS Code.
- Node.js para executar os testes.

### Executar localmente

Na raiz do projeto, inicia um servidor HTTP:

```bash
python -m http.server 8000
```

Ou, se tiveres PHP instalado:

```bash
php -S localhost:8000
```

Abre [http://localhost:8000](http://localhost:8000). Não abras `index.html` com `file://`: o shell usa ES modules e carrega as aplicações em iframes.

> **Importante:** o carregador tenta primeiro ler `apps/registry.json`. Esse ficheiro permite que o WebOS funcione em Cloudflare Pages, onde a listagem de diretórios estática costuma falhar. Localmente, ainda pode recorrer à listagem HTTP da pasta `apps/` se o servidor expuser diretórios.

## Idiomas

Escolhe **Português** ou **English** em **Definições → Acessibilidade → Idioma**. A preferência é guardada e aplicada ao shell e às aplicações abertas. Datas e números usam a localidade correspondente (`pt-PT` ou `en-GB`). A cobertura de tradução está em evolução; texto sem tradução permanece no idioma original.

## Atalhos

| Atalho | Ação |
| --- | --- |
| `Alt+Q` | Alternar entre janelas abertas; mantém `Alt` e repete `Q`. `Shift` inverte a direção. |
| `Alt+←` / `Alt+→` | Encaixar a janela ativa à esquerda ou à direita. |
| `Alt+↑` / `Alt+↓` | Maximizar ou repor o tamanho da janela. |
| `Esc` | Fechar menus e o alternador de janelas. |
| `Ctrl+S` | Guardar em aplicações com suporte, como Bloco de Notas e Diagramas. |
| `Tab` | Completar comandos no Terminal. |

O browser reserva `Alt+Tab` ao sistema operativo anfitrião.

## Testes

Executa a partir da raiz do projeto:

```bash
node tests/validate-manifests.mjs
node tests/smoke.mjs
node tests/i18n.mjs
```

Para verificar a sintaxe dos scripts JavaScript em PowerShell:

```powershell
Get-ChildItem -Path . -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Criar uma aplicação

Adiciona uma pasta `apps/<id>/` com um `manifest.json` e os ficheiros da aplicação. O `id` do manifest tem de corresponder ao nome da pasta.

Quando publicares em Cloudflare Pages, atualiza também o ficheiro [`apps/registry.json`](apps/registry.json) com o `id` da nova app; esse registry é a fonte de verdade em produção.

As aplicações são isoladas em iframes sandbox. Inclui o SDK antes do código da app:

```html
<script src="../../system/sdk/os-sdk.js"></script>
```

Usa as APIs `window.os` em vez de aceder diretamente ao DOM do shell ou a `localStorage`. Declara no manifest apenas as permissões necessárias.

O guia completo, incluindo manifests, permissões, filesystem e localização, está em [`docs/app-development.md`](docs/app-development.md).

## Estrutura do projeto

```text
index.html          Entrada do WebOS
apps/               Aplicações autónomas, manifests e registry.json
assets/             Recursos partilhados
docs/               Guias de desenvolvimento
system/js/          Shell, janelas, filesystem e serviços
system/sdk/         APIs para aplicações sandboxed
tests/              Validação de manifests, smoke tests e i18n
```

## Licença

Este repositório não contém atualmente um ficheiro de licença. Até ser adicionada uma licença, não assumas que o código pode ser reutilizado, redistribuído ou modificado fora dos direitos concedidos pela legislação aplicável.