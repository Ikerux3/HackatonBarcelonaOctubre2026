# 05 — CÓMO AÑADIR Y EDITAR NIVELES (sin tocar código)

Cada nivel es **un archivo `.json`** en `src/game/levels/data/`. El orden de la partida está en **`src/game/levels/data/story.json`**. El juego los carga solo: no hay que tocar ningún archivo de código.

```
src/game/levels/data/
├── story.json          ← qué nivel se juega en cada tarea
├── tidy_toys.json      ← Tarea 1: recoger juguetes (roles, poseído, escondite)
├── table_for_three.json ← Tarea 2: la mesa para tres (Minijuego 02)
├── music_box.json      ← Tarea 3: la caja de música (Minijuego 03, slot task_music)
├── bedtime.json        ← última tarea: dormir con linterna (slot task_three)
├── set_table.json      ← mesa simple anterior (plantilla, ya no está en la historia)
└── tidy_toys_drag.json ← versión simple de recoger juguetes (plantilla)
```

## Editar un nivel existente

**Opción A — con el editor (recomendado):**
1. Abre el juego con `/editor` al final de la dirección (por ejemplo `http://localhost:5173/editor` o `https://embrace-weave-guide.lovable.app/editor`).
2. Elige el nivel, cambia lo que quieras (posiciones arrastrando, textos, pistas, tiempos…) y pulsa **Playtest** para probarlo.
3. **Export JSON** → copia el texto.
4. Pégalo sustituyendo el contenido del archivo correspondiente en `src/game/levels/data/`.

**Opción B — a mano:** abre el `.json` y cambia los valores (textos, `x`/`y` en % de la escena, tiempos en ms…).

## Añadir un nivel nuevo

1. En `/editor` crea uno desde una plantilla (**+ Drag to box**, **+ Place items**, **+ Flashlight find**, **+ Tidy roles**) o duplica uno existente.
2. Dale un `id` único, sin espacios (por ejemplo `kitchen_mess`).
3. **Export JSON** y guárdalo como `src/game/levels/data/kitchen_mess.json` (el nombre del archivo = el `id`).
4. Aparece automáticamente en el editor. Para que se juegue en la partida, ponlo en `story.json`:

```json
{
  "story": {
    "task_one": "tidy_toys",
    "task_two": "kitchen_mess",
    "task_music": "music_box",
    "task_three": "bedtime"
  },
  "editorOrder": ["tidy_toys", "set_table", "bedtime", "tidy_toys_drag", "table_for_three", "music_box"]
}
```

**Orden de la partida** (los nombres de los slots son fijos; el nivel de cada uno lo eliges tú): `task_one` → apagón + pregunta del color → `task_two` → apagón + pregunta del juguete → **`task_music`** → apagón (sin pregunta) → `task_three` (la última: al salir se congela la Cordura) → final.

> No borres ni renombres los archivos de serie: el editor los usa como plantillas. Para variaciones, **copia** el archivo con otro `id`. Si añades un archivo nuevo, ponlo **al final** de `editorOrder` (el editor guarda las elecciones como "builtin-N" por posición).

## Comprobar antes de subir

```bash
bun run test
```

El test **"level files"** falla si algún nivel tiene un error (campo que falta, posición fuera de 0–100, `id` repetido, `story.json` apuntando a un nivel que no existe…) y dice exactamente qué archivo y qué campo. Si aun así se sube un nivel roto, **el juego no se rompe**: en esa tarea aparece "This level is broken" con un botón **Skip level**.

## Qué puede tocar la IA y qué no

- El Invitado (IA) **puede**: robar un color, cambiar el sprite del objeto que huye por tu juguete, mover algo ya colocado, iluminar un hueco falso, hacer parpadear la luz, debilitar la linterna, cruzar la habitación como sombra.
- **Nunca** toca: los objetos que hay que colocar, las zonas objetivo ni la condición de victoria. Cualquier nivel válido sigue siendo resoluble haga lo que haga la IA.
- Qué acciones admite cada tipo de nivel: `src/game/guestEffects.ts`.

## Tipos de nivel disponibles

