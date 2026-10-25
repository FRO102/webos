const CLASSIC_MAP = [
  '###################',
  '#........#........#',
  '#.##.###.#.###.##..#',
  '#o##.###.#.###.##o.#',
  '#.................#',
  '#.##.#.#####.#.##..#',
  '#....#...#...#.....#',
  '####.### # ###.#####',
  '   #.#       #.#   ',
  '####.# ## ## #.#####',
  '    .  #   #  .    ',
  '####.# ##### #.#####',
  '   #.#       #.#   ',
  '####.# ##### #.#####',
  '#........#.........#',
  '#.##.###.#.###.##..#',
  '#o.#.....P.....#.o.#',
  '##.#.#.#####.#.#.###',
  '#....#...#...#.....#',
  '#.######.#.######..#',
  '#.................#',
  '###################',
];

const MAZE_WIDTH = 20;
const MAZE_HEIGHT = 22;
export const PLAYER_SPAWN = { x: 9, y: 16 };
export const GHOST_LAYOUT = [
  { x: 8, y: 10, color: '#ef637b', dir: { x: 1, y: 0 } },
  { x: 9, y: 10, color: '#62d9e7', dir: { x: -1, y: 0 } },
  { x: 10, y: 10, color: '#ed9fce', dir: { x: 0, y: -1 } },
  { x: 9, y: 9, color: '#f2a94e', dir: { x: 0, y: 1 } },
].map((ghost) => ({
  ...ghost,
  home: { x: ghost.x, y: ghost.y },
}));

function createMaze(name, subtitle, walls, powerPellets) {
  const grid = Array.from({ length: MAZE_HEIGHT }, (_, y) =>
    Array.from({ length: MAZE_WIDTH }, (_, x) =>
      x === 0 || y === 0 || x === MAZE_WIDTH - 1 || y === MAZE_HEIGHT - 1 ? '#' : '.',
    ),
  );

  walls.forEach(({ x, y, width, height }) => {
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        grid[row][column] = '#';
      }
    }
  });

  powerPellets.forEach(([x, y]) => {
    if (grid[y][x] !== '#') grid[y][x] = 'o';
  });

  grid[PLAYER_SPAWN.y][PLAYER_SPAWN.x] = 'P';
  GHOST_LAYOUT.forEach((ghost) => {
    grid[ghost.y][ghost.x] = 'G';
  });

  return {
    name,
    subtitle,
    layout: grid.map((row) => row.join('')),
    start: { ...PLAYER_SPAWN },
    ghosts: GHOST_LAYOUT,
  };
}

const CORNER_POWER_PELLETS = [
  [2, 2],
  [17, 2],
  [2, 19],
  [17, 19],
];

export const MAZES = [
  {
    name: 'Classic',
    subtitle: 'The original arcade maze',
    layout: CLASSIC_MAP,
    start: { ...PLAYER_SPAWN },
    ghosts: GHOST_LAYOUT,
  },
  createMaze(
    'Crossroads',
    'Long lanes and tight turns',
    [
      { x: 2, y: 3, width: 6, height: 1 },
      { x: 11, y: 3, width: 6, height: 1 },
      { x: 4, y: 6, width: 5, height: 1 },
      { x: 12, y: 6, width: 5, height: 1 },
      { x: 2, y: 10, width: 5, height: 1 },
      { x: 13, y: 10, width: 5, height: 1 },
      { x: 3, y: 14, width: 5, height: 1 },
      { x: 12, y: 14, width: 5, height: 1 },
      { x: 2, y: 18, width: 6, height: 1 },
      { x: 12, y: 18, width: 6, height: 1 },
      { x: 4, y: 4, width: 1, height: 2 },
      { x: 15, y: 7, width: 1, height: 3 },
      { x: 6, y: 11, width: 1, height: 3 },
      { x: 13, y: 15, width: 1, height: 3 },
      { x: 9, y: 4, width: 1, height: 3 },
      { x: 10, y: 13, width: 1, height: 3 },
    ],
    CORNER_POWER_PELLETS,
  ),
  createMaze(
    'Orbit',
    'A winding route around the center',
    [
      { x: 3, y: 3, width: 9, height: 1 },
      { x: 13, y: 5, width: 4, height: 1 },
      { x: 4, y: 5, width: 1, height: 6 },
      { x: 7, y: 7, width: 9, height: 1 },
      { x: 16, y: 9, width: 1, height: 4 },
      { x: 3, y: 12, width: 10, height: 1 },
      { x: 5, y: 15, width: 1, height: 4 },
      { x: 8, y: 17, width: 9, height: 1 },
      { x: 11, y: 10, width: 1, height: 3 },
    ],
    CORNER_POWER_PELLETS,
  ),
  createMaze(
    'Zigzag',
    'Alternating walls and open passages',
    [
      { x: 3, y: 3, width: 1, height: 5 },
      { x: 4, y: 7, width: 6, height: 1 },
      { x: 10, y: 3, width: 1, height: 5 },
      { x: 11, y: 3, width: 6, height: 1 },
      { x: 16, y: 4, width: 1, height: 5 },
      { x: 2, y: 12, width: 6, height: 1 },
      { x: 7, y: 9, width: 1, height: 4 },
      { x: 9, y: 13, width: 6, height: 1 },
      { x: 15, y: 10, width: 1, height: 4 },
      { x: 3, y: 17, width: 1, height: 3 },
      { x: 4, y: 18, width: 6, height: 1 },
      { x: 12, y: 17, width: 1, height: 3 },
      { x: 13, y: 5, width: 1, height: 2 },
    ],
    CORNER_POWER_PELLETS,
  ),
];
