# Integración visual Astra — 10 octubre 2026

Responsable: Codex, tarea de Iker. Rama: `feature/integrate-astra-art`.
Base inicial verificada: `36ebd05d5ed1791668c291a40387b9f1ad509928`.
Avance del equipo incorporado en esta rama: `09e4c30` (ElevenLabs). Commits iniciales de integración: `8ec2c8d` (arte) y `0b10c1e` (incorporar main a esta rama, sin merge inverso).
Pack local: `THE-MENDED-HOUSE-integration-v1.zip`, Astra v1. No arte generado adicional.

## Estado y alcance

VERIFICADO EN CÓDIGO: solo tres minijuegos implementados en el flujo actual. Drive contempla cinco; MG04/MG05, cordura y selección de dos finales no se implementan en esta tarea.

Integrados los fondos WebP de salón, cocina, comedor y dormitorio; muebles independientes con alpha; estados de cojín/cajón/cortina usando los estados existentes; vajilla en inventario, mesa, señuelos y tercer puesto; pijama, cepillo y juguete personalizado separados del fondo. Se conserva ToySprite, su alias visual book → rabbit y sus variantes poseídas/fallbacks.

Guest: silueta y tinta en GuestOverlay; silueta Astra con SVG de reserva en MonsterOverlay; ojos en comedor y detalle final. Tiempos, voz y lógica de aparición existentes. Intro/final usan las figuras de madre y niño, manteniendo el mismo color de vestido de la partida y el flujo único actual. Los colores sin variante conservan SVG.

ArtImage es decorativo, sin eventos de juego: `pointer-events:none`, `draggable=false`, alpha, decodificación asíncrona, fallback al fallar. ArtDecor usa un índice reducido de manifests; excluye los objetos demo y los anchors interactivos. Las imágenes se solicitan al montar la escena, no se precarga el pack completo.

## Archivos

- `src/components/minigames/ArtImage.tsx`, `SceneBackdrop.tsx`, `TidyRolesMinigame.tsx`, `TableForThreeMinigame.tsx`, `FlashlightMinigame.tsx`.
- `src/components/game/Figures.tsx`, `IntroName.tsx`, `EndingSequence.tsx`, `GuestOverlay.tsx`, `MonsterOverlay.tsx`.
- `src/game/astra-art.json`, índice visual derivado de los manifests originales.
- `src/styles/game-art.css`, clases decorativas y reducción de movimiento.
- `public/assets/scenes/{playroom,kitchen,dining,bedroom}`, `public/assets/guest`, `public/assets/intro-ending`: 109 archivos, 7.29 MB decimales, incluidos manifests y README de Astra. 66 sprites WebP con alpha verificado; ningún asset del índice falta.
- Este handoff.

Sin cambios propios en `src/ai/*`, contratos, niveles JSON, catálogo, ToySprite, selección aleatoria, coordenadas, tamaños de tiles, hitboxes, luz, timers, condiciones de victoria o dependencias.

## PROBADO

- `pnpm test`: 36/36, 10 archivos; `pnpm exec tsc --noEmit`: correcto; `pnpm build`: correcto sobre la base inicial.
- Con `09e4c30` incorporado: 37/37, 10 archivos; TypeScript y build correctos.
- Navegador local, viewport 375×812, `?ai=mock&forget=1`. Partida hasta pantalla final: salón 5/5, comedor 6/6 con checkpoint de comida, intercambio de vasos corregido y tercer puesto; dormitorio 3/3 con huida del juguete.
- Arrastre nativo del navegador y selección/clic del juguete + caja; cojín y cajón; luz desbloquea poseído y permite recogerlo; escondite encontrado. Segunda selección aleatoria con otro poseído y juguete tras cortina, 5/5 sobre la versión final.
- Cocina: los cinco contenedores se abren, recogidos seis objetos; navegación a comedor. Pistas de dueño y silla en oscuridad, vuelta a luz y corrección de piezas.
- Dormitorio: arrastrar haz, tocar pijama y cepillo iluminados; juguete huye una vez, se encuentra y recoge.
- Editor abierto y Playtest de tidy_roles operativo; consola del editor sin errores.
- DOM de cocina/dormitorio: cero imágenes rotas y documento 375×812 sin overflow. Los overlays decorativos no interceptan eventos.
- Capturas locales fuera del repo en `../astra-art-evidence/`: salón, cocina, comedor oscuro/final, dormitorio con haz e intro.

Un fallo transitorio de codificación durante edición dejó temporalmente TidyRoles sin export y Vite mostró errores de recarga. Se recuperó el archivo y se reaplicó únicamente el diff visual; TypeScript, build y pruebas finales pasan. Pestaña nueva con componente corregido usada para repetir los cinco roles. No ocultar estos mensajes de la sesión de desarrollo como si fueran errores de producción.

Al incorporar el avance de voz de main, HMR mezcló dos instancias del contexto y mostró `Guest voice must be used inside GameShell`. Se reinició el servidor y abrió una pestaña nueva. Partida completa repetida sobre `0b10c1e`: salón 5/5, cocina 6/6, comedor 6/6 con checkpoint e intercambio corregido, dormitorio 3/3 y final (2:55, incluye pausas de QA). Consola limpia, voz silenciada. No hubo que editar la implementación de voz. Editor recargado y Playtest activo de nuevo. Captura `14-mother-returns.jpg` contiene el detalle final con madre/niño/Guest; se pudo verificar visualmente el regreso anterior también. DOM final sin imágenes rotas y 375×812 sin overflow.

## Parcial / pendiente

- Algunas proporciones de muebles se adaptan al footprint existente y no reproducen exactamente la galería de Astra. Se mantienen las tarjetas de color por legibilidad/identidad y los indicadores de progreso con emojis.
- Máscaras de luz, SVG de marcas y sombras adicionales quedan preparados; el runtime conserva sus máscaras dinámicas y pistas para soportar niveles editados. No sustituirlas por las máscaras estáticas del pack.
- Mano del Guest, variantes crying y finales alternativos archivados sin disparadores nuevos. Baño `bathroom-EXPLORATION.webp` preparado, sin minijuego ni ruta de juego.
- Prueba en teléfono físico y pointerType touch pendiente: el navegador reproduce gestos a tamaño móvil, pero no equivale a un dispositivo táctil real.
- IA real, ElevenLabs con clave, rendimiento en dispositivo y despliegue público pendientes. Voz silenciada en la prueba; el modo mock no verifica API real.
- Warnings de build preexistentes: inputValidator obsoleto de TanStack, vite-tsconfig-paths y opción inlineDynamicImports de Nitro.
- Drive consultado como contexto, sin escrituras por falta de autorización específica. Registrar Tests/Handoffs cuando Iker lo autorice.

Siguiente paso: revisión visual en móvil físico, revisión de PR y aprobación humana del merge/publicación. No se ha hecho merge a main, force push ni despliegue.
