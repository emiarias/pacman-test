# SPEC 02 — Power pellets: pacman come fantasmas

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-25
> **Objective:** Cuatro power pellets activan un modo frightened (~8s) donde los fantasmas huyen más lento, se vuelven comibles y valen 200/400/800/1600 puntos.

## Scope

**In:**

- Tile nuevo `'o'` → valor `4` en `parseTile()` (`src/js/maze.js`), en las 4 posiciones clásicas del arcade: `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`.
- Los pellets cuentan para `dotsRemaining`: ganar requiere comerlos.
- Estado `game.fright = { framesLeft: 0 }` en `src/js/game.js`, con `FRIGHTENED_FRAMES = 480` (~8s a 60fps).
- Comer un pellet: `score += 50`, activa fright, resetea el contador de fantasmas comidos e invierte la `dir` de cada fantasma (comportamiento del arcade).
- IA frightened: greedy igual que ahora pero **maximizando** la distancia a pacman (target = reflejo de pacman respecto al fantasma).
- Velocidad frightened: `GHOST_FRIGHT_SPEED = 0.05` (50% de `GHOST_SPEED`).
- El ciclo scatter/chase (`updateMode()`) se congela mientras dura el fright y reanuda donde quedó.
- Comer fantasma: duplicador clásico 200 → 400 → 800 → 1600 según cuántos lleva comidos con ese pellet; el fantasma desaparece y reaparece en la pen con `exitTimer = GHOST_RESPAWN_DELAY`.
- `src/js/render.js`: pellet = círculo grande parpadeante; fantasma frightened azul con flash blanco los últimos `FRIGHTENED_FLASH = 120` frames.
- `resetPositions()` y `createGame()` reinician `fright`, el contador de comidos y el flag `eaten` de cada fantasma.

**Out of scope (for future specs):**

- Fantasmas comidos regresando como ojos a la pen (aquí respawn directo).
- "Cruise Elroy" (aceleración de Blinky con pocos dots).
- Duración decreciente del fright por nivel (no hay niveles aún).
- Timing frame-exacto del arcade; sonidos.

## Data model

```js
// maze.js — parseTile
// '#' pared(1) · '.' dot(2) · '-' puerta(3) · 'o' power pellet(4)

// game.js — estado nuevo
const FRIGHTENED_FRAMES = 480;    // ~8s a 60fps
const FRIGHTENED_FLASH = 120;     // últimos ~2s: aviso de expiración
const GHOST_FRIGHT_SPEED = 0.05;  // 50% de GHOST_SPEED
const GHOST_RESPAWN_DELAY = 60;   // frames que espera en pen tras ser comido

// game.fright = { framesLeft: 0 }
// game.ghostsEaten = 0   (reset al comer cada pellet)
// game.ghosts[i].eaten   (bool: comido, esperando respawn en pen)
```

Conventions: el fantasma comido respawnea en su entrada de `GHOST_STARTS` (posición original, `exitTimer = GHOST_RESPAWN_DELAY`).

## Implementation plan

1. `src/js/maze.js`: `parseTile()` agrega `'o'` → 4 y se marcan las 4 celdas en `MAZE_STR` (filas 3 y 23). `src/js/game.js`: el conteo de `dotsRemaining` en `createGame()` incluye `v === 4`. Manual: recargar y ver `game.dotsRemaining` +4.
2. `src/js/render.js`: `drawDots()` dibuja el valor 4 como círculo grande (r ≈ 6) parpadeante. Manual: 4 círculos grandes parpadeando en las esquinas.
3. `src/js/game.js`: estado `fright`/`ghostsEaten` y constantes. `movePacman()` come pellet (valor 4) → `+50`, `dotsRemaining--`, activa fright, resetea `ghostsEaten`, invierte `dir` de los fantasmas. Manual: comer pellet, consola sin errores.
4. `src/js/game.js`: `update()` decrementa `fright.framesLeft`; mientras dure: `updateMode()` no corre, `ghostTarget()` devuelve el reflejo de pacman y `moveGhost()` usa `GHOST_FRIGHT_SPEED`. Manual: los fantasmas huyen a mitad de velocidad.
5. `src/js/render.js`: `drawGhost()` usa azul en fright, con flash blanco en los últimos `FRIGHTENED_FLASH` frames. Manual: azul al comer pellet, flash antes de expirar.
6. `src/js/game.js`: colisión en fright → fantasma comido: puntos duplicadores (`ghostsEaten`), `eaten = true`, respawn en pen con `exitTimer = GHOST_RESPAWN_DELAY`; el loop de colisión ignora fantasmas `eaten`. Manual: comer fantasma, ver score y respawn.
7. `src/js/game.js`: `resetPositions()` y `createGame()` reinician `fright`, `ghostsEaten` y `eaten`. Manual: perder vida con fright activo deja el ciclo limpio.

## Acceptance criteria

- [ ] La consola no muestra errores al cargar ni durante el juego.
- [ ] Se ven 4 pellets grandes parpadeantes en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- [ ] Comer un pellet suma 50 puntos y congela el ciclo scatter/chase.
- [ ] Tras comerlo, los 4 fantasmas quedan azules, invierten dirección y huyen de pacman a mitad de velocidad.
- [ ] Fantasmas comidos consecutivos con el mismo pellet dan 200, 400, 800 y 1600 puntos.
- [ ] El fantasma comido desaparece y reaparece en la pen, saliendo poco después.
- [ ] ~8s después del pellet los fantasmas vuelven a su color e IA normal, y el scatter/chase reanuda donde quedó.
- [ ] Los últimos ~2s del fright los fantasmas parpadean como aviso.
- [ ] Perder una vida durante el fright resetea el modo por completo.
- [ ] Ganar requiere comer también los 4 pellets.

## Decisions

- **Sí:** respawn directo en pen (decisión del usuario). Simple y fiel en efecto; los "ojos que regresan" van en otra spec.
- **No:** ojos caminando de regreso. Suma pathfinding de vuelta sin valor jugable en un MVP.
- **Sí:** duplicador clásico 200/400/800/1600 (decisión del usuario). Premio creciente que incentiva cazar en cadena.
- **Sí:** huida greedy maximizando distancia a pacman (decisión del usuario). Reuso de `decideGhost()`; solo cambia el target.
- **No:** dirección aleatoria del arcade en fright. Menos predecible y más código para el mismo efecto.
- **Sí:** ~50% más lento en fright (decisión del usuario). Da ventana real de caza.
- **Sí:** congelar `updateMode()` durante fright. Comportamiento del arcade y evita transiciones raras al expirar.
- **Sí:** pellets cuentan para `dotsRemaining`. Sin ellos el nivel no se gana (en el arcade también son 4 dots más).

## Risks

| Risk                                                              | Mititación                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Velocidad dinámica toca `moveGhost()` compartido con SPEC 01       | Derivar velocidad de `game.fright.framesLeft` sin mutar `ghost.speed` base.  |
| Fantasma comido mientras el fright sigue activo                    | `eaten` es independiente del timer: revive y sigue frightened si quedan frames. |
| Invertir dirección con el fantasma desalineado                     | El movimiento es axis-aligned: invertir `dir` a mitad de celda es seguro.    |

## What is **not** in this spec

- Fantasmas comidos regresando como ojos a la pen.
- "Cruise Elroy" (aceleración de Blinky).
- Duración del fright decreciente por nivel.
- Sonidos.
