# Prueba funcional de sprites Astra — 10 octubre 2026

- Responsable de implementación y QA: Codex; solicitud de Iker.
- Rama exclusiva: `art/toy-sprite-test`, copia aislada del clon local en `b887c4b`.
- El remoto GitHub observado tiene main en `a006ad9`; esta prueba parte del clon local inspeccionado, sin mezclar los cambios posteriores de mesa.
- No se modificó el clon conectado a Lovable, main, IA, niveles JSON, luces, tiempos, catálogo de IDs ni mecánicas. Sin merge, despliegue ni actualización de Drive.

## Implementación

`TidyRolesMinigame.tsx` usa el nuevo `ToySprite.tsx` solo para la imagen del tile y la pista del quinto juguete. Los botones existentes conservan tamaño, posiciones, selección, captura de puntero, hitboxes y victoria.

Se copiaron 10 WebP desde la biblioteca local de Astra a `public/assets/toys/`: ocho normales y variantes poseídas de oso/coche. Todos son 256 × 256 con canal alpha 0–255. La carpeta public/assets/toys no existía en el clon inspeccionado.

Alias visual provisional: `book` muestra `rabbit__normal.webp`, pero conserva ID, etiqueta, emoji de fallback y pertenencia al pool. No se añadió rabbit al catálogo ni a las categorías de IA.

Oso/coche poseídos usan `__possessed.webp`; otros usan normal con filtro CSS. Imágenes decorativas, sin eventos ni arrastre nativo. Si una imagen falla, vuelve el emoji correspondiente. El editor reutiliza el renderer en Playtest; sus controles y el resto de minijuegos conservan emojis.

## Pruebas ejecutadas

- Build producción Vite/Nitro Cloudflare: PASS, sin despliegue. Avisos existentes de deprecación inputValidator y vite-tsconfig-paths, y opciones de bundling.
- Suite existente: 14/14 PASS. Con cuatro casos adicionales de alias/fallback, cambios de pose y CSS: 18/18 PASS, cinco archivos.
- TypeScript `tsc --noEmit`: PASS.
- Dependencias existentes instaladas con pnpm sin generar lockfile; package.json y bun.lock sin modificaciones. Se resolvieron los rangos del package.json, no se reprodujo el lockfile Bun.
- Navegador Chromium integrado, viewport 390 × 844, IA mock: imágenes cargadas y tiles cuadrados de ~62 px; sin desbordamiento horizontal.
- Primera tarea real: drag de pelota a caja → 1/5; cojín y selección/toque → 2/5; cajón y conejo con ID book → 3/5.
- Robot como cuarto poseído: sprite normal con CSS, bloqueado a oscuras; luces activadas → desbloqueado y posición estable; capturado → 4/5.
- Quinto dinosaurio: pista con sprite detrás del sofá, hotspot correcto lo revela; guardado → 5/5 y pregunta de color.
- Mesa completada 4/4; dormitorio completado 3/3. Otros minijuegos conservan su renderer. Editor abre y Playtest carga sprites.
- Sin errores/warnings de consola observados en la partida de QA.
- Variantes poseídas de oso/coche y fallback de imagen comprobados con tests de componente; no se simula fallo de imagen en una partida completa.
- No probado en teléfonos físicos ni con IA live: quedan fuera de esta integración visual.

## Evidencias y siguiente paso

Capturas guardadas en la carpeta hermana `sprite-test-evidence/`, fuera del código del juego: poseído iluminado, pista del escondite, 5/5 y escena con sprites.

Entregar rama y commit local para revisión funcional; probar en teléfono real antes de aprobar integración. No hacer merge ni desplegar sin autorización de Iker.

## Traslado autorizado a Lovable

Iker pidió después llevar estos cambios a la rama de Lovable. Se preparó el commit sobre el main remoto `a006ad9`, conservando el nuevo minijuego Table for three y su pregunta de comida. Cherry-pick sin conflictos, build PASS y suite 23/23 PASS. La prueba visual completa descrita arriba corresponde a la base anterior; la integración con la mesa nueva se revalidó mediante build y tests. Se autoriza sincronizar main; no se ejecuta despliegue independiente ni se modifica Drive.
