import assert from 'node:assert/strict';
import { stepPlayer } from '../apps/pacman/src/movement.js';
import { MAZES } from '../apps/pacman/src/mazes.js';

const maze = [
  '#####',
  '#...#',
  '##.##',
  '#####',
];
const isWall = (x, y) => maze[y]?.[x] !== '.';

let position = { x: 1, y: 1 };
let direction = { x: 1, y: 0 };
const queuedDown = { x: 0, y: 1 };

let movement = stepPlayer(position, direction, queuedDown, isWall);
assert.deepEqual(movement.position, { x: 2, y: 1 }, 'keep moving while the queued turn is blocked');
assert.deepEqual(movement.direction, { x: 1, y: 0 });

position = movement.position;
direction = movement.direction;
movement = stepPlayer(position, direction, queuedDown, isWall);
assert.deepEqual(movement.position, { x: 2, y: 2 }, 'take the queued turn as soon as the crossing opens');
assert.deepEqual(movement.direction, queuedDown);

movement = stepPlayer({ x: 2, y: 2 }, queuedDown, { x: 0, y: 0 }, isWall);
assert.deepEqual(movement.position, { x: 2, y: 2 }, 'stop at walls without entering them');

console.log('Pacman movement tests: OK');

for (const mazeDefinition of MAZES) {
  const { layout, start, ghosts } = mazeDefinition;
  const isWall = (x, y) => layout[y]?.[x] === undefined || layout[y][x] === '#';
  const keyOf = ({ x, y }) => `${x},${y}`;
  const reachable = new Set([keyOf(start)]);
  const queue = [start];

  assert.equal(isWall(start.x, start.y), false, `${mazeDefinition.name}: player spawn must be open`);
  for (const ghost of ghosts) {
    assert.equal(isWall(ghost.x, ghost.y), false, `${mazeDefinition.name}: ghost spawn must be open`);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const direction of [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = keyOf(next);
      if (isWall(next.x, next.y) || reachable.has(key)) continue;
      reachable.add(key);
      queue.push(next);
    }
  }

  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === '.' || cell === 'o') {
        assert.ok(reachable.has(`${x},${y}`), `${mazeDefinition.name}: pellet at ${x},${y} must be reachable`);
      }
    });
  });
  console.log(`${mazeDefinition.name}: ${reachable.size} reachable tiles`);
}