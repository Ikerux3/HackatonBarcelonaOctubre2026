# 04 — ESTADO Y ARQUITECTURA | MOMMY WILL BE BACK

Actualizado: **10 oct 2026, 01:56** · Autor: Unai + Claude Code · Commit de referencia: `8cd9f05` (main)

> Documento de orden: qué hay hecho, cómo está construido y qué falta. Distingue **VERIFICADO** (probado con evidencia), **HECHO** (en el código, sin prueba completa) y **PENDIENTE**.

---

## 1. Enlaces

| Qué | Dónde |
|---|---|
| Juego publicado (demo) | https://embrace-weave-guide.lovable.app/ |
| Repositorio (fuente de verdad del código) | https://github.com/Ikerux3/HackatonBarcelonaOctubre2026 |
| Proyecto Lovable | https://lovable.dev/projects/fc5f64f1-724c-427a-a58f-66f648c2d869 |
| Carpeta Drive del equipo | https://drive.google.com/drive/folders/1dxyM4McxXHxplu6rjcJumJPAt22R9_cB |
| Informe técnico detallado (por iteraciones) | `DEV_REPORT.md` en el repo |

## 2. El juego en una frase

Un niño se queda solo en casa mientras mamá va a por la cena. Hace tareas (recoger juguetes, poner la mesa, prepararse para dormir) mientras se va la luz y **El Invitado**, un monstruo controlado por IA, le hace preguntas, **observa cómo juega** y usa todo lo que aprende para asustarle en la siguiente tarea.

## 3. Flujo de una partida (≈2 min)

1. **Título** → Play.
2. **Mamá se despide** y se interrumpe para preguntar tu **nombre** (validado en el móvil, nunca sale del dispositivo).
3. **Tarea 1 — Recoger 5 juguetes** (rol según el orden, no según el juguete):
   1º arrastrar · 2º debajo del cojín · 3º dentro del cajón · **4º poseído** (apagón, se mueve en la oscuridad, se congela al iluminarlo con interruptor o lámpara) · 5º **escondido** (pistas visuales y sonoras).
4. **Apagón** → El Invitado pregunta tu **color favorito** (texto libre, cualquier idioma).
5. **Tarea 2 — Poner la mesa**: tu color ha sido **robado** (el objeto aparece en sombra) + la acción que la IA eligió para ti.
6. **Apagón** → pregunta tu **juguete favorito de pequeño**.
7. **Tarea 3 — Dormir con linterna**: buscar pijama, cepillo y **tu juguete**, que huye la primera vez + acción elegida por la IA.
8. **Final**: susurro de tu nombre a oscuras → mamá vuelve de verdad → tu juguete está sobre la mesa y falta tu color → despedida del Invitado → pantalla final con **"What The Guest noticed about you"**.

## 4. La IA dentro del juego (VERIFICADO en producción, 10 oct 01:45)

Dos llamadas a un modelo de lenguaje real (**Gemini 3.1 Flash Lite** vía Lovable AI Gateway), siempre desde el **servidor** (la clave `LOVABLE_API_KEY` nunca llega al navegador).

| Llamada | Cuándo | Qué recibe | Qué devuelve | Efecto visible |
|---|---|---|---|---|
| **Interpretar respuesta** (`src/ai/interpret.functions.ts`) | Al contestar una pregunta | Tu texto libre (máx. 60 caracteres) | Categoría (color/juguete), paráfrasis limpia, frase del monstruo | Color robado en la mesa, tu juguete en la linterna y en el final |
| **Decisión del Invitado** (`src/ai/guest.functions.ts`) | Durante cada apagón | Hechos observados de tu partida (tiempos, fallos, dónde buscaste, qué luz usaste…), respuestas ya validadas, memoria de la partida anterior. **Nunca texto escrito por el jugador** | Una acción de una lista cerrada + una frase que cita algo que hiciste + una nota sobre ti | Cambia el comportamiento del monstruo en la siguiente tarea y aparece en la pantalla final |

**Acciones posibles del Invitado** (nunca tocan la condición de victoria): mover algo que ya colocaste · iluminar un hueco falso · parpadeo de luz · linterna más débil · sombra que cruza la habitación · solo observar.

**Cómo "aprende"** (para el pitch, dicho con honestidad): no se reentrena; razona en contexto sobre todo lo que ha observado de ti en esta partida y en la anterior (memoria en el propio móvil). Cada partida es distinta porque depende de cómo juegas.

**Seguridad y robustez**: salida JSON validada (zod) · acciones limitadas a lo que el nivel soporta · nunca se muestra el texto crudo del jugador (solo paráfrasis limpias) · nombre filtrado localmente · si la IA falla o tarda (>5–6 s), reglas deterministas de respaldo que también reaccionan a cómo juegas.

**Prueba en producción** (partida real en la URL publicada con `?debug=1`): decisión 1 `live`, 798 ms → `disturb_item`; respuesta color → `red`; decisión 2 `live`, 1230 ms → `light_flicker`; respuesta juguete `live`, 890 ms → `ball`; notas finales escritas por el modelo: *"You always rush through your chores."*, *"You always look behind the sofa first."* Ningún respaldo usado.

