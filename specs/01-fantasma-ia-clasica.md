# SPEC 01 — Cuatro fantasmas con IA clásica

> **Status:** Implemented
> **Depends on:** —
> **Date:** 2026-11-24
> **Objective:** Los 4 fantasmas (Blinky, Pinky, Inky, Clyde) actúan con su IA clásica del arcade, salen escalonados de la pen y alternan ciclos scatter/chase.

## Scope

**In:**

- 4 fantasmas en `GHOST_STARTS` (`src/js/maze.js`) con `kind`, `corner` y `exitDelay`.
- IA por personalidad en `src/js/game.js` (target + greedy en intersecciones):
  - `hunter` (Blinky, rojo): apunta directo a la celda de pacman. **Agresivo.**
  - `ambusher` (Pinky, rosa): apunta 4 celdas adelante de la dirección de pacman.
  - `flanker` (Inky, cyan): vector desde Blinky hasta 2 celdas adelante de pacman, duplicado.
  - `patrol` (Clyde, naranja): persigue si su distancia a pacman es > 8 celdas; si no, va a su esquina.
- Salida escalonada de la pen: cada fantasma espera `exitDelay` frames antes de moverse.
- Ciclo global scatter/chase en `update()`: alterna ~7s scatter / ~20s chase; en scatter el target de cada fantasma es su `corner`.
- Puerta (celda 3) bloquea a fantasmas que ya salieron de la pen (evita re-entrar).
- Colores por `kind` en `src/js/render.js` (reemplaza el mapeo por índice de `GHOST_COLORS`).

**Out of scope (for future specs):**

- Power pellets y modo frightened (fantasmas comibles).
- Fantasmas comidos regresando como ojos a la pen.
- "Cruise Elroy" (Blinky acelera con pocos dots restantes).
- Timing frame-exacto del arcade; sonidos.

## Data model

```js
// maze.js
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter',   corner: { x: 25, y: 0  }, exitDelay: 0   }, // Blinky
  { x: 14, y: 14, kind: 'ambusher', corner: { x: 2,  y: 0  }, exitDelay: 60  }, // Pinky
  { x: 12, y: 14, kind: 'flanker',  corner: { x: 27, y: 30 }, exitDelay: 120 }, // Inky
  { x: 15, y: 14, kind: 'patrol',   corner: { x: 0,  y: 30 }, exitDelay: 240 }, // Clyde
];

// game.js — estado nuevo
const SCATTER_FRAMES = 420; // ~7s a 60fps
const CHASE_FRAMES = 1200;  // ~20s a 60fps

// game.mode = { current: 'scatter', framesLeft: SCATTER_FRAMES }
// game.ghosts[i] agrega: inPen (bool), exitTimer (frames restantes)
```

Conventions: coordenadas de `corner` pueden caer sobre paredes — son **atractores de distancia**, no destinos caminables.

## Implementation plan

1. `src/js/maze.js`: extender `GHOST_STARTS` a las 4 entradas con `kind`, `corner`, `exitDelay`. Manual: recargar, ver 4 fantasmas (2 duplicados en color por índice, se corrige en paso 6).
2. `src/js/game.js`: en `createGame()`, mapear `inPen`/`exitTimer` desde `exitDelay` y agregar `game.mode`.
3. `src/js/game.js`: en `update()`, decrementar `mode.framesLeft` y alternar scatter/chase al expirar.
4. `src/js/game.js`: refactor de `decideGhost()` → `ghostTarget( game, g )` devuelve `{ x, y }` según `kind` (o `corner` en scatter); `decideGhost()` elige la dirección que minimiza distancia Manhattan al target. Pen: mientras `exitTimer > 0`, decrementar y no mover; al expirar, `inPen = false`.
5. `src/js/game.js`: `isWall()` trata la puerta (3) como muro para fantasmas con `inPen === false`; `resetPositions()` reinicia `inPen`/`exitTimer` y `game.mode`.
6. `src/js/render.js`: `GHOST_COLORS` pasa de array por índice a mapa por `kind`. Manual: 4 colores distintos, uno por personalidad.

## Acceptance criteria

- [ ] La consola no muestra errores al cargar ni durante el juego.
- [ ] Se ven 4 fantasmas con colores distintos: rojo, rosa, cyan y naranja.
- [ ] Blinky (rojo) acorrala a pacman de forma constante en modo chase.
- [ ] Pinky se adelanta hacia donde pacman va, no hacia donde está.
- [ ] Al iniciar, los fantasmas salen de la pen escalonados, no todos a la vez.
- [ ] Los fantasmas visitan cíclicamente sus esquinas (~7s) y luego persiguen (~20s).
- [ ] Ningún fantasma atraviesa paredes ni vuelve a entrar a la pen tras salir.
- [ ] Perder una vida resetea los 4 fantasmas a la pen con sus `exitDelay` originales.

## Decisions

- **Sí:** personalidades clásicas del arcade. Documentadas, verificables, y cada una se distingue a simple vista.
- **No:** pathfinding BFS/A*. El greedy por intersección es el comportamiento del arcade original y ya es la base de `decideGhost()`.
- **Sí:** ciclos scatter/chase (decisión del usuario). Agrega timer global pero da respiros jugables.
- **Sí:** salida escalonada por `exitDelay` en frames (decisión del usuario).
- **No:** velocidades diferenciadas por fantasma (decisión del usuario). `GHOST_SPEED` queda uniforme.
- **Sí:** corners no caminables como atractores de scatter. Así no hay que validar reachability.
- **No:** el bug de overflow de Pinky del arcade (apuntar también 4 a la izquierda cuando pacman va arriba). Se implementa la intención original.
- **No:** modo frightened / power pellets. Merece su propia spec.

## Risks

| Risk                                        | Mitigation                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `requestAnimationFrame` no garantiza 60 fps | Los timers en frames son aproximados; aceptable para un MVP.                    |
| Inky necesita la posición de Blinky         | Buscar a Blinky por `kind === 'hunter'` en `game.ghosts`, no por índice.        |

## What is **not** in this spec

- Power pellets y modo frightened.
- Fantasmas comidos regresando como ojos a la pen.
- "Cruise Elroy" (aceleración de Blinky).
- Sonidos.
