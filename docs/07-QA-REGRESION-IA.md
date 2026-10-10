# QA de regresión e IA real / respaldo — 10 octubre 2026

- Tarea: [issue #2](https://github.com/Ikerux3/HackatonBarcelonaOctubre2026/issues/2) · Roadmap P0-21 (solicitud de Iker).
- Responsables: Unai (partidas en producción) + Claude Code (comprobaciones en el repo y redacción).
- Commit probado: `main` @ `a93df9f`. **Pendiente**: que Iker confirme que la versión publicada en Lovable corresponde a ese commit.
- Sin cambios de código, contratos de IA, niveles ni rama de Lovable. Solo este documento y `docs/04`.

## Comprobaciones en el repo (clon limpio de `a93df9f`)

| Comando | Resultado |
|---|---|
| `bun run test` | **PASS** 25/25 (7 archivos) |
| `tsc --noEmit` | **PASS** |
| `bun run build` (Vite/Nitro, Cloudflare) | **PASS** |
| `bun run lint` | **FALLA**: 30 errores, todos `prettier/prettier` (solo formato), en archivos de la renovación visual (`EndingScreen`, `EndingSequence`, `IntroName`, `MonsterOverlay`, `QuestionInput`, `CorruptionLayer`, `TidyExtrasEditor`) + 17 avisos `react-refresh`. No afectan al juego; no se tocaron |

**Secretos**: ningún `.env` versionado. `LOVABLE_API_KEY` solo se lee en `src/ai/interpret.functions.ts` y `src/ai/guest.functions.ts` (servidor). El código que descarga el navegador (`.output/public`) no contiene el nombre de la clave, la URL del gateway ni cadenas con forma de clave.

## Partidas en producción

Unai, 10 oct ~04:15 (Madrid), escritorio Windows + Microsoft Edge, `https://embrace-weave-guide.lovable.app/?debug=1&ai=live`. Evidencia: capturas del recuadro `?debug=1` (las guarda Unai).

### Partida A — IA real

Respuestas: *el color del cielo* · *pizza con piña* · *un dinosaurio verde llamado Rex*

- El Invitado: `guest → shadow` (1244 ms) en el apagón de la tarea 1 y `guest → weak_flashlight` (1617 ms) en el de la tarea 2. `adapter: live`, `fallback: false`.
- Interpretación de respuesta: `adapter: live`, `fallback: false`, 820 ms.
- Final: *"The Guest remembers: sky blue · Rex the dinosaur"*. Es la paráfrasis del modelo: el respaldo offline habría puesto "blue" y "your dinosaur".
- Notas escritas por el modelo: *"You rush through chores to finish early."* / *"You prefer to keep your surroundings very bright."*
- Duración: 4:01.

### Partida B — IA real, respuestas distintas

Respuestas: *rojo como un tomate* · *los macarrones de mi abuela* · *my old teddy bear*

- El Invitado: `shadow` (945 ms) y `weak_flashlight` (1085 ms). Interpretación `live` 980 ms. `fallback: false` en todas.
- Final: *"tomato red · old teddy bear"*.
- Notas: *"You always check behind the sofa first."* / *"You change your favorite color every night."* La segunda usa la **memoria de la partida A** (azul → rojo).
- Duración: 3:06.

### A frente a B (MVP: dos respuestas distintas dan resultados distinguibles)

| | Partida A | Partida B |
|---|---|---|
| Piezas del niño ⭐ en la mesa | azul | rojo |
| Piezas de mamá 👗 (color sorteado al pulsar Play) | morado | azul |
| Comida en la mesa | pizza | macarrones |
| Juguete en la linterna y en el final | Rex the dinosaur | old teddy bear |
| Notas del Invitado | sobre prisa y luz | sobre el sofá y el cambio de color |

### Partida C — sin conexión

DevTools → Network → **Offline**, activado justo antes de responder el color y mantenido hasta el final. Las respuestas escritas no quedaron registradas.

- Las tres respuestas: `adapter: mock-fallback`, `fallback: true`, `err: Failed to fetch`.
- El juego sigue en todo momento:
  - Color → amarillo (piezas ⭐ amarillas), con la frase de respaldo *"Yellow… like the lamp that just stopped working."*
  - Comida → queso: *"Cheese… the mice will come…"*
  - Juguete no reconocido → "your toy": *"I know that toy. It's in this house. It misses you too."*
- Final alcanzado sin bloqueo: *"yellow · your toy"*. Notas de las reglas de respaldo: *"You have a routine for this house."* / *"You came back to me."* Duración: 2:49.
- Imágenes y fuentes servidas desde la caché del navegador; no se vio nada sin cargar.
- Las decisiones del Invitado a oscuras no se capturaron en el recuadro. La partida siguió normal, así que las reglas de respaldo actuaron.

## No comprobado en esta ronda

- Teléfonos físicos (iPhone Safari, Android Chrome).
- Revisión visual dedicada del color de mamá en la intro y en su silla a oscuras, del temblor corto y de la escena final de dos habitaciones. Se llegó al final en las tres partidas sin incidencias reportadas, pero sin revisarlo en detalle.
- Origen `live` de la **comida** en esta ronda. La comida apareció en la mesa (pizza, macarrones), pero el respaldo también reconoce ambas. Sigue valiendo la verificación `live` del 10 oct 02:50 (`docs/04`).
- Que la versión publicada sea `a93df9f`.

## Observaciones

- La partida dura entre 2:49 y 4:01 (en `docs/04` ponía ~3 min).
- La web publicada muestra la insignia **"Edit with Lovable"** abajo a la derecha, también durante la partida. Para la demo, Iker puede revisar si se oculta desde los ajustes del proyecto en Lovable.
- `?ai=` se queda guardado en el navegador: para la demo, abrir con `?ai=live` explícito.

## Handoff (plantilla del equipo, para copiar en Drive → Context → Handoffs)

- **Tarea / ID**: issue #2 · Roadmap P0-21 — Regresión tras merge visual + evidencia IA real/fallback.
- **Responsable humano y agente**: Unai + Claude Code.
- **Estado**: probada en producción (escritorio). Falta móvil físico.
- **Rama, commit y archivos exactos**: probado `main` @ `a93df9f`. Documentación en la rama `claude/keen-lamport-y3wb6h`: `docs/07-QA-REGRESION-IA.md` (nuevo) y `docs/04-ESTADO-Y-ARQUITECTURA.md`.
- **Qué se hizo**: tests, tipos, build, lint y búsqueda de secretos en el repo. Dos partidas `live` con respuestas distintas y una sin conexión en producción.
- **Pruebas y resultados concretos**: 25/25 tests, `tsc` y build PASS. Lint FALLA solo por formato. A y B: `fallback: false` en interpretación y decisiones del Invitado (820–1617 ms), con resultados distintos en la mesa, el juguete, el final y las notas. C: `fallback: true` en todo y partida completa sin bloqueo.
- **Bloqueos / riesgos / secretos**: ningún secreto que configurar. Versión publicada sin confirmar. Lint de formato pendiente. `?ai=` persistente. Insignia de Lovable visible.
- **Documentos actualizados**: `docs/04` y `docs/07` en el repo. En Drive (Tests, Handoffs, Roadmap P0-21 → PROBADO) queda pendiente que lo registren Iker o Rook.
- **Siguiente paso y dueño**: Iker confirma la versión publicada. Unai/MJ hacen QA en un móvil físico. Unai empieza la barra de Cordura y los dos finales (D33/D34) en una rama propia.
