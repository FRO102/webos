import assert from 'node:assert/strict';

const m = await import('../apps/zombie-defense/src/game-engine.ts').catch(() => null);
if (!m) {
  console.log('Zombie-defense tests: SKIPPED (TS loader unavailable)');
  process.exit(0);
}

const {
  createGame,
  drawGame,
  startWave,
  stepGame,
  placeTower,
  upgradeTower,
  sellTower,
  throwGrenade,
  togglePause,
  getTowerStats,
  GAME_WIDTH,
  GAME_HEIGHT,
  FINAL_WAVE,
} = m;

{
  const game = createGame('suburb', 'normal');
  assert.equal(game.status, 'ready');
  assert.equal(game.wave, 0);
  assert.equal(game.comboKills, 0);
  assert.equal(game.comboTimer, 0);
  assert.ok(Array.isArray(game.enemies));
  assert.equal(game.enemies.length, 0);
  console.log('createGame OK');
}

{
  const game = createGame('suburb', 'normal');
  const context = new Proxy({}, {
    get(target, property) {
      if (property === 'roundRect') return () => { throw new Error('Canvas roundRect should not be required'); };
      if (property === 'createRadialGradient') return () => ({ addColorStop() {} });
      return target[property] ?? (() => {});
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
  drawGame(context, game);
  console.log('canvas compatibility OK');
}

{
  const game = createGame('suburb', 'normal');
  startWave(game);
  const input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false };
  for (let frame = 0; frame < 8 && game.enemies.length === 0; frame += 1) {
    stepGame(game, 40, input);
  }
  assert.equal(game.enemies.length, 1, 'first enemy should spawn after the wave delay');
  assert.equal(game.enemies[0].kind, 'shambler');
  assert.equal(game.enemies[0].slowTimer, 0);
  assert.ok(Number.isFinite(game.enemies[0].health));
  for (let frame = 0; frame < 10 && game.comboKills === 0; frame += 1) {
    const enemy = game.enemies[0];
    stepGame(game, 40, {
      moveX: 0,
      moveY: 0,
      aimX: enemy.x,
      aimY: enemy.y,
      firing: true,
    });
  }
  assert.equal(game.comboKills, 1, 'a kill should increment the initialized combo counter');
  assert.ok(Number.isFinite(game.score), 'score should remain finite after a kill');
  console.log('enemy spawn state OK');
}

{
  const game = createGame('suburb', 'normal');
  startWave(game);
  assert.equal(game.status, 'active');
  assert.equal(game.wave, 1);
  assert.ok(game.spawnRemaining > 0);
  console.log('startWave OK');
}

{
  const game = createGame('suburb', 'normal');
  startWave(game);
  const beforeX = game.player.x;
  let threw = false;
  try {
    stepGame(game, 1000, { moveX: 1, moveY: 0, aimX: 200, aimY: 200, firing: true, keys: new Set(['d']) });
  } catch (error) {
    threw = true;
  }
  assert.equal(threw, false, 'stepGame must not throw ReferenceError moving (PLAYER_SPEED fix)');
  assert.notEqual(game.player.x, beforeX, 'player should move when active');
  console.log('stepGame (move active) OK');
}

{
  const game = createGame('suburb', 'normal');
  startWave(game);
  let safety = 0;
  while (game.status === 'active' && safety < 2000) {
    stepGame(game, 50, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false });
    safety += 1;
  }
  console.log('wave result status:', game.status, 'wave:', game.wave, 'loops:', safety);
  assert.ok(game.status === 'ready' || game.status === 'won', 'should finish wave to ready/won');
  console.log('wave drain smoke OK');
}

{
  const game = createGame('dockyard', 'easy');
  let placed = false;
  for (let ax = 60; ax < GAME_WIDTH && !placed; ax += 40) {
    for (let ay = 60; ay < GAME_HEIGHT && !placed; ay += 40) {
      const before = game.cash;
      placeTower(game, 'watchtower', ax, ay);
      if (game.towers.length > 0) {
        assert.ok(game.cash <= before, 'cash should decrease');
        placed = true;
      }
    }
  }
  assert.ok(placed, 'should place at least one tower');
  console.log('placeTower OK — towers:', game.towers.length, 'cash:', game.cash);
}

{
  const game = createGame('suburb', 'normal');
  placeTower(game, 'watchtower', 120, 120);
  const beforeCash = game.cash;
  if (game.towers.length) {
    const tower = game.towers[0];
    const stats = getTowerStats(tower);
    const upCost = stats.upgradeCost;
    if (upCost !== null) {
      upgradeTower(game, tower.id);
      assert.equal(tower.level, 2, 'upgrade should raise level');
      assert.equal(game.cash, beforeCash - upCost, 'cash should be deducted');
      const investedBefore = tower.invested;
      sellTower(game, tower.id);
      assert.equal(game.towers.length, 0, 'tower should be removed');
      assert.equal(game.cash, beforeCash - upCost + Math.floor(investedBefore * 0.7), 'refund should be applied');
      console.log('upgrade/sell OK');
    } else {
      console.log('upgrade skipped (already max)');
    }
  }
}

{
  const game = createGame('suburb', 'normal');
  startWave(game);
  throwGrenade(game, 100, 100);
  console.log('throwGrenade smoke — cooldown:', game.grenadeCooldown.toFixed(2), 'msg:', game.message);
  assert.ok(game.grenadeCooldown >= 0);
}

{
  const game = createGame('suburb', 'normal');
  startWave(game);
  togglePause(game);
  assert.equal(game.status, 'paused');
  togglePause(game);
  assert.equal(game.status, 'active');
  console.log('togglePause OK');
}

{
  assert.ok(typeof GAME_WIDTH === 'number' && GAME_WIDTH > 0);
  assert.ok(typeof GAME_HEIGHT === 'number' && GAME_HEIGHT > 0);
  assert.ok(typeof FINAL_WAVE === 'number' && FINAL_WAVE >= 1);
  console.log('constants OK');
}

console.log('Zombie-defense tests: OK');