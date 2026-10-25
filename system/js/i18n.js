import { bus } from './event-bus.js';
import { getSettings } from './settings.js';

const translations = {
  'Ambiente de trabalho': 'Desktop', 'Lixeira': 'Trash', 'Pasta pessoal': 'Home', 'Aplicações': 'Applications',
  'Navegador': 'Browser', 'Portefolio Terminal': 'Portfolio Terminal', 'Snake': 'Snake', 'Menu Iniciar': 'Start menu',
  'Janelas abertas': 'Open windows', 'Áreas de trabalho': 'Workspaces', 'Centro de notificações': 'Notifications center',
  'Relógio e calendário': 'Clock and calendar', 'Rede ligada': 'Network connected', 'Som ligado': 'Sound on',
  'Som desligado': 'Sound off', 'Bloquear': 'Lock', 'Terminar sessão': 'Sign out', 'Reiniciar': 'Restart',
  'Fechar janelas': 'Close windows', 'Pesquisar apps': 'Search apps', 'Nenhuma app encontrada.': 'No apps found.',
  'Minimizar': 'Minimize', 'Maximizar': 'Maximize', 'Fechar': 'Close', 'Restaurar': 'Restore',
  'Repor tamanho': 'Restore size', 'Fechar janela': 'Close window', 'Atualizar desktop': 'Refresh desktop',
  'Abrir Pasta pessoal': 'Open Home', 'Abrir Lixeira': 'Open Trash', 'Abrir lixeira': 'Open Trash',
  'Definições': 'Settings', 'Definições do sistema': 'System settings', 'Personaliza a aparência do teu WebOS.': 'Customize the appearance of your WebOS.',
  'Tema': 'Theme', 'Tema do sistema': 'System theme', 'Claro': 'Light', 'Escuro': 'Dark',
  'Cor de destaque': 'Accent color', 'Cores de destaque': 'Accent colors', 'Cor personalizada': 'Custom color',
  'Papel de parede': 'Wallpaper', 'Papéis de parede': 'Wallpapers', 'Sistema': 'System',
  'Enviar notificação de teste': 'Send test notification', 'Repor predefinições': 'Reset to defaults',
  'Acessibilidade': 'Accessibility', 'Tamanho do texto': 'Text size', 'Animações': 'Animations', 'Sons': 'Sounds',
  'Idioma': 'Language', 'Português': 'Portuguese', 'Inglês': 'English', 'English': 'English',
  'Esta é uma notificação de teste.': 'This is a test notification.', 'Idioma atualizado.': 'Language updated.',
  'Ficheiros': 'Files', 'Ficheiro': 'File', 'Nova pasta': 'New folder', 'Novo ficheiro': 'New file',
  'Pesquisar nesta pasta': 'Search this folder', 'Ordenar ficheiros': 'Sort files', 'Nenhum ficheiro corresponde à pesquisa.': 'No files match your search.',
  'Tipo': 'Type', 'Substituir ficheiro?': 'Replace file?',
  'Sistema e ficheiros': 'System and files', 'Produtividade': 'Productivity', 'Internet e informação': 'Internet and information',
  'Multimédia': 'Media', 'Criação e desenvolvimento': 'Creation and development', 'Utilitários': 'Utilities', 'Jogos': 'Games',
  'Outras': 'Other', 'Recentes': 'Recent', 'Todas as categorias': 'All categories',
  'Atualizar': 'Refresh', 'Importar': 'Import', 'Exportar': 'Export', 'Mover/Renomear': 'Move/Rename',
  'Apagar': 'Delete', 'Esvaziar lixeira': 'Empty trash', 'Pasta acima': 'Parent folder', 'Caminho': 'Path',
  'Locais': 'Locations', 'Desktop': 'Desktop', 'Documentos': 'Documents', 'Imagens': 'Pictures',
  'Música': 'Music', 'Vídeos': 'Videos', 'Downloads': 'Downloads', 'Tamanho': 'Size', 'Modificado': 'Modified',
  'Esta pasta está vazia.': 'This folder is empty.', 'Nome da nova pasta:': 'New folder name:',
  'Nome do ficheiro:': 'File name:', 'Selecionar backup JSON': 'Select JSON backup',
  'Backup e Restauro': 'Backup and Restore', 'Exportar backup': 'Export backup', 'Validar e restaurar': 'Validate and restore',
  'Calculadora': 'Calculator', 'Calendário': 'Calendar', 'Relógio': 'Clock', 'Códigos QR': 'QR Codes',
  'Conversor de Unidades': 'Unit Converter', 'Despesas': 'Expenses', 'Diagramas': 'Diagrams',
  'Gestor de Downloads': 'Download Manager', 'Leitor Multimédia': 'Media Player', 'Bloco de Notas': 'Notepad',
  'Paleta de Cores': 'Color Palette', 'Definições': 'Settings', 'Gestor de Tarefas': 'Task Manager',
  'Terminal': 'Terminal', 'Pesquisar aplicações': 'Search applications', 'Abrir': 'Open',
  'Ecrã': 'Display', 'Ativar ecrã inteiro': 'Enter full screen', 'Sair do ecrã inteiro': 'Exit full screen',
  'O WebOS está em ecrã inteiro. Usa Esc para sair.': 'WebOS is in full screen. Press Esc to exit.',
  'O browser pode exigir confirmação para entrar em ecrã inteiro.': 'Your browser may ask you to confirm full screen.',
  'Explorar na Web': 'Explore the Web', 'Atalhos para páginas com versões preparadas para abrir dentro de frames.': 'Shortcuts to pages designed to open inside frames.',
  'Sites incorporáveis': 'Embeddable sites', 'Mapa · OpenStreetMap': 'Map · OpenStreetMap',
  'Serviços gratuitos para programadores': 'Free services for developers',
  'Estatísticas mundiais em tempo real': 'Real-time world statistics', 'Planeamento e notas': 'Planning and notes',
  'A disponibilidade e algumas funções dependem do site. Podes também introduzir qualquer endereço na barra acima.': 'Availability and some features depend on the site. You can also enter any address above.',
  'Recuar': 'Back', 'Avançar': 'Forward', 'Recarregar': 'Reload', 'Início': 'Home', 'Endereço': 'Address',
  'Ligar formas': 'Connect shapes', 'Cancelar ligação': 'Cancel connection', 'Editar forma': 'Edit shape',
  'Editar ligação': 'Edit connection', 'Inverter': 'Reverse', 'Guardar': 'Save', 'Guardar como': 'Save as',
  'Novo diagrama': 'New diagram', 'Nenhuma seleção': 'Nothing selected', 'Ligação criada.': 'Connection created.',
  'Clique na forma de origem da ligação.': 'Click the connection source shape.',
  'Arraste as formas para organizar. Para ligar, clique em “Ligar formas”, escolha a origem e depois o destino. A seta segue essa ordem.': 'Drag shapes to arrange them. To connect, click “Connect shapes”, choose the source, then the destination. The arrow follows that order.',
  'Título do diagrama': 'Diagram title', 'Início': 'Start', 'Processo': 'Process', 'Decisão?': 'Decision?', 'Fim': 'End',
  'Novo diagrama': 'New diagram', 'Guardar diagrama': 'Save diagram', 'Abrir diagrama': 'Open diagram',
  'A carregar… (alguns sites bloqueiam a incorporação)': 'Loading… (some sites block embedding)',
  'Estado do sistema': 'System status', 'Utilizadores': 'Users', 'Sessão bloqueada': 'Session locked',
  'Falha ao iniciar o sistema.': 'System startup failed.', 'Vê a consola e confirma que estás a usar um servidor local.': 'Check the console and make sure you are using a local server.',
  'Notificações': 'Notifications', 'Limpar notificações': 'Clear notifications', 'Limpar': 'Clear',
  'Nenhuma notificação.': 'No notifications.', 'não lidas': 'unread', 'Cor': 'Color',
  'Aurora': 'Aurora', 'Crepúsculo': 'Twilight', 'Floresta': 'Forest', 'Grafite': 'Graphite', 'Papel': 'Paper',
  'Ocorreu um erro. Tenta novamente.': 'An error occurred. Please try again.',
  'A processar…': 'Processing…', 'A guardar…': 'Saving…', 'A preparar o backup…': 'Preparing backup…',
  'Seleciona um item primeiro.': 'Select an item first.', 'Seleciona um ficheiro primeiro.': 'Select a file first.',
  'Seleciona um item da lixeira.': 'Select an item in the Trash.', 'Esta pasta está vazia.': 'This folder is empty.',
  'Indica um nome de pasta válido, sem separadores de caminho.': 'Enter a valid folder name without path separators.',
  'Indica um nome de ficheiro válido, sem separadores de caminho.': 'Enter a valid file name without path separators.',
  'Já existe:': 'Already exists:', 'A pasta não existe:': 'Folder does not exist:', 'Não é uma pasta:': 'Not a folder:',
  'Não existe:': 'Does not exist:', 'Ficheiro não encontrado:': 'File not found:', 'Caminho inválido.': 'Invalid path.',
  'Não é possível apagar a raiz.': 'The root folder cannot be deleted.', 'Movimento inválido.': 'Invalid move.',
  'Ocorreu um erro.': 'An error occurred.', 'Idioma inválido.': 'Invalid language.',
  'Já existe uma categoria com esse nome.': 'A category with that name already exists.',
  'Apagar seleção': 'Delete selection', 'Apagar ligação': 'Delete connection',
  'Alterações por guardar': 'Unsaved changes', 'Descartar': 'Discard', 'Cancelar': 'Cancel',
  'Guardar alterações': 'Save changes', 'Esta ação não pode ser anulada.': 'This action cannot be undone.',
  'Nome': 'Name', 'Descrição': 'Description', 'Categoria': 'Category', 'Valor': 'Amount',
  'Data': 'Date', 'Hora': 'Time', 'Pesquisar': 'Search', 'Guardar': 'Save', 'Cancelar': 'Cancel',
  'Adicionar': 'Add', 'Editar': 'Edit', 'Remover': 'Remove', 'Confirmar': 'Confirm', 'Concluir': 'Done',
  'Anterior': 'Previous', 'Seguinte': 'Next', 'Hoje': 'Today', 'Semana': 'Week', 'Mês': 'Month', 'Ano': 'Year',
  'Começar': 'Start', 'Pausar': 'Pause', 'Continuar': 'Continue', 'Reiniciar': 'Restart', 'Pontuação': 'Score',
  'Recorde': 'Best', 'Jogar': 'Play', 'Novo jogo': 'New game', 'Perder': 'Lose', 'Ganhar': 'Win',
  'Copiar': 'Copy', 'Colar': 'Paste', 'Desfazer': 'Undo', 'Refazer': 'Redo', 'Selecionar ficheiro': 'Choose file',
  'Arraste um ficheiro para aqui': 'Drag a file here', 'Nenhum ficheiro selecionado': 'No file selected',
  'Ficheiro guardado.': 'File saved.', 'Guardado.': 'Saved.', 'Carregado.': 'Loaded.', 'Erro': 'Error', 'Sucesso': 'Success',
  'Início': 'Start', 'Processo': 'Process', 'Decisão?': 'Decision?', 'Fim': 'End',
  'Ligação cancelada.': 'Connection cancelled.', 'Escolha outra forma como destino.': 'Choose another shape as the destination.',
  'Estas formas já estão ligadas nessa direção. Escolha outra forma.': 'These shapes are already connected in that direction. Choose another shape.',
  'Selecione duas formas para criar uma ligação.': 'Select two shapes to create a connection.',
  'Origem:': 'Source:', 'Agora clique na forma de destino.': 'Now click the destination shape.',
  'Editar forma': 'Edit shape', 'Texto apresentado na forma:': 'Text shown in the shape:',
  'Editar ligação': 'Edit connection', 'Rótulo da ligação (deixa vazio para remover):': 'Connection label (leave blank to remove):',
  'Inverter a direção da ligação': 'Reverse connection direction', 'Ligação selecionada': 'Connection selected',
  'formas selecionadas': 'shapes selected', 'forma selecionada': 'shape selected',
  'PROCESSO': 'PROCESS', 'DOCUMENTO': 'DOCUMENT', 'Adicionar forma': 'Add shape',
  'Abrir ficheiro': 'Open file', 'Guardar ficheiro': 'Save file', 'Abrir diagrama': 'Open diagram',
  'Título do diagrama': 'Diagram title', 'Diagrama sem título': 'Untitled diagram', 'Novo diagrama': 'New diagram',
  'Aplicação': 'Application', 'Permissão em falta:': 'Missing permission:',
  'A aplicação só pode aceder à pasta do utilizador.': 'The app can only access the user folder.',
  'Não existe um perfil ativo.': 'There is no active profile.', 'Utilizador não encontrado.': 'User not found.',
  'Indica um nome para o utilizador.': 'Enter a user name.', 'Esse utilizador já existe.': 'That user already exists.',
  'Lixeira': 'Trash', 'Pasta pessoal': 'Home', 'Início': 'Start',
  'Página inicial': 'Home page', 'Explorar na Web': 'Explore the Web',
  'A app não encontrou ficheiros.': 'The app could not find any files.',
  'Nenhum resultado encontrado.': 'No results found.', 'Sem resultados.': 'No results.',
  'Todos': 'All', 'Entrada': 'Income', 'Despesa': 'Expense', 'Total': 'Total', 'Saldo': 'Balance',
  'Nova despesa': 'New expense', 'Nova entrada': 'New income', 'Apagar movimento': 'Delete transaction',
  'Cada campo é obrigatório.': 'Every field is required.', 'Já existe um movimento igual.': 'A matching transaction already exists.',
  'Iniciar': 'Start', 'Processo': 'Process', 'Decisão': 'Decision', 'Fim': 'End',
  'A iniciar…': 'Starting…', 'A carregar…': 'Loading…', 'A guardar…': 'Saving…', 'A apagar…': 'Deleting…',
  'Ficheiro não suportado.': 'Unsupported file.', 'Formato inválido.': 'Invalid format.',
  'O ficheiro não é válido.': 'The file is invalid.', 'A operação falhou.': 'The operation failed.',
  'Não foi possível guardar.': 'Could not save.', 'Não foi possível carregar.': 'Could not load.',
  'Minutos': 'Minutes', 'Segundos': 'Seconds', 'Volume': 'Volume', 'Velocidade': 'Speed',
  'Comprimento': 'Length', 'Massa': 'Mass', 'Temperatura': 'Temperature', 'Moeda': 'Currency',
  'Mês anterior': 'Previous month', 'Mês seguinte': 'Next month', 'Seg': 'Mon', 'Ter': 'Tue', 'Qua': 'Wed', 'Qui': 'Thu', 'Sex': 'Fri', 'Sáb': 'Sat', 'Dom': 'Sun',
  'Dia selecionado:': 'Selected day:', 'Cronómetro': 'Stopwatch', 'Temporizador': 'Timer', 'Secções': 'Sections',
  'Relógio analógico': 'Analog clock', 'Horas no mundo': 'World times', 'Novo evento ou nota': 'New event or note',
  'Texto do evento': 'Event text', 'Apagar evento': 'Delete event', 'Sem eventos neste dia.': 'No events on this day.',
  'Volta': 'Lap', 'Repor': 'Reset', 'Min / Seg': 'Min / Sec', 'O temporizador terminou.': 'The timer has finished.',
  'FERRAMENTAS': 'TOOLS', 'Gerador de códigos QR': 'QR code generator', 'Tipo de conteúdo': 'Content type',
  'Conteúdo do código': 'Code content', 'Escreve ou cola o texto': 'Type or paste text', 'Correção de erro': 'Error correction',
  'Baixa': 'Low', 'Média': 'Medium', 'Alta': 'High', 'Muito alta': 'Very high', 'O código aparece aqui': 'The code will appear here',
  'Guardar PNG': 'Save PNG', 'Guardar no WebOS': 'Save to WebOS', 'Geração local, sem envio dos dados.': 'Generated locally; no data is sent.',
  'Indica um endereço http, https ou mailto.': 'Enter an http, https, or mailto address.',
  'Conteúdo demasiado longo para este nível de correção. Reduz o texto ou escolhe correção baixa.': 'Content is too long for this error-correction level. Shorten it or choose low correction.',
  'Não foi possível gerar o código QR.': 'Could not generate the QR code.',
  'Área': 'Area', 'Dados': 'Data', 'Metro': 'Meter', 'Quilómetro': 'Kilometer', 'Centímetro': 'Centimeter', 'Milímetro': 'Millimeter',
  'Milha': 'Mile', 'Jarda': 'Yard', 'Pé': 'Foot', 'Polegada': 'Inch', 'Quilograma': 'Kilogram', 'Grama': 'Gram', 'Miligrama': 'Milligram',
  'Tonelada': 'Metric ton', 'Libra': 'Pound', 'Onça': 'Ounce', 'Metro quadrado': 'Square meter', 'Quilómetro quadrado': 'Square kilometer',
  'Centímetro quadrado': 'Square centimeter', 'Hectare': 'Hectare', 'Galão (EUA)': 'Gallon (US)', 'Chávena (EUA)': 'Cup (US)', 'Pinta (EUA)': 'Pint (US)',
  'Conversões rápidas': 'Quick conversions', 'Conversões para as reutilizar rapidamente': 'Save conversions to reuse them quickly.',
  'Recentes': 'Recent', 'As conversões recentes aparecem aqui.': 'Recent conversions will appear here.', 'Os valores são calculados localmente.': 'Values are calculated locally.',
  'Conversão guardada nos favoritos.': 'Conversion saved to favorites.', 'FINANÇAS PESSOAIS': 'PERSONAL FINANCE', 'Saldo do mês': 'Monthly balance',
  'Entradas menos despesas': 'Income minus expenses', 'Orçamento mensal': 'Monthly budget', 'Sem limite definido': 'No limit set',
  'Movimento diário': 'Daily activity', 'Por categoria': 'By category', 'Resumo do mês': 'Monthly summary', 'Gráficos do mês': 'Monthly charts',
  'REGISTO': 'LEDGER', 'Movimentos': 'Transactions', 'Sem movimentos neste mês. Adiciona o primeiro acima.': 'No transactions this month. Add your first above.',
  'Casa': 'Housing', 'Alimentação': 'Food', 'Transportes': 'Transport', 'Saúde': 'Health', 'Lazer': 'Leisure', 'Compras': 'Shopping', 'Serviços': 'Services', 'Outros': 'Other',
  'Salário': 'Salary', 'Investimentos': 'Investments', 'Reembolso': 'Refund', 'Sem dados neste mês': 'No data this month',
  'CSV inválido: são necessárias colunas para data, tipo, descrição, categoria e valor.': 'Invalid CSV: date, type, description, category, and amount columns are required.',
  'Importação cancelada.': 'Import canceled.', 'Não foi possível guardar os dados.': 'Could not save the data.', 'Não foi possível carregar os dados guardados.': 'Could not load saved data.',
  'Clique aqui, depois na forma de origem e na forma de destino': 'Click here, then choose the source shape and destination shape',
  'Editar a forma selecionada': 'Edit selected shape', 'Editar o rótulo da ligação': 'Edit connection label', 'Apagar seleções': 'Delete selection',
  'Área do diagrama': 'Diagram area', '.flow · formato de texto editável': '.flow · editable text format',
  'Versão ou cabeçalho .flow não suportado.': 'Unsupported .flow version or header.', 'Diagrama carregado.': 'Diagram loaded.',
  'Limpar histórico': 'Clear history', 'Nenhum download registado.': 'No downloads recorded.', 'Atualizar pasta': 'Refresh folder',
  'Mover para a lixeira': 'Move to Trash', 'Abre a lixeira para a esvaziar.': 'Open Trash to empty it.', 'Apagar permanentemente todos os itens?': 'Permanently delete all items?',
  'Novo nome ou caminho completo:': 'New name or full path:', 'Sem imagens nesta pasta. Usa "Importar…" para adicionar.': 'No images in this folder. Use “Import…” to add some.',
  'Ajustar': 'Fit', 'Novo': 'New', 'Abrir…': 'Open…', 'Sem título': 'Untitled', 'Descartar as alterações por guardar?': 'Discard unsaved changes?',
  'ESTÚDIO DE COR': 'COLOR STUDIO', 'Pré-visualização da cor': 'Color preview', 'Cor selecionada': 'Selected color', 'Copiar código HEX': 'Copy HEX code',
  'Escolher cor': 'Choose color', 'Aleatória': 'Random', 'Canais de cor': 'Color channels', 'Contraste WCAG': 'WCAG contrast', 'Texto sobre branco e preto': 'Text on white and black',
  'AA grande': 'Large text AA', 'Insuficiente': 'Fail', 'Coleções': 'Collections', 'Favoritos': 'Favorites', 'Guardar cor atual': 'Save current color',
  'Renomear coleção': 'Rename collection', 'Esta coleção ainda não tem cores.': 'This collection has no colors yet.', 'Código HEX inválido.': 'Invalid HEX code.',
  'A cópia não está disponível.': 'Copy is unavailable.', 'Esta cor já existe na coleção.': 'This color is already in the collection.', 'Mantém pelo menos uma coleção.': 'Keep at least one collection.',
  'Jogo Snake': 'Snake game', 'Setas/WASD · Espaço pausa': 'Arrow keys/WASD · Space pauses', 'A carregar...': 'Loading...', 'Nenhuma janela aberta.': 'No open windows.',
  'Aplicação': 'Application', 'Área': 'Workspace', 'Estado': 'Status', 'Ações': 'Actions', 'Focar': 'Focus', 'Minimizada': 'Minimized', 'Maximizada': 'Maximized', 'Ativa': 'Active',
  'Comando': 'Command', 'Comandos:': 'Commands:', 'Atalhos: Tab completa, ↑/↓ histórico, Ctrl+L limpa.': 'Shortcuts: Tab completes, ↑/↓ history, Ctrl+L clears.',
  'lista ficheiros': 'list files', 'muda de pasta': 'change directory', 'pasta atual': 'current directory', 'mostra ficheiros': 'display files',
  'primeiras linhas / últimas linhas': 'first lines / last lines', 'pesquisa ficheiros': 'search files', 'cria pastas / cria ficheiros vazios': 'create directories / create empty files',
  'apaga': 'delete', 'move/renomeia': 'move/rename', 'copia ficheiros': 'copy files', 'restaura da Lixeira': 'restore from Trash',
  'abre na app certa': 'open in the appropriate app', 'lista janelas / lista aplicações': 'list windows / list apps', 'nenhum resultado.': 'no results.',
  'indica um ficheiro.': 'specify a file.', 'não é uma pasta': 'is not a directory', 'é uma pasta (usa cd).': 'is a directory (use cd).',
  'só copia ficheiros.': 'files only.', 'falta o ficheiro de destino.': 'destination file is missing.',
  'PROTEÇÃO DE DADOS': 'DATA PROTECTION', 'Guarda uma cópia portátil do teu ambiente WebOS.': 'Save a portable copy of your WebOS environment.',
  'Criar backup': 'Create backup', 'JSON · guardado no teu dispositivo': 'JSON · saved on your device',
  'Inclui as definições do sistema, os dados privados das aplicações e os ficheiros da pasta pessoal ativa.': 'Includes system settings, private app data, and files in the active home folder.',
  'Requer confirmação': 'Confirmation required', 'Fica fora do backup': 'Not included in the backup',
  'Perfis de utilizador, histórico de notificações, registos de diagnóstico e estado temporário de sessão.': 'User profiles, notification history, diagnostic logs, and temporary session state.',
  'Backup inválido.': 'Invalid backup.', 'O backup está incompleto ou mal formado.': 'The backup is incomplete or malformed.', 'O backup excede o limite de registos.': 'The backup exceeds the record limit.',
  'Substituir dados do perfil?': 'Replace profile data?', 'Restauro concluído.': 'Restore complete.', 'Página': 'Page',
  'Calculadora': 'Calculator', 'Calendário': 'Calendar', 'Relógio': 'Clock', 'Códigos QR': 'QR Codes',
  'Conversor de Unidades': 'Unit Converter', 'Despesas': 'Expenses', 'Diagramas': 'Diagrams',
  'Gestor de Downloads': 'Download Manager', 'Leitor Multimédia': 'Media Player', 'Bloco de Notas': 'Notepad',
  'Paleta de Cores': 'Color Palette', 'Definições': 'Settings', 'Gestor de Tarefas': 'Task Manager',
  'Terminal': 'Terminal', 'Backup e Restauro': 'Backup and Restore', 'Ficheiros': 'Files',
  'Portefolio Terminal': 'Portfolio Terminal', 'Aplicações': 'Applications', 'Navegador': 'Browser',
};
const sourceText = new WeakMap(), sourceAttributes = new WeakMap();