| `type` | Mecánica | Ejemplo |
|---|---|---|
| `drag_to_target` | Arrastrar varios objetos a un contenedor | `tidy_toys_drag.json` |
| `place_items` | Cada objeto a su hueco | `set_table.json` |
| `flashlight_find` | Habitación a oscuras, mover la linterna y tocar lo iluminado | `bedtime.json` |
| `tidy_roles` | Recoger juguetes con roles por orden (cojín, cajón, poseído, escondite) | `tidy_toys.json` |
| `table_for_three` | Cocina (armarios → bandeja) + comedor (luz para colocar, oscuridad para ver de quién es cada sitio), pregunta de comida, intercambio, tercer servicio | `table_for_three.json` |
| `music_box` | Simón: la canción (qué símbolos brillan y en qué orden) **solo se ve con la luz apagada** y **solo se toca con la luz encendida**; rondas acumulativas que se guardan; al final, girar la llave | `music_box.json` |

### Qué se puede tocar en `music_box.json` (bloque `musicBox`)

Los **símbolos** son los `objects` del nivel (3–6; cualquier asset; de serie luna, estrella, campana y corazón, cada uno con forma y color distintos) y la caja es el `target`.

| Campo | Para qué |
|---|---|
| `rounds` | Símbolos por ronda (D41: `[3, 4, 5, 7]`). Cada ronda empieza con la canción de la anterior. Nunca más corta que la anterior; 1–6 rondas de 1–12 |
| `sequence` | `null` = canción nueva en cada partida (nunca tres iguales seguidos). Para una demo fija, una lista de ids de los símbolos al menos tan larga como la última ronda |
| `lightSwitch` / `key` | Posición del interruptor y de la llave (% de la escena). **Deja la franja inferior (73–89 % de alto) libre**: ahí va el subtítulo del Invitado |
| `keyTurns` | Toques a la llave para parar la música (1–6) |
| `showMs` / `gapMs` / `loopPauseMs` | A oscuras: cuánto brilla cada símbolo, la pausa entre símbolos y la pausa antes de repetir la canción |
| `hints` | Textos de ayuda arriba: con luz (`lit`), a oscuras (`dark`), al final (`key`) |
| `lines` | Frases del Invitado: al empezar, al superar una ronda, al fallar, cuando ya puedes girar la llave y al terminar (esta última también sale en el apagón siguiente) |

Fallar un símbolo solo borra lo tecleado en esa ronda (sin susto ni Cordura); apagar la luz para volver a ver la canción, también. El sonido es opcional: cada símbolo se distingue por forma, color y nombre (los lectores de pantalla oyen cada símbolo cuando brilla).

### Qué se puede tocar en `table_for_three.json` (bloque `table`)

| Campo | Para qué |
|---|---|
| `containers` | Armarios/cajones de la cocina: posición (`x`,`y`,`w`,`h` en %) y qué hay dentro (`contents`: ids de piezas y de señuelos). Cada pieza tiene que estar en un solo sitio |
| `decoys` | Vajilla gigante (señuelo): nunca se puede coger |
| `owners` / `sides` | De quién es cada pieza y en qué lado está cada hueco (3 y 3, una de cada tipo) |
| `childSide` | `"left"`, `"right"` o `"random"` (cambia cada partida) |
| `dark` | Milisegundos a oscuras hasta los ojos (`eyesMs`), el temblor (`shakeMs`) y el susto (`scareMs`) |
| `checkpointAt` | Cuántas piezas bien hacen el checkpoint (y lanzan la pregunta de comida) |
| `food.enabled` / `swap.enabled` | Activar o quitar la pregunta de comida y el intercambio |
| `hints` / `lines` | Todos los textos de pistas y del monstruo. `hints.howTo` (opcional, hasta 4 pasos) es la tarjeta "Setting the table" que sale la primera vez en el comedor |
| `motherColors` | Colores posibles del vestido de mamá: se sortea **uno al pulsar Play** y se usa igual en toda la partida |

Las posiciones de los huecos de la mesa son los `targets` del nivel (`x`,`y`,`w`,`h` en %). El editor todavía no tiene un panel específico para `table_for_three` ni `music_box`: sus bloques se editan en el JSON (en el editor se pueden mover los símbolos y la caja arrastrando) y se prueban con **Playtest** en `/editor` o jugando.

Para un tipo de minijuego **nuevo** sí hace falta código (componente en `src/components/minigames/` + registro en `MINIGAME_REGISTRY`): pedídmelo.
