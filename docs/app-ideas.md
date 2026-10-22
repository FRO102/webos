# Ideias para aplicações

Propostas para expandir o WebOS sem duplicar as aplicações que já existem. Cada ideia pode ser implementada como uma pasta autónoma em `apps/<id>/`.

## Para o dia a dia

- **Pomodoro** (`pomodoro`): ciclos de foco e pausa, tarefas da sessão, histórico e notificações no fim de cada ciclo. Usa `os.storage` e a permissão `notifications`.
- **Controlo de despesas** (`despesas`): registo de entradas e despesas, categorias, orçamento mensal e gráficos. Guarda os dados com `os.storage`; pode exportar/importar CSV através do filesystem virtual.
- **Hábitos** (`habitos`): objetivos recorrentes, registo diário e sequências, com vista semanal e mensal. Os dados ficam no armazenamento privado da app.
- **Quadro Kanban** (`kanban`): colunas e cartões reorganizáveis para projetos pessoais. Guarda vários quadros com `os.storage` e pode abrir ou guardar ficheiros próprios com os diálogos do SDK.

## Para aprender e criar

- **Cartões de estudo** (`flashcards`): baralhos, repetição espaçada, sessões de revisão e estatísticas de progresso. Os baralhos podem ser guardados no filesystem virtual.
- **Mapa mental** (`mapa-mental`): editor visual de nós e ligações, com gravação de mapas e atalhos de teclado. Pode usar `os.storage` ou ficheiros próprios.
- **Editor de diagramas** (`diagramas`): criação de fluxogramas e diagramas simples, com exportação para um formato de texto legível e editável.
- **Receitas** (`receitas`): coleção pesquisável com ingredientes, instruções, etiquetas e ajuste das quantidades ao número de pessoas. Pode associar receitas a ficheiros guardados pelo utilizador.

## Pequenas ferramentas

- **Conversor de unidades** (`conversor`): conversões de comprimento, massa, temperatura, área, volume e dados, com favoritos e histórico recente.
- **Gerador de códigos QR** (`codigos-qr`): cria códigos QR para texto e URLs, com pré-visualização e opção para guardar a imagem. Não precisa de integração com o shell.
- **Paleta de cores** (`paletas`): escolha de cores, conversão entre HEX/RGB/HSL, verificação de contraste e coleções guardadas.
- **Contactos** (`contactos`): lista de contactos, pesquisa e importação/exportação de vCard. A app pode declarar `.vcf` em `fileTypes` para abrir contactos pelo Explorador.

## Prioridade sugerida

1. **Pomodoro**: útil, pequeno e demonstra notificações e armazenamento privado.
2. **Conversor de unidades**: ferramenta rápida, sem permissões nem dependências externas.
3. **Controlo de despesas**: utilidade diária e boa oportunidade para visualizações de dados.
4. **Flashcards**: experiência distinta, com espaço para uma lógica de revisão mais rica.
5. **Quadro Kanban**: app maior, mas encaixa bem no modelo de janelas e armazenamento do WebOS.

As ideias evitam depender de serviços externos ou de alterações ao shell. Antes de implementar uma app, confirmar as APIs disponíveis em `docs/app-development.md` e declarar no manifest apenas as permissões necessárias.