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
node index.js "https://kick.com/usuario/videos/id-del-video"
```

### Opción 2: Modo interactivo
```bash
node index.js
```
El programa te pedirá que ingreses la URL del VOD.

## Características

- Descarga automática de VODs de Kick.com
- Selección automática de la calidad más alta disponible
- Barra de progreso durante la descarga
- Descargas concurrentes para mayor velocidad
- Bypass de protección Cloudflare
- Conversión automática a formato MP4
- Limpieza automática de archivos temporales

## Estructura del Proyecto

```
kick-vod-downloader/
├── cli.js          # Lógica de la línea de comandos
├── api.js          # Obtención de información del video
├── downloader.js   # Descarga de fragmentos M3U8
├── ffmpeg.js       # Procesamiento de video
├── entry.js        # Punto de entrada
├── index.js        # Punto de entrada principal
├── index.cjs       # Módulo CommonJS
└── package.json    # Configuración del proyecto
```

## Cómo Funciona

1. **Extracción de información:** Utiliza `got-scraping` para obtener la información del video desde la API de Kick, evitando la protección de Cloudflare.
2. **Análisis de playlist:** Parsea el archivo M3U8 maestro y selecciona la mejor calidad.
3. **Descarga concurrente:** Descarga los segmentos de video en paralelo (10 conexiones simultáneas).
4. **Procesamiento:** Une los segmentos y convierte el resultado a MP4 usando FFmpeg (a través de `@ffmpeg-installer/ffmpeg`).

## Notas Importantes

- La herramienta crea una carpeta temporal `temp_segments` durante el proceso de descarga.
- Los archivos temporales se eliminan automáticamente al finalizar.
- Los nombres de archivo se sanitizan para evitar caracteres no válidos.
- El video final se guarda en el directorio actual con el nombre del título del video.

## Solución de Problemas

### Error al obtener información del video
Verifica que la URL sea válida y que el video esté disponible públicamente en Kick.com.

### Problemas de conexión
Si experimentas errores de red, verifica tu conexión a internet. La herramienta incluye timeouts y reintentos automáticos.