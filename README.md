# WebOS

WebOS é um simulador de sistema operativo que corre inteiramente no browser. Inclui ambiente de trabalho, janelas, áreas de trabalho virtuais, Menu Iniciar, filesystem virtual, definições, notificações e aplicações isoladas. É construído com HTML, CSS e JavaScript, sem backend nem processo de build obrigatório.

## Requisitos

- Um navegador moderno, preferencialmente Chrome ou Edge.
- Node.js para executar os testes.
- Um servidor HTTP local para servir o projeto. Não abras `index.html` com `file://`: o shell usa ES Modules e aplicações em iframe.

## Executar

Na raiz do projeto, inicia um dos servidores seguintes:

```powershell
# PHP
php -S localhost:8000

# Python
python -m http.server 8000
```

Também podes usar Five Server no VS Code. Abre depois o endereço correspondente, por exemplo `http://localhost:8000`.

O carregador descobre automaticamente cada app pela listagem HTTP de `apps/` e lê o respetivo `manifest.json`. Para adicionar uma app, basta criar a pasta `apps/<id>/` com o código e o manifest. O servidor tem de expor listagem de diretórios em `apps/`; sem essa capacidade, um browser não consegue enumerar as pastas num site estático.

## Aplicações incluídas

O projeto inclui apps de sistema e ferramentas como Calculadora, Calendário, Relógio, Ficheiros, Bloco de Notas, Imagens, Leitor Multimédia, Snake, Despesas, Diagramas, Conversor de Unidades, Códigos QR, Paleta de Cores e Backup e Restauro. Os manifests e respetivos pontos de entrada estão nas pastas de [`apps/`](apps/).

O sistema suporta Português (`pt-PT`) e Inglês (`en`). A seleção é guardada nas Definições, atualiza o shell e é propagada às apps abertas; textos sem tradução mantêm o original. As apps podem usar `os.i18n` para traduções próprias e formatação regional.

## Testes e validação

Executa na raiz do projeto:

```powershell
node .\tests\validate-manifests.mjs
node .\tests\smoke.mjs
node .\tests\i18n.mjs
```

Para verificar a sintaxe de todos os scripts JavaScript:

```powershell
Get-ChildItem -Path . -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Estrutura

- `index.html`: ponto de entrada do shell.
- `system/js/`: arranque, janelas, desktop, Menu Iniciar, filesystem e restantes serviços do shell.
- `system/sdk/`: API usada pelas apps dentro dos seus iframes sandbox.
- `apps/<id>/`: aplicações autónomas, cada uma com manifest, HTML, JavaScript, CSS e assets próprios.
- `assets/`: recursos partilhados do shell.
- `docs/`: documentação de desenvolvimento.
- `tests/`: validação de manifests e smoke tests.

## Criar uma aplicação

1. Cria `apps/<id>/` com `manifest.json`, `index.html`, `app.js`, `style.css` e um ícone SVG.
2. Inclui `../../system/sdk/os-sdk.js` antes do JavaScript da app; usa scripts clássicos, não ES Modules.
3. Declara no manifest apenas as permissões necessárias e mantém os ficheiros próprios dentro da pasta da app.
4. Confirma que o servidor permite listar o conteúdo de `apps/`; não é necessário registar a app noutro ficheiro.
5. Consulta [`docs/app-development.md`](docs/app-development.md) para o formato do manifest, APIs, dados e filesystem virtual.
6. Executa os três testes acima e testa a app pelo shell, não apenas abrindo o HTML isoladamente.

As apps usam `os.storage` para dados privados, `os.settings` para preferências globais e `os.fs` para documentos do utilizador. A app Backup e Restauro pode exportar e restaurar os dados suportados do perfil ativo.

## Atalhos

- **Alt+Q**: alternar entre janelas; mantém Alt e repete Q. Shift inverte a direção. O browser reserva Alt+Tab ao sistema operativo.
- **Alt+←/→**: encaixar a janela ativa; **Alt+↑** maximiza; **Alt+↓** repõe o tamanho anterior.
- **Esc**: fechar menus e o alternador de janelas.
- **Ctrl+S**: guardar no Bloco de Notas e em apps com suporte de gravação.
- **Tab**: completar comandos no Terminal.
- Menu Iniciar → **Terminar sessão** volta ao ecrã de login; **Reiniciar** volta ao arranque.
