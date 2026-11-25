// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Ciclo scatter/chase en frames (~60fps): ~7s en esquinas, ~20s cazando.
const SCATTER_FRAMES = 420;
const CHASE_FRAMES = 1200;

// Modo frightened (power pellet).
const FRIGHTENED_FRAMES = 480;    // ~8s a 60fps
const FRIGHTENED_FLASH = 120;     // ultimos ~2s: aviso de expiracion
const GHOST_FRIGHT_SPEED = 0.05;  // 50% de GHOST_SPEED
const GHOST_RESPAWN_DELAY = 60;   // frames que espera en pen tras ser comido

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  // Dots y power pellets cuentan para dotsRemaining: ganar requiere comerlos.
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    mode: {
      current: 'scatter',
      framesLeft: SCATTER_FRAMES,
    },
    fright: { framesLeft: 0 },
    ghostsEaten: 0, // fantasmas comidos con el pellet actual (duplicador)
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      corner: g.corner,
      inPen: true, // dentro de la pen (fisico); baja al cruzar la puerta
      exitTimer: g.exitDelay,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1); la puerta solo si ya salio de la pen
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) {
    if ( actor === 'pacman' ) return true;
    return !actor.inPen; // fantasma ya salido: la puerta es muro (no re-entra)
  }
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer power pellet: activa el modo frightened.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 50;
      game.dotsRemaining--;
      game.fright.framesLeft = FRIGHTENED_FRAMES;
      game.ghostsEaten = 0;
      // Comportamiento del arcade: cada fantasma invierte su direccion.
      game.ghosts.forEach( ( g ) => { g.dir = OPPOSITE[ g.dir ]; } );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Celda objetivo del fantasma segun su personalidad y el modo global.
// En scatter todos apuntan a su esquina (atractor, no necesita ser caminable).
function ghostTarget( game, g ) {
  // Fright: huyen de pacman. El greedy de decideGhost() minimiza distancia
  // al target, asi que usar el reflejo de pacman respecto al fantasma
  // equivale a maximizar la distancia a pacman.
  if ( game.fright.framesLeft > 0 ) {
    const p = game.pacman;
    return {
      x: 2 * Math.round( g.x ) - Math.round( p.x ),
      y: 2 * Math.round( g.y ) - Math.round( p.y ),
    };
  }

  if ( game.mode.current === 'scatter' ) return g.corner;

  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( g.kind === 'hunter' ) {
    // Blinky: directo a pacman (agresivo).
    return { x: px, y: py };
  }

  if ( g.kind === 'ambusher' ) {
    // Pinky: 4 celdas adelante de la direccion de pacman.
    const d = DIRS[ p.dir ];
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }

  if ( g.kind === 'flanker' ) {
    // Inky: duplica el vector Blinky -> (2 celdas adelante de pacman).
    const blinky = game.ghosts.find( ( b ) => b.kind === 'hunter' );
    const d = DIRS[ p.dir ];
    const ax = px + d.x * 2;
    const ay = py + d.y * 2;
    if ( !blinky ) return { x: ax, y: ay };
    return { x: ax * 2 - Math.round( blinky.x ), y: ay * 2 - Math.round( blinky.y ) };
  }

  // patrol (Clyde): persigue lejos; a <= 8 celdas se replega a su esquina.
  const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
  return dist > 8 ? { x: px, y: py } : g.corner;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, g )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Greedy: la direccion que minimiza la distancia Manhattan al target.
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Espera escalonada en la pen: quieto hasta agotar exitTimer.
  if ( g.exitTimer > 0 ) {
    g.exitTimer--;
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, g ) ) return;
  }

  // En fright se mueve a mitad de velocidad; se deriva del estado global
  // (sin mutar g.speed base, que queda para el modo normal).
  const speed = game.fright.framesLeft > 0 ? GHOST_FRIGHT_SPEED : g.speed;
  const d = DIRS[ g.dir ];
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );

  // Opcion 1 (ambiguedad resuelta): salio fisicamente de la pen (arriba de
  // la puerta, y < 12) -> ya no puede volver a entrar.
  if ( g.inPen && g.y < 12 ) g.inPen = false;
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    const start = GHOST_STARTS[ i ];
    g.x = start.x;
    g.y = start.y;
    g.dir = 'up';
    g.inPen = true;
    g.exitTimer = start.exitDelay;
  } );
  game.mode.current = 'scatter';
  game.mode.framesLeft = SCATTER_FRAMES;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Alterna el ciclo global scatter (esquinas) <-> chase (caza) por frames.
function updateMode( game ) {
  game.mode.framesLeft--;
  if ( game.mode.framesLeft > 0 ) return;
  if ( game.mode.current === 'scatter' ) {
    game.mode.current = 'chase';
    game.mode.framesLeft = CHASE_FRAMES;
  } else {
    game.mode.current = 'scatter';
    game.mode.framesLeft = SCATTER_FRAMES;
  }
}

function update( game ) {
  // Mientras dura el fright el ciclo scatter/chase se congela (reanuda donde
  // quedo); el timer de fright corre en su lugar.
  if ( game.fright.framesLeft > 0 ) {
    game.fright.framesLeft--;
  } else {
    updateMode( game );
  }
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.FRIGHTENED_FLASH = FRIGHTENED_FLASH;