export const localeFor = language => language === 'en' ? 'en-GB' : 'pt-PT';
export const translate = (text, language = getSettings().language) => {
  if (language !== 'en') return text;
  if (translations[text]) return translations[text];
  const count = text.match(/^(\d+) (item|itens|forma|formas|aplicação|aplicações|ficheiro|ficheiros|registo|registos)$/i);
  if (count) {
    const labels = { item: 'item', itens: 'items', forma: 'shape', formas: 'shapes', aplicação: 'application', aplicações: 'applications', ficheiro: 'file', ficheiros: 'files', registo: 'record', registos: 'records' };
    return `${count[1]} ${labels[count[2].toLowerCase()]}`;
  }
  const windows = text.match(/^(\d+) janelas? abertas?$/i);
  if (windows) return `${windows[1]} open window${windows[1] === '1' ? '' : 's'}`;
  const workspace = text.match(/^Área (\d+)$/);
  if (workspace) return `Workspace ${workspace[1]}`;
  const day = text.match(/^Dia selecionado: (\d+) de (.+)$/);
  if (day) return `Selected day: ${day[1]} ${day[2]}`;
  const connectionSource = text.match(/^Origem: (.+)\. Agora clique na forma de destino\.$/);
  if (connectionSource) return `Source: ${connectionSource[1]}. Now click the destination shape.`;
  if (text.startsWith('Cor #')) return text.replace(/^Cor #/, 'Color #');
  if (text.startsWith('Ligação selecionada')) return text.replace(/^Ligação selecionada/, 'Connection selected');
  if (text.startsWith('Ligação criada: ')) return text.replace(/^Ligação criada: /, 'Connection created: ');
  if (text.startsWith('Ligação entre ')) return text.replace(/^Ligação entre /, 'Connection between ');
  if (text.startsWith('Restauro concluído: ')) return text.replace(/^Restauro concluído: /, 'Restore complete: ');
  if (text.startsWith('Restauro concluído')) return text.replace(/^Restauro concluído/, 'Restore complete');
  if (text.startsWith('Backup exportado: ')) return text.replace(/^Backup exportado: /, 'Backup exported: ');
  if (text.startsWith('Imagem guardada em ')) return text.replace(/^Imagem guardada em /, 'Image saved to ');
  if (text.startsWith('Importação concluída: ')) return text.replace(/^Importação concluída: /, 'Import complete: ');
  if (text.startsWith('Código ')) return text.replace(/^Código /, 'Code ');
  if (text.startsWith('Ligação ')) return text.replace(/^Ligação /, 'Connection ');
  if (text.startsWith('Guardado em ')) return text.replace(/^Guardado em /, 'Saved to ');
  if (text.startsWith('A abrir ')) return text.replace(/^A abrir /, 'Opening ');
  if (text.startsWith('A pasta não existe: ')) return text.replace(/^A pasta não existe: /, 'Folder does not exist: ');
  if (text.startsWith('Não é uma pasta: ')) return text.replace(/^Não é uma pasta: /, 'Not a folder: ');
  if (text.startsWith('Não existe: ')) return text.replace(/^Não existe: /, 'Does not exist: ');
  if (text.startsWith('Já existe: ')) return text.replace(/^Já existe: /, 'Already exists: ');
  if (text.startsWith('Ficheiro não encontrado: ')) return text.replace(/^Ficheiro não encontrado: /, 'File not found: ');
  if (text.startsWith('A selecionar ')) return text.replace(/^A selecionar /, 'Selecting ');
  if (text.startsWith('Ficheiro validado: ')) return text.replace(/^Ficheiro validado: /, 'File validated: ');
  if (text.startsWith('Sem limite definido')) return 'No budget limit set';
  if (text.startsWith('Sem eventos neste dia')) return 'No events on this day.';
  if (text.startsWith('Erro: ')) return text.replace(/^Erro: /, 'Error: ');
  if (text.startsWith('Não foi possível ')) return text.replace(/^Não foi possível /, 'Could not ');
  return text;
};
export const localeData = () => ({ language: getSettings().language, locale: localeFor(getSettings().language), translations });

function translateElement(root, language) {
  const view = root.ownerDocument?.defaultView ?? globalThis;
  const walker = root.ownerDocument?.createTreeWalker(root, view.NodeFilter.SHOW_TEXT);
  if (walker) {
    let textNode;
    while ((textNode = walker.nextNode())) translateTextNode(textNode, language);
  }
  const elements = [root, ...(root.querySelectorAll?.('*') ?? [])];
  for (const element of elements) {
    for (const attribute of ['aria-label', 'aria-placeholder', 'placeholder', 'title']) {
      const current = element.getAttribute?.(attribute);
      if (!current) continue;
      const attributes = sourceAttributes.get(element) ?? {};
      const state = attributes[attribute];
      const source = state && current === state.rendered ? state.source : current;
      const translated = translate(source, language);
      attributes[attribute] = { source, rendered: translated };
      sourceAttributes.set(element, attributes);
      if (current !== translated) element.setAttribute(attribute, translated);
    }
  }
  root.lang = language === 'en' ? 'en' : 'pt-PT';
}

function translateTextNode(textNode, language) {
  const current = textNode.nodeValue;
  const state = sourceText.get(textNode);
  const original = state && current === state.rendered ? state.source : current;
  const trimmed = original.trim();
  if (!trimmed) return;
  const translated = translate(trimmed, language);
  const value = original.replace(trimmed, translated);
  sourceText.set(textNode, { source: original, rendered: value });
  if (textNode.nodeValue !== value) textNode.nodeValue = value;
}

export function initLocalization() {
  translateElement(document.documentElement, getSettings().language);
  let pending = false;
  const observer = new MutationObserver(records => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      for (const record of records) {
        if (record.type === 'characterData') translateTextNode(record.target, getSettings().language);
        else for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) translateElement(node, getSettings().language);
      }
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  bus.on('settings:changed', settings => {
    translateElement(document.documentElement, settings.language);
    bus.emit('locale:changed', localeData());
  });
}