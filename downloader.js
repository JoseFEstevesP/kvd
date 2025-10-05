import { gotScraping } from 'got-scraping';
import cliProgress from 'cli-progress';
import fs from 'fs';
import { Parser } from 'm3u8-parser';
import PQueue from 'p-queue';
import path from 'path';

export async function downloadVod(playlistUrl, tempDir) {
    console.log('Descargando playlist maestra...');

    try {
        // Use gotScraping to fetch the master playlist
        const masterPlaylistResponse = await gotScraping.get({
            url: playlistUrl,
            headers: {
                'Accept': 'application/x-mpegURL, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://kick.com/',
                'Origin': 'https://kick.com',
            },
            timeout: { request: 30000 }
        });

        const masterPlaylistContent = masterPlaylistResponse.body;
        console.log('[DEBUG] Master playlist fetched.');
        console.log('[DEBUG] Master playlist parsed.');

        const parser = new Parser();
        parser.push(masterPlaylistContent);
        parser.end();

        const manifest = parser.manifest;

        if (!manifest.playlists || manifest.playlists.length === 0) {
            throw new Error('No se encontraron playlists en el archivo maestro.');
        }

        const sortedPlaylists = manifest.playlists.sort((a, b) => {
            const bandwidthA = a.attributes?.BANDWIDTH || 0;
            const bandwidthB = b.attributes?.BANDWIDTH || 0;
            return bandwidthB - bandwidthA;
        });

        const bestPlaylist = sortedPlaylists[0];
        const qualityPlaylistUrl = new URL(bestPlaylist.uri, playlistUrl).href;
        console.log('[DEBUG] Best quality playlist selected:', qualityPlaylistUrl);

        const resolution = bestPlaylist.attributes?.RESOLUTION?.width
            ? `${bestPlaylist.attributes.RESOLUTION.width}x${bestPlaylist.attributes.RESOLUTION.height}`
            : 'Desconocida';

        console.log(`Calidad seleccionada: ${resolution}`);
        console.log('Descargando lista de segmentos...');

        // Fetch the quality-specific playlist
        const qualityPlaylistResponse = await gotScraping.get({
            url: qualityPlaylistUrl,
            headers: {
                'Accept': 'application/x-mpegURL, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://kick.com/',
                'Origin': 'https://kick.com',
            },
            timeout: { request: 30000 }
        });

        const qualityPlaylistContent = qualityPlaylistResponse.body;
        console.log('[DEBUG] Quality-specific playlist fetched.');

        const segmentParser = new Parser();
        segmentParser.push(qualityPlaylistContent);
        segmentParser.end();
        console.log('[DEBUG] Quality-specific playlist parsed.');

        const segments = segmentParser.manifest.segments;

        if (!segments || segments.length === 0) {
            throw new Error('No se encontraron segmentos de video.');
        }

        console.log(`Total de segmentos a descargar: ${segments.length}`);
        console.log('[DEBUG] Starting segment download queue and progress bar.');

        const progressBar = new cliProgress.SingleBar({
            format: 'Progreso |{bar}| {percentage}% | {value}/{total} segmentos',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
        });

        progressBar.start(segments.length, 0);

        const queue = new PQueue({ concurrency: 10 });
        let completed = 0;

        // For downloading individual segments, we need to use gotScraping as well
        const downloadPromises = segments.map((segment, index) => {
            return queue.add(async () => {
                const segmentUrl = new URL(segment.uri, qualityPlaylistUrl).href;
                const segmentPath = path.join(tempDir, `segment_${String(index).padStart(6, '0')}.ts`);

                // Download segment using gotScraping to bypass Cloudflare
                const segmentResponse = await gotScraping.get({
                    url: segmentUrl,
                    headers: {
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Origin': 'https://kick.com',
                        'Referer': qualityPlaylistUrl,
                        'Connection': 'keep-alive',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'TE': 'trailers'
                    },
                    responseType: 'buffer', // Get response as buffer for binary data
                    timeout: { request: 30000 }
                });

                fs.writeFileSync(segmentPath, segmentResponse.body);

                completed++;
                progressBar.update(completed);
            });
        });

        await Promise.all(downloadPromises);

        progressBar.stop();
        console.log('¡Descarga de segmentos completada!');
    } catch (error) {
        console.error('[DEBUG] Download error:', error.message);
        throw error;
    }
}