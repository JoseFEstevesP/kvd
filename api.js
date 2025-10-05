import { gotScraping } from 'got-scraping';

export async function getVideoInfo(url) {
  const videoIdMatch = url.match(/\/videos\/([a-f0-9-]+)/i);

  if (!videoIdMatch) {
    throw new Error('URL inválida. No se pudo extraer el ID del video.');
  }

  const videoId = videoIdMatch[1];
  const apiUrl = `https://kick.com/api/v1/video/${videoId}`;

  console.log('Obteniendo información del video...');

  try {
    // Use gotScraping which is designed to bypass Cloudflare
    const response = await gotScraping.get({
      url: apiUrl,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://kick.com/',
        'Origin': 'https://kick.com',
      },
      responseType: 'json', // Automatically parse JSON response
      timeout: { request: 30000 }
    });

    const videoData = response.body;

    if (!videoData.source) {
      throw new Error('El video no tiene una fuente de reproducción disponible.');
    }

    return {
      playlistUrl: videoData.source,
      title: videoData.livestream?.session_title || `video_${videoId}`,
      videoId: videoId
    };

  } catch (error) {
    throw new Error(`Error al obtener información del video: ${error.message}`);
  }
}