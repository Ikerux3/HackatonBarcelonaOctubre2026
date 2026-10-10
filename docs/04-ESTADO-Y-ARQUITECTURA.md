# 04 — ESTADO Y ARQUITECTURA | MOMMY WILL BE BACK

Actualizado: **10 oct 2026, 05:40** · Autor: Unai + Claude Code · base `main` @ `516db18` (Cordura + dos finales ya en `main`) · QA de regresión en producción: `docs/07-QA-REGRESION-IA.md` · **Evento 100 de la Cordura (D44) + Minijuego 03 "La caja de música" (D41)** en la rama `unai/cordura100-musicbox` (pendiente de PR)

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
| QA de regresión e IA real / respaldo (issue #2, P0-21) | `docs/07-QA-REGRESION-IA.md` |
| QA de partida completa (Flash) | `docs/07-QA-PARTIDA-COMPLETA.md` |

## 2. El juego en una frase

Un niño se queda solo en casa mientras mamá va a por la cena. Hace tareas (recoger juguetes, poner la mesa, prepararse para dormir) mientras se va la luz y **El Invitado**, un monstruo controlado por IA, le hace preguntas, **observa cómo juega** y usa todo lo que aprende para asustarle en la siguiente tarea.

## 3. Flujo de una partida (≈3–4 min medidos en QA antes de la caja de música, que añade ~1–2 min)

1. **Título** → Play. Aquí se sortea **una sola vez** el color del vestido de mamá para toda la partida.
2. **Mamá se despide** (aparece con ese vestido — pista provisional hasta el cómic) y se interrumpe para preguntar tu **nombre** (validado en el móvil, nunca sale del dispositivo).
3. **Tarea 1 — Recoger 5 juguetes** (Minijuego 01, rol según el orden): 1º arrastrar · 2º debajo del cojín · 3º dentro del cajón · **4º poseído** (apagón, se mueve en la oscuridad, se congela al iluminarlo) · 5º **escondido** (pistas visuales y sonoras).
4. **Apagón** → El Invitado pregunta tu **color favorito** (texto libre, cualquier idioma).
5. **Tarea 2 — La mesa para tres** (Minijuego 02, NUEVO):
   - **Cocina**: abrir armarios y cajones, recoger 6 piezas a la bandeja (pequeñas ⭐ para ti, en tu color; medianas 👗 para mamá, en el color de su vestido). La vajilla **gigante** es un señuelo.
   - **Comedor**: la primera vez sale una tarjeta "Setting the table" con los pasos. Con luz se colocan las piezas; los dos sitios parecen iguales. **Apagando la luz** aparecen las marcas y las sillas brillan con el color de cada uno (mamá = su vestido), pero El Invitado se acerca: ojos + temblor pequeño → temblor mediano → **susto completo**, que reinicia **solo la fase actual**.
   - Al llegar a 3 piezas bien (**checkpoint**): El Invitado pregunta tu **comida favorita** (IA) y aparece en la mesa… y se mancha de tinta.
   - Si sales y vuelves (o antes de la comprobación final), **intercambia dos piezas**.
   - Al terminar, coloca solo un **tercer servicio gigante**: *"How nice. Now we're all here."*
6. **Apagón** → pregunta tu **juguete favorito de pequeño**.
7. **Tarea 3 — La caja de música** (Minijuego 03, D41, NUEVO): El Invitado ha dado cuerda a la caja de música y quiere que le cantes su canción. **Con la luz apagada** los símbolos de la caja (luna, estrella, campana, corazón) brillan en orden; **con la luz encendida** se tocan en ese orden. Cuatro rondas de **3, 4, 5 y 7** símbolos, cada una empieza con la canción de la anterior y **se guarda al superarla**. Fallar solo borra lo tecleado en esa ronda (sin susto); para volver a ver la canción, apagar otra vez (relecturas ilimitadas). A oscuras sube la Cordura y, tras una vuelta de la canción, aparecen los ojos del Invitado detrás de la caja. Al final se gira la **llave** (3 toques) y la música se para. Apagón sin pregunta: *"Shh… fine. It's quiet now."*
8. **Tarea 4 — Dormir con linterna**: buscar pijama, cepillo y **tu juguete**, que huye la primera vez.
9. **Final** (decisión del equipo, 10 oct): susurro de tu nombre a oscuras → mamá vuelve de verdad (con su vestido) → **mamá y el niño en una habitación iluminada; en la de al lado, a oscuras, los ojos de El Invitado con tu juguete** → despedida del Invitado → **"What The Guest noticed about you"**. **Dos finales según la Cordura** (D34): de 0 a 64 mamá te encuentra algo asustado; de 65 a 100, llorando (lágrimas, otra frase de mamá y del Invitado). Mamá vuelve en los dos.

**Barra de Cordura** (D28/D33/D34; `src/game/cordura.ts`): de 0 a 100, cuanto más alta peor está el niño. Se ve arriba durante las tareas. **+1 cada 2 s a oscuras**, **+10 por susto completo**, **−1 cada 3 s con la luz encendida** (propuesta de MJ, **aprobada por Iker en D43**; se cambia en una línea).

**Evento 100** (D44, rama `unai/cordura100-musicbox`): al llegar a 100 hay **un** susto completo (ojos rojos a pantalla completa 1,6 s, sonido y vibración) y el minijuego actual **reinicia solo su fase** — conserva lo ya guardado, las respuestas y la memoria — y vuelve la luz para poder recuperarse. **No se repite** mientras sigas en 100: solo se rearma cuando la luz baja la barra a **90** (`CORDURA_RULES.rearmAt`, ~30 s con luz). Si es el susto propio de un minijuego (+10) el que llega a 100, ese ya cuenta como el susto y no se encadena otro. Qué reinicia cada minijuego: **juguetes** → el juguete poseído salta a otro hueco, se suelta si lo arrastrabas y se enciende la luz principal (los juguetes guardados se quedan); **mesa** → lo mismo que su propio susto (vuelve al checkpoint o a vacío en esta fase, luz encendida); **linterna** → lo encontrado se queda, el juguete que huye vuelve a su sitio y huirá otra vez; **caja de música** → solo se borra lo tecleado en la ronda actual (las rondas superadas se quedan) y se enciende la luz; **mesa simple** (`DragMinigame`, fuera de la historia) → solo el susto. Solo cuenta dentro de los minijuegos: se para en las preguntas (también la de la comida), los apagones entre tareas, la tarjeta de instrucciones y las escenas del monstruo (susto, intercambio, tercer servicio). Las fracciones de segundo se acumulan. Al **salir del último minijuego** se congela, y el final usa ese valor (no el máximo alcanzado); el apagón final y la vuelta de mamá no la cambian. Mientras no exista el minijuego del baño, el último es el de dormir con linterna, que cuenta **siempre como oscuridad** (la luz del cuarto está apagada; la linterna no cuenta como luz).

**Temblor de cámara** (regla del equipo): cada minijuego tiene su propia tensión, que sube con apagones, sustos y movimientos del monstruo; las sacudidas son cortas (≤0,7 s), con pausa mínima de 1,2 s entre ellas, y al pasar al siguiente minijuego todo vuelve a cero. Respeta "reducir movimiento" del sistema.

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

**Prueba en producción** (10 oct 01:45, `?debug=1`): decisiones del Invitado `live` (798 / 1230 ms), respuestas `live` (890 ms), notas finales escritas por el modelo. La pregunta de la comida se probó después en producción (10 oct 02:50, ver §8).

## 5. Modos para la demo (no visibles para el jugador)

| Añadir a la URL | Efecto |
|---|---|
| `?debug=1` | Insignia arriba a la izquierda: modo, si respondió la IA real, latencia, acción elegida |
| `?ai=live` / `?ai=mock` / `?ai=scripted` | IA real (por defecto) / sin red / frases fijas. **Se queda guardado en ese móvil** — comprobar antes de la demo |
| `?forget=1` | El Invitado olvida a jugadores anteriores en ese móvil |
| `?debug=1&cordura=95` | QA: la partida empieza con la Cordura en ese valor (para probar el evento 100 o los dos finales sin esperar). Solo junto a `debug=1` |
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
| `src/components/minigames/` | `TidyRolesMinigame` (juguetes), **`TableForThreeMinigame` (mesa para tres)**, **`MusicBoxMinigame` (caja de música)**, `DragMinigame` (mesa simple), `FlashlightMinigame` (linterna) |
| `src/game/musicBox.ts` | Reglas puras del Minijuego 03 (canción, rondas, fallo leve, qué brilla a oscuras en cada momento). La IA no las toca |
| `src/game/observer.ts` | Lo que El Invitado observa de tu partida + memoria entre partidas |
| `src/game/guestEffects.ts` | Traduce la acción elegida por la IA a efectos seguros en cada nivel |
| `src/ai/` | Contrato (`contracts.ts`), funciones de servidor, adaptadores con respaldo y modos |
| `src/components/game/` | Pantallas: intro, preguntas, overlay del Invitado, final |
| `src/styles/game-art.css` + `CorruptionLayer.tsx` | **Capa visual** (Lovable/Iker): tipografías, salas tipo diorama, marcos de madera, grano, tinta/corrupción por tarea (0–3), estilo del Invitado. Solo presentación: nunca guarda estado del juego |
| `public/assets/toys/` + `ToySprite.tsx` | Sprites reales de juguetes (Codex), con variante "poseído" para algunos |
| `src/game/cameraShake.ts` | Temblor de cámara por minijuego (tensión progresiva, ráfagas cortas con pausa, vuelve a cero) |
| `src/game/cordura.ts` + `CorduraMeter.tsx` | **Barra de Cordura**: reglas y velocidades (`CORDURA_RULES`), congelación, final y **evento 100**. Cada minijuego avisa si estás con luz o a oscuras (`useCorduraLight`) y qué reinicia al llegar a 100 (`useCordura100`); el tiempo se cuenta en `GameController` y el susto del 100 lo pinta `GameScreen` |
| `src/components/game/Figures.tsx` | Siluetas provisionales de mamá (con el color de su vestido) y del niño |
| `src/test/` | Tests automáticos (59) |

## 7. Cómo se ha construido (para los 20 puntos de "How you built it")

| Fase | Quién | Qué |
|---|---|---|
| Diseño y coordinación | Equipo + ChatGPT (3 cuentas) | Concepto, documentos 00–03, El Invitado, Minijuegos 01 y 02 |
| Iteraciones 1–10 | Iker + **Lovable** (prompts redactados con ayuda de Claude) | Base del juego, minijuegos, editor, IA de interpretación, final |
| Iteraciones 11–14 | Unai + **Claude Code** (Claude Opus 5.5) | Bugs del poseído, remate del final, El Invitado adaptativo, versión móvil, niveles modulares, **Minijuego 02**, pregunta de comida, tests, verificación en producción |
| Renovación visual | Iker + **Lovable** | Capa de arte `game-art.css`, corrupción, nuevas pantallas de título, nombre, preguntas y final |
| Sprites de juguetes | **Codex** | Juguetes en imagen (`public/assets/toys/`) + test visual |
| Fusión | Unai + **Claude Code** | Merge de la renovación visual con las aclaraciones del equipo (6 conflictos resueltos, probado de punta a punta) |
| Arte restante | Flash / MJ / Iker + ChatGPT (imágenes) | En curso (fondos pintados, cómic de intro) |

**PENDIENTE**: anotar créditos de Lovable gastados y tokens consumidos por cada cuenta (ChatGPT, Claude).

## 8. Estado

**VERIFICADO**
- **Minijuego 03 — caja de música (D41; local, Chromium 340×554, IA mock, rama `unai/cordura100-musicbox`)**: partida completa (con niveles cortos en las tareas 1 y 2 para llegar antes) → tras la pregunta del juguete sale la caja de música con la frase del Invitado y su plan (sombra que cruza); a oscuras brilla un símbolo cada vez (los demás tenues) y tras una vuelta aparecen sus ojos detrás de la caja; con luz se teclea; rondas 3 → 4 → 5 → 7 superadas, cada una empezando con la anterior (también con dos símbolos iguales seguidos); fallo en la ronda 2 → solo se borra esa ronda + *"No, no. That's not how my song goes."*; la Cordura sube a oscuras; llave 3 toques → *"Shh… fine. It's quiet now."* → apagón con esa frase → el Invitado planifica la tarea siguiente (`weak_flashlight`) → dormir con linterna. La fila de abajo y la llave quedan por encima del subtítulo del Invitado. Playtest en `/editor` OK. Tests (59/59): rondas 3/4/5/7 acumulativas, fallo leve, canciones aleatorias válidas, temporización del brillo, validador, componente jugado entero (solo se ve a oscuras, solo se teclea con luz, la llave lo termina, Cordura deja de contar), evento 100 / apagar la luz solo reinician la ronda actual, orden de etapas.
- **Evento 100 (D44; local, Chromium 340×554, IA mock, rama `unai/cordura100-musicbox`, `?debug=1&cordura=97`)**: la barra empieza en 97 y baja con luz; juguetes 1–3 guardados; en el apagón del poseído sube de 82 a 100 → susto a pantalla completa 1,6 s → luz principal encendida y la barra baja (99, 97…), los 3 juguetes siguen guardados (3/5). Un apagón automático posterior la devuelve a 100 y **no** hay segundo susto (no se ha rearmado). Tests (51/51): un solo evento aunque sigas un minuto en 100; rearme solo al bajar a 90; el susto propio que llega a 100 no encadena otro; nada fuera de los minijuegos ni tras el último; el controlador avisa al minijuego activo una vez por evento; 0/64/65/100 siguen eligiendo el mismo final.
- **QA de regresión tras el merge visual (10 oct ~04:15, producción, escritorio Edge, `main` @ `a93df9f`)** — detalle en `docs/07`:
  - Repo: 25/25 tests, `tsc` y build PASS; lint falla solo por formato (prettier) en archivos de la renovación visual; ningún secreto en el código del navegador.
  - Partidas A y B con respuestas distintas: interpretación y decisiones del Invitado `live`, `fallback: false` (820–1617 ms); resultados distintos en piezas, comida, juguete, final y notas. La partida B recordó la A ("You change your favorite color every night").
  - Partida C sin conexión: todo `mock-fallback` y partida completa sin bloqueo.
- Partida completa de principio a fin con la mesa para tres (local, IA de respaldo, móvil simulado 375×667).
- Minijuego 02: aviso "no lo has encontrado todo", señuelo gigante, 6 piezas a la bandeja, marcas a oscuras (⭐/👗 con colores), pieza en hueco de otro tipo rechazada, susto completo a los 9 s con reinicio de fase, checkpoint a 3 correctas → pregunta de comida ("pizza con piña" → 🍕 + tinta), intercambio de dos piezas antes de la comprobación final, tercer servicio y frase final, la historia continúa.
- IA real en producción (color, juguete y decisiones del Invitado), latencias < 1,5 s.
- Versión móvil: sin scroll ni barra lateral, el campo de respuesta queda sobre el teclado, sin zoom.
- Niveles modulares + 33 tests automáticos + TypeScript sin errores.
- **Barra de Cordura + dos finales (local, Chromium 375×667, IA mock, rama `claude/keen-lamport-y3wb6h`)**: apagón del juguete poseído 6 s → +3; luz encendida 6 s → −2; la pregunta del color no la mueve; comedor a oscuras con susto a los 9 s → 0 → 14 (+4 de oscuridad +10 del susto); final con 1 → "a little scared"; final con 71 → mamá "you're crying…", niño con lágrimas, "Shh… don't cry" y "Mom found you crying". Sin errores en consola; la escena cabe sin scroll. Tests: 64/65, 70 → 40, congelado tras el último minijuego, pausa en preguntas y apagones, tope 100.

- **Producción (10 oct 02:50, `?debug=1`)**: decisión del Invitado `live` 787 ms; color `live` 857 ms; **comida `live` 1107 ms** ("los macarrones con queso de mi abuela" → 🍝, frase del modelo sobre la abuela).
- **Regresión tras la renovación visual (10 oct ~04:15, `a93df9f`, producción, `?debug=1`)**: dos partidas con IA real y respuestas distintas (`fallback: false` en interpretación y decisiones del Invitado, 820–1617 ms; mesa, juguete, final y notas distintos; el Invitado recuerda la partida anterior) y una sin conexión que llega al final con el respaldo. Detalle y handoff: `docs/07`.
- Aclaraciones del equipo (local, móvil simulado): mamá con el color sorteado en la intro y el mismo en su vajilla y silla; tarjeta de instrucciones; temblor nivel 1 a los 4 s y nivel 2 a los 7 s a oscuras, con pausas; la tensión empieza de cero en cada minijuego; final con dos habitaciones.

**HECHO, falta probar**
- Intercambio al salir y volver al comedor (probado el caso "antes de la comprobación final").
- Controles táctiles en iPhone Safari y Android Chrome reales.
- Que la versión publicada en Lovable sea `a93df9f` (lo confirma Iker).
- Revisión visual detallada en producción del color de mamá, el temblor y el final de dos habitaciones (en QA se llegó al final sin incidencias, sin revisarlo en detalle).

**DECISIONES DEL EQUIPO (aclaración 10 oct) — IMPLEMENTADAS**
- Susto completo → reinicia **solo la fase actual**, conserva todo lo anterior; un susto no pasa al siguiente minijuego; errores pequeños no penalizan.
- Temblor progresivo, limitado y con pausas por minijuego; vuelve a cero en el siguiente.
- Vestido de mamá: sorteado una vez al pulsar Play (`GameMemory.motherColor`); mismo color en la intro (figura provisional), su vajilla, sus marcas, su silla (a oscuras) y el final. No se vuelve a sortear.
- ~~No hay final malo~~ → **superado por D34: dos finales según la Cordura, implementados** (rama `claude/keen-lamport-y3wb6h`). En los dos: mamá y el niño en la habitación iluminada, El Invitado insinuado en la de al lado a oscuras.
- Sin cambios en los contratos de IA.

**PENDIENTE DE COORDINAR (Iker)**
- Encajar el reinicio por fase y el desenlace con las decisiones generales anteriores (D14).
- La silla de mamá se ilumina con su color **solo a oscuras** (con luz, colorearla revelaría qué sitio es de quién y el puzle de la oscuridad dejaría de tener sentido). Si se quiere siempre coloreada, es un cambio de una línea.
- **Decisiones nuevas de Iker en Drive (D32–D35)**: barra de **Cordura** y **dos finales** → **implementados** (ver §3); velocidad con luz aprobada (D43); evento 100 (D44) implementado. Pendiente de Iker/MJ: confirmar que la linterna del dormitorio cuenta como oscuridad; el nombre "Cordura" en un juego en inglés; afinar el rearme a 90 tras probarlo. **Cinco minijuegos**: MG03 (caja de música) **implementado** como 4.ª tarea (slot `task_music`); **MG04 (cuarto de mamá) pendiente** — irá en otro slot entre la caja de música y dormir.
- **MG03, para MJ (dueña de las reglas)**: textos en inglés del Invitado y pistas (en `music_box.json`), tiempos de brillo (650 ms + 300 ms, pausa 1,6 s), 3 toques de llave, sin sonido propio por símbolo (de momento un "clic" en cada uno; **Flash** puede darle una nota a cada símbolo — C21), y la caja de música de fondo se para al girar la llave y no vuelve hasta dormir.

**PENDIENTE (por prioridad)**
1. PR de `unai/cordura100-musicbox` (evento 100 + caja de música) → merge a `main` + Publish.
2. Iker confirma qué commit está publicado en Lovable.
3. QA en móvil físico (Unai/MJ).
4. Arte (en curso) → integrar (sustituye a las siluetas provisionales de mamá y el niño).
5. Lint de formato (prettier) en los archivos de la renovación visual.
6. Vídeo de respaldo de la demo + guion de 2–3 min.
7. Registro de "cómo lo construimos" con créditos y tokens.

**Riesgos**: wifi en la demo (mitigado con `?ai=scripted` y vídeo) · `?ai=` y la memoria del Invitado se quedan guardados en el móvil (abrir con `?ai=live` explícito; `?forget=1`) · la partida dura 3–4 min · insignia "Edit with Lovable" visible durante la partida (Iker puede ocultarla en los ajustes de Lovable).

## 9. Handoff

- **Responsable**: Unai + Claude Code
- **Estado**: `main` @ `516db18` (Cordura + dos finales fusionados). Evento 100 de la Cordura (D44) y Minijuego 03 (caja de música, D41) hechos y probados en local, **pendientes de PR y Publish**.
- **Rama / commit**: `unai/cordura100-musicbox` (sale de `main` @ `516db18`)
- **Siguiente paso**: PR + merge + Publish; QA de MJ en móvil (caja de música a 375 px, evento 100); Minijuego 04 (cuarto de mamá, D42/D45) con Flash para las voces; integrar arte cuando esté.
