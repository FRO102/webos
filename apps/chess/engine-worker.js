// Este worker apenas carrega o Stockfish e atua como ponte de mensagens.
self.importScripts('engine/stockfish-18-lite-single.js');

// O Stockfish expõe uma função global `Stockfish()` quando carregado via importScripts.
let engine = null;

self.onmessage = function (e) {
  const msg = e.data;
  
  // A primeira mensagem deve ser "init" para criar a instância do motor.
  if (msg === 'init') {
    try {
      engine = Stockfish();
      engine.onmessage = function (line) {
        // Reencaminha cada linha de output do motor para o thread principal.
        self.postMessage(line);
      };
      self.postMessage('ready'); // Sinaliza que o motor está pronto.
    } catch (err) {
      self.postMessage('error:' + err.message);
    }
    return;
  }

  // Todas as outras mensagens são comandos UCI para o motor.
  if (engine) {
    engine.postMessage(msg);
  }
};