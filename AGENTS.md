# AGENTS.md

Pac-Man MVP en vanilla JS (canvas). Proyecto de curso para practicar **Spec Driven Development**: las features nuevas se definen como specs, no se implementan directo.

## Correr y verificar

- Sin toolchain: no hay `package.json`, bundler ni tests. Correr = abrir `src/index.html` en el navegador (o servir `src/` estáticamente).
- Verificación manual en el navegador: consola sin errores + criterios de aceptación de la spec correspondiente.

## Arquitectura (no obvia desde los nombres)

Scripts como **globals cargados en orden fijo** en `src/index.html` (no hay módulos ES): `maze.js` → `game.js` → `render.js` → `main.js`. Si agregás un archivo, agregalo al HTML en la posición correcta.

- `maze.js`: datos pristinos. **`MAZE` nunca se muta** — `createGame()` lo copia fila por fila. Celdas: `0` vacío, `1` pared, `2` dot, `3` puerta pen (bloquea solo a pacman). Fila 14 = túnel (`TUNNEL_ROW`).
- `game.js`: estado y reglas (`createGame`, `update`).
- `render.js`: dibuja leyendo `game.grid` (no `MAZE`) para reflejar los dots comidos.
- `main.js`: bucle, teclado y overlay.

Toda función que cruce archivos se exporta con `window.*` al final de cada archivo. Mantener ese patrón.

## Convenciones

- Comentarios, README y specs en **español**. Responder en el idioma del prompt inicial (regla de los skills).
- Estilo de código existente: indentación 2 espacios y espacios dentro de paréntesis `( x )`. Seguirlo.

## Flujo spec-driven

Skills en `.agents/skills/` (lock en `skills-lock.json`):

- `/spec <descripción>` → crea `specs/NN-slug.md` con numeración secuencial (`01-`, `02-`, …). Guarda en estado `Draft`; **el humano** lo cambia a `Approved`.
- `/spec-impl NN-slug` → implementa solo si el estado significa "Approved" (ej. `Aprobado`). Crea rama `spec-NN-slug`; el commit por paso está deshabilitado por defecto.
- Estructura de las specs: `.agents/skills/spec/template.md`. Config del flujo: `specs/.spec-config.yml`.
- Ojo: por ahora este directorio **no es un repo git** y `/spec-impl` lo necesita (ramas, diff).
