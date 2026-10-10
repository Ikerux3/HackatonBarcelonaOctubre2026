# Cocina — The Mended House

Pack raster 2D, no escena 3D editable. Cinco contenedores alineados al JSON del HEAD a93df9f. Abrir index.html para inspeccionar los estados. No modifica el juego.

Fondos WebP, 9 componentes separados PNG/WebP alpha, sombra independiente, manifest y QA a 375 px. Los estados usan las mismas piezas: no se regenera la habitación. Los frentes son también oclusores; el interior permanece detrás. Las puertas abiertas son una compresión 2D del frente; falta reverso físico si se exige animación de giro realista.

La vajilla neutra se reutiliza para pequeño, mediano y gigante con los tamaños de runtime. Mantener los símbolos estrella/vestido y motherColor existentes como capas de UI. Ninguna propiedad ni victoria está codificada en el arte. La bandeja demostrativa no añade un hotspot.

Pruebas: alpha real, coordenadas del JSON, rutas, vistas 375 px. La integración en React y la validación táctil en dispositivo siguen pendientes.
