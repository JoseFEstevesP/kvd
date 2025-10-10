# Kick VOD Downloader

Herramienta de línea de comandos para descargar Videos Bajo Demanda (VODs) desde Kick.com.

## Requisitos Previos

### Node.js

Requiere Node.js v16 o superior.

## Instalación

```bash
npm install
```

## Uso

### Opción 1: Proporcionar URL directamente

```bash
node src/cli.js "https://kick.com/usuario/videos/id-del-video"
```
o
```bash
npm start -- "https://kick.com/usuario/videos/id-del-video"
```

### Opción 2: Modo interactivo

```bash
node src/cli.js
```
o
```bash
npm start
```

El programa te pedirá que ingreses la URL del VOD.

## Características

- Descarga automática de VODs de Kick.com
- Selección de calidad de video.
- Barra de progreso durante la descarga.
- Descargas concurrentes para mayor velocidad.
- Bypass de protección Cloudflare.
- Conversión automática a formato MP4.
- Limpieza automática de archivos temporales.
- **Historial de rutas de descarga:** Guarda las últimas 10 rutas de descarga para una selección rápida.
- **Reanudación de descargas fallidas:** Si una descarga falla, la URL se guarda para que puedas reanudarla fácilmente en el próximo inicio.

## Estructura del Proyecto

```
kick-vod-downloader/
├── src/
│   ├── cli.js          # Lógica de la línea de comandos
│   ├── api.js          # Obtención de información del video
│   ├── downloader.js   # Descarga de fragmentos M3U8
│   ├── ffmpeg.js       # Procesamiento de video
│   ├── history.js      # Lógica del historial de descargas
│   └── index.js        # Punto de entrada principal
├── package.json    # Configuración del proyecto
├── history.json    # Historial de rutas de descarga
└── error_url.txt   # URL de la última descarga fallida
```

## Cómo Funciona

1.  **Reanudación de errores:** Al iniciar, el programa comprueba si existe una URL de una descarga fallida y te pregunta si deseas reanudarla.
2.  **Selección de ruta:** El programa te permite elegir una ruta de descarga de tu historial o introducir una nueva.
3.  **Extracción de información:** Utiliza `got-scraping` para obtener la información del video desde la API de Kick, evitando la protección de Cloudflare.
4.  **Análisis de playlist:** Parsea el archivo M3U8 maestro y te permite seleccionar la calidad de video.
5.  **Descarga concurrente:** Descarga los segmentos de video en paralelo (10 conexiones simultáneas).
6.  **Procesamiento:** Une los segmentos y convierte el resultado a MP4 usando FFmpeg (a través de `@ffmpeg-installer/ffmpeg`).
7.  **Guardado de historial:** La ruta de descarga se guarda en el historial para futuros usos.

## Notas Importantes

-   La herramienta crea una carpeta temporal `temp_segments_{videoId}` durante el proceso de descarga.
-   Los archivos temporales se eliminan automáticamente al finalizar una descarga exitosa.
-   En caso de error, los archivos temporales no se eliminan para permitir la reanudación.
-   Los nombres de archivo se sanitizan para evitar caracteres no válidos.
-   El video final se guarda en el directorio que seleccionaste.
-   El historial de descargas se guarda en `history.json`.
-   La URL de una descarga fallida se guarda en `error_url.txt`.

## Solución de Problemas

### Error al obtener información del video

Verifica que la URL sea válida y que el video esté disponible públicamente en Kick.com.

### Problemas de conexión

Si experimentas errores de red, verifica tu conexión a internet. La herramienta incluye timeouts y reintentos automáticos para la descarga de segmentos.