## 5. Modos para la demo (no visibles para el jugador)

| Añadir a la URL | Efecto |
|---|---|
| `?debug=1` | Insignia arriba a la izquierda: modo, si respondió la IA real, latencia, acción elegida |
| `?ai=live` / `?ai=mock` / `?ai=scripted` | IA real (por defecto) / sin red / frases fijas para un pitch 100 % predecible. **Se queda guardado en ese móvil** — comprobar antes de la demo |
| `?forget=1` | El Invitado olvida a jugadores anteriores en ese móvil (usar antes de pasar el móvil al jurado) |
| `/editor` | Editor de niveles y perfil de demo (orden de niveles, frases guionizadas, exportar/importar). Nunca enlazado desde el juego |

## 6. Arquitectura

**Stack**: TanStack Start + React 19 + Vite + Tailwind, funciones de servidor de TanStack, Lovable AI Gateway. Sin login, sin base de datos. Despliegue: Publish de Lovable.

| Carpeta / archivo | Qué hace |
|---|---|
| `src/game/GameState.ts` | Máquina de estados explícita de la partida (etapas, memoria, decisiones del Invitado) |
| `src/game/GameController.ts` | Temporizadores, audio, llamadas a la IA |
| `src/game/levels/data/` | **Un archivo JSON por nivel** + `story.json` (qué nivel va en cada tarea). Se editan sin tocar código: ver `docs/05-COMO-EDITAR-NIVELES.md` |
| `src/game/levels/` | Carga y validación de niveles (`defaultLevels.ts`, `types.ts`, `validate.ts`, `assets.ts`) |
| `src/components/game/GameShell.tsx` | Contenedor móvil: ocupa exactamente la zona visible (se encoge con el teclado), sin scroll, sin zoom, aviso de girar el móvil |
| `src/components/minigames/` | Minijuegos: `TidyRolesMinigame` (juguetes), `DragMinigame` (mesa), `FlashlightMinigame` (linterna) |
| `src/game/observer.ts` | Lo que El Invitado observa de tu partida + memoria entre partidas |
| `src/game/guestEffects.ts` | Traduce la acción elegida por la IA a efectos seguros en cada nivel |
| `src/ai/` | Contrato (`contracts.ts`), funciones de servidor, adaptadores con respaldo y modos |
| `src/components/game/` | Pantallas: intro, preguntas, overlay del Invitado, final |
| `src/test/` | Tests automáticos (11) |

## 7. Cómo se ha construido (para los 20 puntos de "How you built it")

| Fase | Quién | Qué |
|---|---|---|
| Diseño y coordinación | Equipo + ChatGPT (3 cuentas) | Concepto, documentos 00–03, diseño de El Invitado y Minijuego 01 |
| Iteraciones 1–10 | Iker + **Lovable** (prompts redactados con ayuda de Claude) | Base del juego, minijuegos, editor, IA de interpretación, final |
| Iteraciones 11–12 | Unai + **Claude Code** (Claude Opus 5.5) | Corrección de bugs del poseído, remate del final, El Invitado adaptativo (observador + segunda llamada a la IA), tests, verificación en producción |
| Arte | Flash / MJ + ChatGPT (imágenes) | En curso |

**PENDIENTE**: anotar créditos de Lovable gastados y tokens consumidos por cada cuenta (ChatGPT, Claude) — las bases piden publicarlo.

## 8. Estado

**VERIFICADO**
- Partida completa de principio a fin (local y producción).
- IA real en producción (las dos llamadas), latencias < 1,5 s.
- Bug del poseído corregido (la luz ya no se reapaga al encenderla tras >9 s a oscuras).
- 14 tests automáticos + TypeScript sin errores (incluye test que valida todos los niveles JSON).
- Versión móvil (simulada a 375×667 y con teclado a 375×380): sin scroll ni barra lateral, el campo de respuesta queda sobre el teclado, sin zoom, aviso al girar el móvil.
- Niveles modulares: un JSON por nivel en `src/game/levels/data/`, orden en `story.json`.

**HECHO, falta probar en dispositivo real**
- Controles táctiles en iPhone Safari y Android Chrome (solo probado en simulación).

**PENDIENTE (por prioridad)**
1. Arte (en curso) → integrar en el juego.
2. Mejorar jugabilidad y repercusión de lo que escribes (en curso, ver propuesta).
3. Prueba en móviles reales.
4. Vídeo de respaldo de la demo + guion de 2–3 min.
5. Página/registro de "cómo lo construimos" con créditos y tokens.

**Riesgos**: wifi en la demo (mitigado con `?ai=scripted` y vídeo) · `?ai=` y la memoria del Invitado se quedan guardados en el móvil (usar `/editor` para comprobar y `?forget=1`).

## 9. Handoff

- **Responsable**: Unai + Claude Code
- **Estado**: El Invitado adaptativo desplegado y verificado en producción.
- **Rama / commit**: `main` @ `8cd9f05`
- **Siguiente paso**: integrar arte en cuanto esté; mejorar repercusión de las respuestas; pruebas en móvil real.
