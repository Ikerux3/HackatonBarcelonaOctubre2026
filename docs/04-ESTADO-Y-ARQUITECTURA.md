# 04 — ESTADO Y ARQUITECTURA | MOMMY WILL BE BACK

Actualizado: **10 oct 2026, 02:30** · Autor: Unai + Claude Code · Base: `main` @ `b887c4b` + rama `unai/table-for-three` (Minijuego 02)

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
| Cómo editar niveles | `docs/05-COMO-EDITAR-NIVELES.md` |

## 2. El juego en una frase

Un niño se queda solo en casa mientras mamá va a por la cena. Hace tareas (recoger juguetes, poner la mesa, prepararse para dormir) mientras se va la luz y **El Invitado**, un monstruo controlado por IA, le hace preguntas, **observa cómo juega** y usa todo lo que aprende para asustarle en la siguiente tarea.

## 3. Flujo de una partida (≈3 min)

1. **Título** → Play.
2. **Mamá se despide** y se interrumpe para preguntar tu **nombre** (validado en el móvil, nunca sale del dispositivo).
3. **Tarea 1 — Recoger 5 juguetes** (Minijuego 01, rol según el orden): 1º arrastrar · 2º debajo del cojín · 3º dentro del cajón · **4º poseído** (apagón, se mueve en la oscuridad, se congela al iluminarlo) · 5º **escondido** (pistas visuales y sonoras).
4. **Apagón** → El Invitado pregunta tu **color favorito** (texto libre, cualquier idioma).
5. **Tarea 2 — La mesa para tres** (Minijuego 02, NUEVO):
   - **Cocina**: abrir armarios y cajones, recoger 6 piezas a la bandeja (pequeñas ⭐ para ti, en tu color; medianas 👗 para mamá, en el color de su vestido). La vajilla **gigante** es un señuelo.
   - **Comedor**: con luz se colocan las piezas; los dos sitios parecen iguales. **Apagando la luz** aparecen las marcas de quién se sienta dónde (cambia cada partida), pero El Invitado se acerca: ojos → temblor → **susto completo**, que reinicia **solo la fase actual**.
   - Al llegar a 3 piezas bien (**checkpoint**): El Invitado pregunta tu **comida favorita** (IA) y aparece en la mesa… y se mancha de tinta.
   - Si sales y vuelves (o antes de la comprobación final), **intercambia dos piezas**.
   - Al terminar, coloca solo un **tercer servicio gigante**: *"How nice. Now we're all here."*
6. **Apagón** → pregunta tu **juguete favorito de pequeño**.
7. **Tarea 3 — Dormir con linterna**: buscar pijama, cepillo y **tu juguete**, que huye la primera vez.
8. **Final**: susurro de tu nombre a oscuras → mamá vuelve de verdad → tu juguete sobre la mesa y falta tu color → despedida del Invitado → **"What The Guest noticed about you"**.

## 4. La IA dentro del juego (VERIFICADO en producción, 10 oct 01:45)

Llamadas a un modelo de lenguaje real (**Gemini 3.1 Flash Lite** vía Lovable AI Gateway), siempre desde el **servidor** (la clave `LOVABLE_API_KEY` nunca llega al navegador).

| Llamada | Cuándo | Qué recibe | Qué devuelve | Efecto visible |
|---|---|---|---|---|
| **Interpretar respuesta** (`src/ai/interpret.functions.ts`) | Al contestar color, juguete o **comida** (nuevo) | Tu texto libre (máx. 60 caracteres) | Categoría, paráfrasis limpia, frase del monstruo | Tus piezas en tu color, tu comida en la mesa, tu juguete en la linterna y en el final |
| **Decisión del Invitado** (`src/ai/guest.functions.ts`) | Durante cada apagón | Hechos observados de tu partida (tiempos, fallos, dónde buscaste, qué luz usaste, **sustos sufridos**…), respuestas ya validadas, memoria de la partida anterior. **Nunca texto escrito por el jugador** | Una acción de una lista cerrada + una frase que cita algo que hiciste + una nota sobre ti | Cambia el comportamiento del monstruo en la siguiente tarea y aparece en la pantalla final |

**Comida**: solo cuenta lo comestible (*"a wheel"* → otra cosa; *"a cheese wheel"* → queso). Si la respuesta no es válida o la IA falla, sale un plato genérico y el juego sigue.

**Acciones posibles del Invitado** (nunca tocan la condición de victoria): mover algo que ya colocaste · iluminar un hueco falso · parpadeo de luz · linterna más débil · sombra que cruza la habitación · solo observar.

**Cómo "aprende"** (para el pitch, dicho con honestidad): no se reentrena; razona en contexto sobre todo lo que ha observado de ti en esta partida y en la anterior (memoria en el propio móvil).

**Seguridad y robustez**: salida JSON validada (zod) · acciones limitadas a lo que el nivel soporta · nunca se muestra el texto crudo del jugador · nombre filtrado localmente · si la IA falla o tarda, reglas deterministas de respaldo.

**Prueba en producción** (10 oct 01:45, `?debug=1`): decisiones del Invitado `live` (798 / 1230 ms), respuestas `live` (890 ms), notas finales escritas por el modelo. La pregunta de la comida **aún no está probada en producción** (solo en local con el respaldo).

## 5. Modos para la demo (no visibles para el jugador)

| Añadir a la URL | Efecto |
|---|---|
| `?debug=1` | Insignia arriba a la izquierda: modo, si respondió la IA real, latencia, acción elegida |
| `?ai=live` / `?ai=mock` / `?ai=scripted` | IA real (por defecto) / sin red / frases fijas. **Se queda guardado en ese móvil** — comprobar antes de la demo |
| `?forget=1` | El Invitado olvida a jugadores anteriores en ese móvil |
| `/editor` | Editor de niveles y perfil de demo. Nunca enlazado desde el juego |

