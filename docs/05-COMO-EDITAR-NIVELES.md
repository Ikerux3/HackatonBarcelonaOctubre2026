# 05 — CÓMO AÑADIR Y EDITAR NIVELES (sin tocar código)

Cada nivel es **un archivo `.json`** en `src/game/levels/data/`. El orden de la partida está en **`src/game/levels/data/story.json`**. El juego los carga solo: no hay que tocar ningún archivo de código.

```
src/game/levels/data/
├── story.json          ← qué nivel se juega en cada tarea
├── tidy_toys.json      ← Tarea 1: recoger juguetes (roles, poseído, escondite)
├── set_table.json      ← Tarea 2: poner la mesa
├── bedtime.json        ← Tarea 3: linterna
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
    "task_three": "bedtime"
  },
  "editorOrder": ["tidy_toys", "set_table", "bedtime", "tidy_toys_drag"]
}
```

> No borres ni renombres los 4 archivos de serie: el editor los usa como plantillas. Para variaciones, **copia** el archivo con otro `id`.

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

Para un tipo de minijuego **nuevo** sí hace falta código (componente en `src/components/minigames/` + registro en `MINIGAME_REGISTRY`): pedídmelo.
