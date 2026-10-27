import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  Activity,
  ArrowUp,
  Bomb,
  Crosshair,
  Recycle,
  Pause,
  Play,
  Radio,
  Shield,
  Skull,
  Target,
  TowerControl,
} from 'lucide-react';
import {
  MAPS,
  DIFFICULTIES,
  TOWERS,
  createGame,
  stepGame,
  startWave,
  placeTower,
  drawGame,
  findTowerAt,
  getTowerStats,
  sellTower,
  throwGrenade,
  setTowerTargeting,
  upgradeTower,
  GAME_WIDTH,
  GAME_HEIGHT,
  type GameState,
  type MapId,
  type DifficultyId,
  type TowerId,
  type GameInput,
} from './game-engine';
type ConfigItem = Record<string, unknown> & { id?: string; name?: string; title?: string; description?: string };
const maps = Object.entries(MAPS as unknown as Record<string, ConfigItem>);
const difficulties = Object.entries(DIFFICULTIES as unknown as Record<string, ConfigItem>);
const towers = Object.entries(TOWERS as unknown as Record<string, ConfigItem>);
const configId = (key: string, item: ConfigItem) => String(item.id ?? key);
function label(entry: ConfigItem, fallback: string) {
  return String(entry.name ?? entry.title ?? entry.label ?? fallback).replace(/[-_]/g, ' ');
}
function detail(entry: ConfigItem, fallback: string) {
  return String(entry.description ?? entry.subtitle ?? fallback);
}
function towerName(id: string, fallback: string) {
  const names: Record<string, string> = {
    watchtower: 'Torre sentinela',
    sniper: 'Atirador de elite',
    cryo: 'Torre criogénica',
  };
  return names[id] ?? fallback;
}
function mapName(id: string, fallback: string) {
  const names: Record<string, string> = {
    suburb: 'Bairro abandonado',
    dockyard: 'Cais enferrujado',
    cemetery: 'Cemitério velho',
  };
  return names[id] ?? fallback;
}
function towerDescription(id: string, fallback: string) {
  const descriptions: Record<string, string> = {
    watchtower: 'Disparos rápidos, alcance médio.',
    sniper: 'Alcance longo e dano elevado.',
    cryo: 'Abranda os zombies para ganhar tempo.',
  };
  return descriptions[id] ?? fallback;
}
function numeric(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function readNumber(state: GameState | null, keys: string[], fallback: number) {
  if (!state) return fallback;
  const source = state as unknown as Record<string, unknown>;
  for (const key of keys) {
    const found = Number(source[key]);
    if (Number.isFinite(found)) return found;
  }
  const player = source.player as Record<string, unknown> | undefined;
  if (player) for (const key of keys) {
    const found = Number(player[key]);
    if (Number.isFinite(found)) return found;
  }
  return fallback;
}
function App() {
  const [setup, setSetup] = useState(true);
  const [selectedMap, setSelectedMap] = useState(maps[0] ? configId(...maps[0]) : 'suburb');
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulties[0] ? configId(...difficulties[0]) : 'normal');
  const [selectedTower, setSelectedTower] = useState<string | null>(null);
  const [selectedPlacedTower, setSelectedPlacedTower] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const [muted, setMuted] = useState(false);
  const [frameRevision, setFrameRevision] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const selectedPlacedTowerRef = useRef<number | null>(null);
  const keysRef = useRef(new Set<string>());
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const pausedRef = useRef(false);
  const visibleRef = useRef(true);
  const gameStartedAtRef = useRef<number | null>(null);
  const waveStartRef = useRef<number | null>(null);
  const [towerTargetMode, setTowerTargetMode] = useState<'first' | 'nearest' | 'strongest' | 'weakest'>('nearest');
  const lastFrameRef = useRef(0);
  const lastUiRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const prevWaveRef = useRef(0);
  const overSoundPlayedRef = useRef(false);
  const currentMap = maps.find(([id, item]) => configId(id, item) === selectedMap)?.[1];
  const gameStatus = (game as unknown as Record<string, unknown> | null)?.status;
  const isOver = gameStatus === 'lost' || gameStatus === 'won';
  const hasWon = gameStatus === 'won';
  const health = readNumber(game, ['health', 'hp', 'playerHealth'], 100);
  const maxHealth = readNumber(game, ['maxHealth', 'maxHp', 'playerMaxHealth'], 100);
  const cash = readNumber(game, ['cash', 'money', 'credits'], 0);
  const baseLives = readNumber(game, ['baseLives'], 0);
  const maxBaseLives = readNumber(game, ['maxBaseLives'], 0);
  const wave = readNumber(game, ['wave', 'waveNumber', 'currentWave'], 0);
  const waveProgress = game && game.waveSpawned > 0
    ? Math.min(100, Math.round((game.waveSpawned / (game.waveSpawned + game.spawnRemaining)) * 100))
    : 0;
  const healthPercent = Math.max(0, Math.min(100, (health / Math.max(1, maxHealth)) * 100));
  const towerList = useMemo(() => towers.map(([key, item]) => ({
    id: configId(key, item),
    item,
    title: towerName(configId(key, item), label(item, configId(key, item))),
    cost: numeric(item.cost ?? item.price, 0),
    description: towerDescription(configId(key, item), detail(item, 'Unidade defensiva pronta a instalar.')),
  })), []);
  const towerToManage = game?.towers.find((tower) => tower.id === selectedPlacedTower) ?? null;
  const towerStats = towerToManage ? getTowerStats(towerToManage) : null;
  const ensureAudioContext = useCallback(() => {
    if (muted) return null;
    let ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') {
      try {
        ctx = new AudioContext();
        audioContextRef.current = ctx;
      } catch {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }, [muted]);
  const playBeep = useCallback((frequency: number, durationMs: number, gain = 0.04) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const amplitude = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    amplitude.gain.value = gain;
    oscillator.connect(amplitude);
    amplitude.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + durationMs / 1000);
  }, [ensureAudioContext]);
  const publishGameState = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame({ ...next });
    setFrameRevision((revision) => revision + 1);
  }, []);
  const selectPlacedTower = (id: number | null) => {
    selectedPlacedTowerRef.current = id;
    setSelectedPlacedTower(id);
  };
  const beginGame = useCallback(() => {
    const fresh = createGame(selectedMap as MapId, selectedDifficulty as DifficultyId);
    gameRef.current = fresh;
    setGame(fresh);
    setSelectedTower(null);
    selectPlacedTower(null);
    setPaused(false);
    pausedRef.current = false;
    setSetup(false);
    prevWaveRef.current = 0;
    overSoundPlayedRef.current = false;
  }, [selectedMap, selectedDifficulty]);
  const launchGrenadeAtPointer = useCallback(() => {
    const state = gameRef.current;
    if (!state || pausedRef.current) return;
    publishGameState(throwGrenade(state, mouseRef.current.x, mouseRef.current.y));
  }, [publishGameState]);
  const updatePointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouseRef.current.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  };
  const onCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    updatePointer(event);
    const placedTowerId = gameRef.current
      ? findTowerAt(gameRef.current, mouseRef.current.x, mouseRef.current.y)
      : null;
    if (placedTowerId !== null) {
      mouseRef.current.down = false;
      setSelectedTower(null);
      selectPlacedTower(placedTowerId);
      return;
    }
    if (selectedTower && gameRef.current) {
      const next = placeTower(gameRef.current, selectedTower as TowerId, mouseRef.current.x, mouseRef.current.y);
      publishGameState(next);
      setSelectedTower(null);
      selectPlacedTower(null);
      return;
    }
    selectPlacedTower(null);
    mouseRef.current.down = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const togglePause = () => {
    setPaused((value) => {
      pausedRef.current = !value;
      return !value;
    });
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' '].includes(key)) event.preventDefault();
      keysRef.current.add(key);
      if (key === 'escape' && gameRef.current) togglePause();
      if (key === 'g' && !event.repeat) launchGrenadeAtPointer();
      if (key === '1' || key === '2' || key === '3') {
        const option = towerList[Number(key) - 1];
        if (option) {
          selectPlacedTower(null);
          setSelectedTower((active) => active === option.id ? null : option.id);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    const onPointerUp = () => { mouseRef.current.down = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [towerList, launchGrenadeAtPointer]);
  useEffect(() => {
    let animation = 0;
    const tick = (time: number) => {
      animation = requestAnimationFrame(tick);
      if (document.visibilityState !== 'visible') {
        if (visibleRef.current) {
          visibleRef.current = false;
          pausedRef.current = true;
          setPaused(true);
        }
        return;
      }
      if (!visibleRef.current) {
        visibleRef.current = true;
        pausedRef.current = false;
        setPaused(false);
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const state = gameRef.current;
      if (!ctx || !canvas || !state) return;
      if (canvas.width !== GAME_WIDTH || canvas.height !== GAME_HEIGHT) {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
      }
      const elapsed = lastFrameRef.current ? Math.min(50, time - lastFrameRef.current) : 16;
      lastFrameRef.current = time;
      const input = {
        keys: keysRef.current,
        moveX: (keysRef.current.has('d') || keysRef.current.has('arrowright') ? 1 : 0) - (keysRef.current.has('a') || keysRef.current.has('arrowleft') ? 1 : 0),
        moveY: (keysRef.current.has('s') || keysRef.current.has('arrowdown') ? 1 : 0) - (keysRef.current.has('w') || keysRef.current.has('arrowup') ? 1 : 0),
        mouseX: mouseRef.current.x,
        mouseY: mouseRef.current.y,
        firing: mouseRef.current.down,
        mouseDown: mouseRef.current.down,
        aimX: mouseRef.current.x,
        aimY: mouseRef.current.y,
      } as unknown as GameInput;
       if (!pausedRef.current && !isOver) {
         const next = stepGame(state, elapsed, input);
         gameRef.current = next;
         if (time - lastUiRef.current > 100) {
           const prevWave = prevWaveRef.current;
           const newWave = next.wave;
           if (newWave > prevWave && next.status === 'active') { playBeep(440, 180); if (newWave >= 9) playBeep(660, 220, .05); prevWaveRef.current = newWave; }
           if ((next.status === 'won' || next.status === 'lost') && !overSoundPlayedRef.current) { playBeep(next.status === 'won' ? 880 : 220, 280, .06); overSoundPlayedRef.current=true; }
           lastUiRef.current = time;
           setGame(next);
           setFrameRevision((revision) => revision + 1);
         }
       }
      drawGame(ctx, gameRef.current ?? state, selectedPlacedTowerRef.current, selectedTower ? { type: selectedTower as TowerId, x: mouseRef.current.x, y: mouseRef.current.y } : null);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [isOver, playBeep, selectedTower]);

  const callStartWave = () => {
    if (!gameRef.current || isOver) return;
    publishGameState(startWave(gameRef.current));
  };
  const improveSelectedTower = () => {
    if (!gameRef.current || selectedPlacedTower === null) return;
    publishGameState(upgradeTower(gameRef.current, selectedPlacedTower));
  };
  const changeTowerTargetMode = (mode: 'first' | 'nearest' | 'strongest' | 'weakest') => {
    if (!gameRef.current || selectedPlacedTower === null) return;
    publishGameState(setTowerTargeting(gameRef.current, selectedPlacedTower, mode));
    setTowerTargetMode(mode);
  };
  const sellSelectedTower = () => {
    if (!gameRef.current || selectedPlacedTower === null || !towerToManage) return;
    publishGameState(sellTower(gameRef.current, selectedPlacedTower));
    selectPlacedTower(null);
  };
  if (setup || !game) {
    return (
      <main className="setup-wrap">
        <section className="setup-card" aria-label="Preparação do jogo">
          <div className="setup-intro">
            <div>
              <div className="brand">
                <span className="brand-mark"><Shield size={19} strokeWidth={2.5} /></span>
                <div><div className="brand-name">ZONA MORTA</div><div className="brand-sub">SISTEMA DE DEFESA DO REFÚGIO</div></div>
              </div>
              <div className="setup-title">Resiste à<br /><span>horda.</span></div>
              <p className="setup-copy">O mundo antigo acabou. Este pedaço de terra ainda é nosso. Escolhe o perímetro, define o nível de ameaça e mantém o refúgio de pé.</p>
            </div>
            <div className="setup-stamp">MANUAL DE CAMPO 01 / TURNO DA NOITE<br />SEM EVACUAÇÃO. SEM SEGUNDAS OPORTUNIDADES.</div>
          </div>
          <div className="setup-options">
            <div className="eyebrow">01 / Escolhe um setor</div>
            <div className="setup-choice-grid">
              {maps.map(([key, item], index) => {
                const id = configId(key, item);
                return <button key={id} className={`choice-button ${selectedMap === id ? 'active' : ''}`} onClick={() => setSelectedMap(id)} data-testid={`select-map-${id}`}>
                  <span className="choice-name">{mapName(id, label(item, id))}</span>
                  <span className="choice-detail">{detail(item, `Setor ${String(index + 1).padStart(2, '0')} · rota do perímetro`)}</span>
                </button>;
              })}
            </div>
            <div className="setup-group" style={{ marginTop: 27 }}>
              <div className="eyebrow">02 / Avaliação da ameaça</div>
              <div className="setup-choice-grid">
                {difficulties.map(([key, item]) => {
                  const id = configId(key, item);
                  return (
                  <button key={id} className={`choice-button ${selectedDifficulty === id ? 'active' : ''}`} onClick={() => setSelectedDifficulty(id)} data-testid={`select-difficulty-${id}`}>
                    <span className="choice-name">{label(item, id)}</span>
                    <span className="choice-detail">{detail(item, 'Perfil de infestação normal.')}</span>
                  </button>
                  );
                })}
              </div>
            </div>
            <button className="primary-action setup-start" onClick={beginGame} data-testid="button-deploy">
              <Play size={16} fill="currentColor" style={{ verticalAlign: '-3px', marginRight: 9 }} /> Entrar no setor
            </button>
            <div className="control-note">W A S D PARA MOVER&nbsp;&nbsp; / &nbsp;&nbsp;MANTÉM O RATO PREMIDO PARA DISPARAR</div>
          </div>
        </section>
      </main>
    );
  }
  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Shield size={18} strokeWidth={2.5} /></span>
          <div><div className="brand-name">ZONA MORTA</div><div className="brand-sub">SISTEMA DE DEFESA DO REFÚGIO</div></div>
        </div>
        <div className="top-meta"><span className="live-dot">{isOver ? (hasWon ? 'SETOR SEGURO' : 'SINAL PERDIDO') : paused ? 'EM PAUSA' : 'SETOR ATIVO'}</span><span>OPERAÇÃO 01 / {mapName(selectedMap, String(selectedMap)).toLocaleUpperCase('pt-PT')}</span></div>
      </header>
      <div className="main-content">
        <div className="heading-row">
          <div>
          <div className="eyebrow">Setor {mapName(selectedMap, String(selectedMap)).toLocaleLowerCase('pt-PT')} / Defesa ativa</div>
            <h1 className="title">Mantém os <em>zombies lá fora.</em></h1>
            <p className="subline">Protege o refúgio. Gere os créditos. A noite não dá tréguas.</p>
          </div>
          <div className="mission-tag"><Radio size={12} style={{ verticalAlign: '-2px', marginRight: 7 }} /> {label((difficulties.find(([key, item]) => configId(key, item) === selectedDifficulty)?.[1] ?? {}) as ConfigItem, selectedDifficulty)} / PROTOCOLO</div>
        </div>
        <div className="dashboard">
          <section className="arena-column" aria-label="Campo de jogo">
            <div className="hud-strip">
              <div className="hud-stat"><div className="hud-label">Som</div><button className="icon-action" onClick={() => setMuted((m) => !m)} aria-pressed={muted} data-testid="button-mute">{muted ? 'Sem som' : 'Som'}</button></div>
              <div className="hud-stat">
                <div className="hud-label">Saúde do sobrevivente</div><div className="hud-value">{Math.ceil(health)}<span style={{ color: '#777a78', fontSize: 12 }}> / {Math.ceil(maxHealth)}</span></div>
                <div className="health-track"><div className="health-fill" style={{ width: `${healthPercent}%` }} /></div>
              </div>
              <div className="hud-stat"><div className="hud-label">Créditos disponíveis</div><div className="hud-value gold">{cash}<span style={{ color: '#9b8c6c', fontSize: 12 }}> CRÉD.</span></div></div>
              <div className="hud-stat"><div className="hud-label">Número da horda</div><div className="hud-value">{String(wave).padStart(2, '0')}<span style={{ color: '#777a78', fontSize: 12 }}> / ATUAL</span></div></div>
              <div className="hud-stat"><div className="hud-label">Combo</div><div className="hud-value">{game.comboKills > 0 ? game.comboKills + "x" : "-"}<span style={{ color: '#777a78', fontSize: 12 }}> {game.comboKills >= 3 ? 'BONUS' : ''}</span></div></div>
              <div className="hud-stat"><div className="hud-label">Estado da ameaça</div><div className="hud-value" style={{ color: isOver ? '#d46b5b' : '#b5c487', fontSize: 19 }}>{isOver ? (hasWon ? 'CONTIDA' : 'INVASÃO') : paused ? 'EM PAUSA' : 'ATIVA'}</div></div>
            </div>
            <div className="canvas-frame" style={{ '--game-ratio': `${GAME_WIDTH}/${GAME_HEIGHT}` } as CSSProperties}>
              <canvas
                ref={canvasRef}
                className="game-canvas"
                onPointerMove={updatePointer}
                onPointerDown={onCanvasPointerDown}
                onPointerLeave={() => { if (!selectedTower) mouseRef.current.down = false; }}
                aria-label="Campo de jogo: defesa contra zombies"
                role="application"
                aria-live="polite"
                data-testid="game-canvas"
              />
              {(paused || isOver) && (
                <div className={`canvas-overlay ${isOver ? 'game-over' : ''}`}>
                  <div className="overlay-card">
                    <div className="eyebrow">{isOver ? (hasWon ? 'Setor protegido' : 'Perímetro comprometido') : 'Tempo suspenso'}</div>
                    <h2>{isOver ? (hasWon ? 'A zona está segura.' : 'O refúgio caiu.') : 'Respira fundo.'}</h2>
                    <p>{isOver ? (hasWon ? 'Dez hordas derrotadas. O refúgio resiste — pelo menos esta noite.' : `Resististe até à horda ${wave}. Perdemos o setor.`) : 'A horda está parada. Aproveita a pausa e prepara-te para voltar.'}</p>
                    {isOver && game && (
                      <div style={{ marginTop: 12, fontSize: 12, color: '#e4dfcf', lineHeight: 1.6 }}>
                        <div><b>Score:</b> {Math.round(game.score)}</div>
                        <div><b>Torres:</b> {game.towers.length}</div>
                        <div><b>Zombies derrotados:</b> {Math.round(game.score / 10)}</div>
                        <div><b>Vidas da base:</b> {game.baseLives}/{game.maxBaseLives}</div>
                      </div>
                    )}
                    <button className="primary-action" onClick={isOver ? () => { setGame(null); gameRef.current = null; setSetup(true); } : togglePause} data-testid={isOver ? 'button-new-run' : 'button-resume'}>
                      {isOver ? 'Preparar nova missão' : 'Retomar a defesa'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="canvas-footer">
              <span><span className="keycap">W</span><span className="keycap">A</span><span className="keycap">S</span><span className="keycap">D</span> MOVER&nbsp; / &nbsp;CLICA E MANTÉM PARA DISPARAR</span>
              <span>UNIDADE DE CAMPO · {String(frameRevision).padStart(4, '0')}</span>
            </div>
          </section>
          <aside className="side-panel">
            <div className="panel-head"><div className="panel-title">Comando</div><span className="panel-index">SETOR / 01</span></div>
            <div className="panel-body">
              <div className="wave-box">
                <div className="wave-box-top"><span>Ameaça iminente</span><span className="wave-status">{gameStatus === 'active' ? 'EM CURSO' : 'EM ESPERA'}</span></div>
                <div className="wave-number">{String(wave).padStart(2, "0")}<span>HORDA</span></div>
                <div className="wave-progress-bar"><div className="wave-progress-fill" style={{ width: `${waveProgress}%` }} /></div>
                <div className="wave-progress-label">progresso da horda</div>
                <div className="wave-count">
                  <span>{game.enemies.length} {game.enemies.length === 1 ? "zombie no terreno" : "zombies no terreno"}</span>
                </div>
              </div>
              <div className="section-label"><span>Torres de defesa</span><TowerControl size={13} /></div>
              <div className="tower-list">
                {towerList.slice(0, 3).map((tower, index) => (
                  <button
                    key={tower.id}
                    className={`tower-option ${selectedTower === tower.id ? 'selected' : ''}`}
                    onClick={() => {
                      selectPlacedTower(null);
                      setSelectedTower((active) => active === tower.id ? null : tower.id);
                    }}
                    disabled={isOver || cash < tower.cost}
                    data-testid={`select-tower-${tower.id}`}
                    aria-pressed={selectedTower === tower.id}
                  >
                    <span className="tower-key">{index + 1}</span>
                    <span className="tower-symbol">{index === 0 ? <Target size={18} /> : index === 1 ? <Crosshair size={18} /> : <Activity size={18} />}</span>
                    <span><span className="tower-name">{tower.title}</span><span className="tower-desc">{tower.description}</span></span>
                    <span className="tower-price">{tower.cost} CRÉD.</span>
                  </button>
                ))}
              </div>
              <div className="hint">{selectedTower ? `Selecionada: ${towerList.find((entry) => entry.id === selectedTower)?.title}. Clica numa zona livre do terreno para a instalar.` : 'Escolhe uma torre para construir ou clica numa torre existente para a gerir.'}</div>
              {towerToManage && towerStats ? (
                <section className="tower-management" aria-label="Gestão da torre selecionada">
                  <div className="tower-management-head">
                    <div>
                      <div className="eyebrow">Torre selecionada</div>
                      <div className="tower-management-name">{towerName(towerToManage.type, towerToManage.type)}</div>
                    </div>
                    <span className="level-badge">NÍVEL {towerToManage.level}/3</span>
                  </div>
                  <div className="level-track" aria-label={`Nível ${towerToManage.level} de 3`}>
                    {[1, 2, 3].map((level) => <span key={level} className={towerToManage.level >= level ? 'filled' : ''} />)}
                  </div>
                  <div className="tower-stat-line">
                    <span>DANO <b>{towerStats.damage}</b></span>
                    <span>ALCANCE <b>{towerStats.range}</b></span>
                  </div>
                  <div className="tower-target-control" aria-label="Modo de alvo da torre">
                    <span className="tower-target-label">ALVO:</span>
                    {(['first', 'nearest', 'strongest', 'weakest'] as const).map((mode) => (
                      <button
                        key={mode}
                        className={`tower-target-option ${towerTargetMode === mode ? 'active' : ''}`}
                        onClick={() => changeTowerTargetMode(mode)}
                      >
                        {mode === 'first' ? 'PRIMEIRO' : mode === 'nearest' ? 'MAIS PERTO' : mode === 'strongest' ? 'MAIS FORTE' : 'MAIS FRACO'}
                      </button>
                    ))}
                  </div>
                  <div className="tower-manage-actions">
                    <button
                      className="manage-button upgrade-button"
                      onClick={improveSelectedTower}
                      disabled={towerStats.upgradeCost === null || cash < towerStats.upgradeCost}
                      data-testid="button-upgrade-tower"
                    >
                      <ArrowUp size={13} />
                      <span>{towerStats.upgradeCost === null ? 'Nível máximo' : 'Melhorar'}</span>
                      {towerStats.upgradeCost !== null && <b>{towerStats.upgradeCost} CR</b>}
                    </button>
                    <button className="manage-button sell-button" onClick={sellSelectedTower} data-testid="button-sell-tower">
                      <Recycle size={13} />
                      <span>Vender</span>
                      <b>+{Math.floor(towerToManage.invested * 0.7)} CR</b>
                    </button>
                  </div>
                </section>
              ) : null}
              <div className="divider" />
              <div className="section-label"><span>Controlo das hordas</span><Skull size={13} /></div>
              <div className="action-row">
                <button className="primary-action" onClick={callStartWave} disabled={isOver || gameStatus !== 'ready'} data-testid="button-start-wave">
                  <Play size={14} fill="currentColor" style={{ verticalAlign: '-3px', marginRight: 7 }} /> {wave > 0 ? 'Chamar próxima horda' : 'Iniciar horda'}
                </button>
                <button className="icon-action" onClick={togglePause} aria-label={paused ? 'Retomar o jogo' : 'Pausar o jogo'} title={paused ? 'Retomar' : 'Pausar'} disabled={isOver} data-testid="button-pause">
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
              </div>
              <button
                className="grenade-action"
                onClick={launchGrenadeAtPointer}
                disabled={paused || gameStatus !== 'active' || game.grenadeCooldown > 0}
                data-testid="button-grenade"
              >
                <span className="grenade-icon"><Bomb size={17} /></span>
                <span className="grenade-copy">
                  <b>Granada de choque</b>
                  <small>Explosão em área · abranda zombies</small>
                </span>
                <span className="grenade-key">{game.grenadeCooldown > 0 ? `${game.grenadeCooldown.toFixed(1)}s` : 'G'}</span>
                <span className="grenade-cooldown" style={{ transform: `scaleX(${game.grenadeCooldown / game.grenadeMaxCooldown})` }} />
              </button>
              <p className="hint">Clica numa torre para a melhorar ou vender. Usa <span className="keycap">G</span> para lançar uma granada na horda. Pausa com <span className="keycap">ESC</span>.</p>
            </div>
            <div className="side-bottom"><span>REFÚGIO · {baseLives}/{maxBaseLives} VIDAS</span><span>LIGAÇÃO ATIVA <span style={{ color: '#b6c88b' }}>●</span></span></div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default App;