## 6. Arquitectura

**Stack**: TanStack Start + React 19 + Vite + Tailwind, funciones de servidor de TanStack, Lovable AI Gateway. Sin login, sin base de datos. Despliegue: Publish de Lovable.

| Carpeta / archivo | Qué hace |
|---|---|
| `src/game/GameState.ts` | Máquina de estados de la partida (etapas, memoria, decisiones del Invitado) |
| `src/game/GameController.ts` | Temporizadores, audio, llamadas a la IA |
| `src/game/levels/data/` | **Un JSON por nivel** + `story.json` (qué nivel va en cada tarea). Ver `docs/05` |
| `src/game/levels/` | Carga y validación de niveles (`defaultLevels.ts`, `types.ts`, `validate.ts`, `assets.ts`) |
| `src/components/game/GameShell.tsx` | Contenedor móvil: ocupa la zona visible (se encoge con el teclado), sin scroll ni zoom |
| `src/components/minigames/` | `TidyRolesMinigame` (juguetes), **`TableForThreeMinigame` (mesa para tres)**, `DragMinigame` (mesa simple), `FlashlightMinigame` (linterna) |
| `src/game/observer.ts` | Lo que El Invitado observa de tu partida + memoria entre partidas |
| `src/game/guestEffects.ts` | Traduce la acción elegida por la IA a efectos seguros en cada nivel |
| `src/ai/` | Contrato (`contracts.ts`), funciones de servidor, adaptadores con respaldo y modos |
| `src/components/game/` | Pantallas: intro, preguntas, overlay del Invitado, final |
| `src/test/` | Tests automáticos (19) |

## 7. Cómo se ha construido (para los 20 puntos de "How you built it")

| Fase | Quién | Qué |
|---|---|---|
| Diseño y coordinación | Equipo + ChatGPT (3 cuentas) | Concepto, documentos 00–03, El Invitado, Minijuegos 01 y 02 |
| Iteraciones 1–10 | Iker + **Lovable** (prompts redactados con ayuda de Claude) | Base del juego, minijuegos, editor, IA de interpretación, final |
| Iteraciones 11–14 | Unai + **Claude Code** (Claude Opus 5.5) | Bugs del poseído, remate del final, El Invitado adaptativo, versión móvil, niveles modulares, **Minijuego 02**, pregunta de comida, tests, verificación en producción |
| Arte | Flash / MJ / Iker + ChatGPT (imágenes) | En curso |

**PENDIENTE**: anotar créditos de Lovable gastados y tokens consumidos por cada cuenta (ChatGPT, Claude).

## 8. Estado

**VERIFICADO**
- Partida completa de principio a fin con la mesa para tres (local, IA de respaldo, móvil simulado 375×667).
- Minijuego 02: aviso "no lo has encontrado todo", señuelo gigante, 6 piezas a la bandeja, marcas a oscuras (⭐/👗 con colores), pieza en hueco de otro tipo rechazada, susto completo a los 9 s con reinicio de fase, checkpoint a 3 correctas → pregunta de comida ("pizza con piña" → 🍕 + tinta), intercambio de dos piezas antes de la comprobación final, tercer servicio y frase final, la historia continúa.
- IA real en producción (color, juguete y decisiones del Invitado), latencias < 1,5 s.
- Versión móvil: sin scroll ni barra lateral, el campo de respuesta queda sobre el teclado, sin zoom.
- Niveles modulares + 19 tests automáticos + TypeScript sin errores.

**HECHO, falta probar**
- Pregunta de comida con la IA real (en producción, tras el merge + Publish).
- Intercambio al salir y volver al comedor (probado el caso "antes de la comprobación final").
- Controles táctiles en iPhone Safari y Android Chrome reales.

**DECISIONES PENDIENTES DEL EQUIPO**
- **Regla del susto (D14 vs Minijuego 02)**: implementado tal como dice el diseño de MJ (susto completo → se repite solo la fase actual y suma un error relevante). Iker tiene que confirmarlo; se cambia en el JSON (`table.dark`) sin código.
- **Color del vestido de mamá**: el diseño dice que se muestra en la intro cómic, que aún no existe; de momento se elige al azar y se ve en las marcas 👗.
- **Final malo por corrupción**: los sustos ya se cuentan (`fullScares`), pero no hay umbral ni final malo hasta que Iker y MJ lo decidan.
- **Seis minijuegos**: objetivo del producto; ahora hay tres en la historia.

**PENDIENTE (por prioridad)**
1. Merge de `unai/table-for-three` + Publish en Lovable + probar la pregunta de comida en producción con `?debug=1`.
2. Arte (en curso) → integrar.
3. Prueba en móviles reales.
4. Vídeo de respaldo de la demo + guion de 2–3 min.
5. Registro de "cómo lo construimos" con créditos y tokens.

**Riesgos**: wifi en la demo (mitigado con `?ai=scripted` y vídeo) · `?ai=` y la memoria del Invitado se quedan guardados en el móvil · la partida es más larga (~3 min) con la mesa nueva.

## 9. Handoff

- **Responsable**: Unai + Claude Code
- **Estado**: Minijuego 02 implementado y jugado de principio a fin en local; pendiente de merge y prueba en producción.
- **Rama / commit**: `unai/table-for-three` (sobre `main` @ `b887c4b`)
- **Siguiente paso**: merge + Publish; probar comida con IA real; integrar arte cuando esté.
