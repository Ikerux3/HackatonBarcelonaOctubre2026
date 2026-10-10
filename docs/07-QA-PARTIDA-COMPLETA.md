# QA — partida completa y brecha con el diseño vigente

- Fecha: 10 oct 2026
- Rama: `codex/flash-corruption-music`
- HEAD probado: `9704424` (`b5ce09d` + `9704424` sobre `origin/main` `a93df9f`)
Entorno: Vite local, `?ai=mock&forget=1`, navegador integrado, viewport 390 × 844

## Resultado ejecutivo

La versión actual se puede completar de principio a fin sin soft-lock. La partida de referencia duró **3:19**, terminó en la pantalla de resumen, no produjo errores ni avisos de consola y no creó scroll o desbordamiento en 390 × 844.

El juego implementado tiene **tres minijuegos**, tres preguntas personalizadas y **un solo desenlace**. Es una vertical slice funcional, pero no implementa todavía la especificación más reciente de Drive: cinco minijuegos, barra de CORDURA 0–100, recuperación con luz y dos variantes de final en el umbral 64/65.

## Recorrido observado

| Tramo | Qué hay | Resultado |
| --- | --- | --- |
| Portada e intro | Portada, botón Play, nombre del jugador integrado en la despedida de mamá | PASS |
| MG01 — ordenar juguetes | Cinco juguetes; cojín y cajón; cuarto juguete poseído que exige dos luces; quinto escondido; contador 0/5–5/5; reinicio | PASS |
| Portal 1 | Pregunta por color favorito; respuesta mock validada; El Invitado recuerda `blue` | PASS |
| MG02 — mesa para tres | Cocina con cinco contenedores, seis piezas correctas y señuelos; comedor con marcas visibles a oscuras; checkpoint 3/6; comida favorita visible; intercambio sobrenatural de vasos; tercer servicio | PASS |
| Portal 2/3 | Pregunta por comida (`pizza`) durante MG02 y por juguete (`teddy bear`) al terminar | PASS |
| MG03 — dormitorio | Linterna, pijama, cepillo y juguete; el juguete evade una vez; contador 0/3–3/3 | PASS |
| Secuencia final | Apagón, susurro con el nombre, regreso real de mamá, habitación contigua con El Invitado y el juguete | PASS |
| Resumen | Recuerda color y juguete, muestra dos observaciones de la partida, duración y Play again | PASS |

## Personalización comprobada

- El nombre `Flash` aparece en el susurro “Good night, Flash.”
- El color `blue` se reutiliza en la frase del Invitado y en el resumen.
- La comida `pizza` aparece físicamente en la mesa.
- El juguete `teddy bear` es citado por el Invitado y reaparece en el desenlace.
- El resumen conserva observaciones jugables: primer escondite consultado y preferencia por la lámpara.
- La prueba usó el adaptador mock para ser reproducible; no valida inferencia real, red ni credenciales de proveedor.

## Audio y accesibilidad

- La música es procedural con Web Audio, no un archivo de audio. La progresión por fases comparte la corrupción visual: Do mayor → transición → La menor → La menor armónica.
- La voz Guest usa Web Speech si el navegador lo soporta. En este navegador estaba no disponible: el control quedó deshabilitado y los subtítulos permitieron terminar la partida sin bloqueo, como estaba previsto.
- Todos los diálogos críticos permanecieron visibles como subtítulos.
- Los controles principales expusieron nombres accesibles. El minijuego de linterna requirió iluminar y tocar cada objeto; el juguete cambió de posición una vez.
- No se probó sonido audible ni TTS real en un teléfono físico.

## Qué existe hoy

- Flujo completo de portada a resumen, con replay.
- Tres minijuegos funcionales cargados desde JSON: `tidy_toys`, `table_for_three` y `bedtime`.
- Tres respuestas personales: color, comida y juguete.
- IA con contrato validado, fallback y modo mock; consecuencias jugables observables.
- El Invitado adaptativo y memoria de sesión.
- Corrupción visual y musical por etapa (niveles discretos 0–3).
- Voz Guest opcional, subtítulos permanentes, mute persistente y cancelación entre escenas.
- Shell fijo sin scroll en móvil simulado.
- Editor de niveles separado en `/editor`.

## Qué falta frente a la especificación vigente

### P0 — diferencia de producto

1. **Barra de CORDURA 0–100**. El código solo tiene corrupción visual/musical discreta por etapa. Faltan HUD y lógica: +1 cada 2 s a oscuras, +10 por susto, recuperación con luz a una tasa todavía pendiente de aprobación, saturación 0/100 y pausa durante preguntas/cinemáticas.
2. **Cinco minijuegos oficiales**. La historia carga tres. Faltan MG03 y MG04 intermedios y mover baño/pijama a MG05. La caja de música tipo Simón 3/4/5/7 está diseñada por MJ pero pendiente de aprobación de Iker; MG04 sigue sin diseño aprobado.
3. **Dos finales por umbral**. Solo hay un final. Faltan snapshot de CORDURA al salir del baño y variantes 0–64 / 65–100, manteniendo el rescate real en ambas.
4. **Reinicio de fase con inventario conservado**. La regla maestra exige que un susto completo reinicie solo la colocación de la fase actual. Debe implementarse y probarse con la nueva CORDURA.
5. **QA de producto real**. Falta repetir la partida completa en iOS y Android físicos, con tacto, teclado, orientación, audio/TTS, reduced motion y fallback sin red.

### P1 — integración y calidad

- Integrar los packs Astra de salón, cocina/comedor, dormitorio/baño y El Invitado; actualmente constan como packs preparados, no integrados en runtime.
- Probar dos partidas con IA real y respuestas distintas; esta pasada fue deliberadamente mock.
- Verificar el umbral reversible 64/65, 0/100, exposición parcial a oscuridad, cuatro o más sustos y alcanzabilidad de ambos finales sin soft-lock.
- Aprobar el balance de recuperación con luz y el diseño definitivo de MG03/MG04 antes de programarlos.
- Resolver avisos de mantenimiento del build: `vite-tsconfig-paths` ya es redundante y `inputValidator()` está deprecado en las server functions.
- Preparar URL HTTPS estable, QR y vídeo de reserva para la demo.

## Evidencia técnica

- Partida E2E manual: PASS, 3:19, 390 × 844, mock, 0 errores/avisos de consola.
- Desbordamiento final: `body` y `documentElement` = 390 × 844; sin scroll de página.
- TypeScript: `npx tsc --noEmit` PASS.
- Vitest: 9 archivos, 31/31 tests PASS. La primera ejecución dentro del sandbox falló por `EPERM` en caché temporal; repetida fuera del sandbox, pasó completa.
- Build de producción: PASS. Solo avisos de deprecación/mantenimiento indicados arriba.

## Conclusión

La vertical slice actual está completa y presentable como demo corta de tres tareas. El bloqueo principal ya no es “hacer que exista una partida”: es alinear la implementación con el alcance ratificado de cinco niveles, CORDURA continua y dos finales, y después validar esa versión en teléfonos físicos.
