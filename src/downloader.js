import { gotScraping } from 'got-scraping';
import * as cliProgress from 'cli-progress';
import fs from 'fs';
import { Parser } from 'm3u8-parser';
import PQueue from 'p-queue';
import path from 'path';
import inquirer from 'inquirer';

export async function downloadVod(playlistUrl, tempDir) {
	console.log('Descargando playlist maestra...');

	try {
		// Use gotScraping to fetch the master playlist
		const masterPlaylistResponse = await gotScraping.get({
			url: playlistUrl,
			headers: {
				Accept: 'application/x-mpegURL, text/plain, */*',
				'Accept-Language': 'en-US,en;q=0.9',
				Referer: 'https://kick.com/',
				Origin: 'https://kick.com',
			},
			timeout: { request: 300000 }, // Increased from 60000 to 300000ms (5 minutes)
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

		const qualityChoices = sortedPlaylists.map(playlist => {
			const resolution = playlist.attributes.RESOLUTION;
			const bandwidth = playlist.attributes.BANDWIDTH;
			const name = resolution ? `${resolution.width}x${resolution.height} (${(bandwidth / 1000000).toFixed(2)} Mbps)` : `Audio (${(bandwidth / 1000000).toFixed(2)} Mbps)`;
			return { name, value: playlist };
		});

		const { selectedPlaylist } = await inquirer.prompt([
			{
				type: 'list',
				name: 'selectedPlaylist',
				message: 'Selecciona la calidad de video:',
				choices: qualityChoices,
				default: 0,
			}
		]);

		const qualityPlaylistUrl = new URL(selectedPlaylist.uri, playlistUrl).href;
		console.log('[DEBUG] Selected quality playlist:', qualityPlaylistUrl);

		const resolution = selectedPlaylist.attributes.RESOLUTION;
		console.log(`Calidad seleccionada: ${resolution ? `${resolution.width}x${resolution.height}` : 'Audio'}`);
		console.log('Descargando lista de segmentos...');

		// Fetch the quality-specific playlist
		const qualityPlaylistResponse = await gotScraping.get({
			url: qualityPlaylistUrl,
			headers: {
				Accept: 'application/x-mpegURL, text/plain, */*',
				'Accept-Language': 'en-US,en;q=0.9',
				Referer: 'https://kick.com/',
				Origin: 'https://kick.com',
			},
			timeout: { request: 300000 }, // Increased from 60000 to 300000ms (5 minutes)
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

		const existingSegments = new Set();
		if (fs.existsSync(tempDir)) {
			const files = fs.readdirSync(tempDir);
			files.forEach(file => {
				if (file.startsWith('segment_') && file.endsWith('.ts')) {
					const match = file.match(/segment_(\d+)\.ts/);
					if (match) {
						existingSegments.add(parseInt(match[1], 10));
					}
				}
			});
		}

		const segmentsToDownload = segments
			.map((segment, index) => ({ ...segment, index }))
			.filter(segment => !existingSegments.has(segment.index));

		console.log(`Total de segmentos: ${segments.length}`);
		if (existingSegments.size > 0) {
			console.log(`Reanudando descarga. Segmentos ya descargados: ${existingSegments.size}`);
		}
		console.log(`Segmentos a descargar: ${segmentsToDownload.length}`);
		console.log('[DEBUG] Starting segment download queue and progress bar.');

		const progressBar = new cliProgress.SingleBar({
			format: 'Progreso |{bar}| {percentage}% | {value}/{total} segmentos',
			barCompleteChar: '\u2588',
			barIncompleteChar: '\u2591',
			hideCursor: true,
		});

		progressBar.start(segments.length, existingSegments.size);

		const queue = new PQueue({ concurrency: 10 });
		let completed = existingSegments.size;

		// For downloading individual segments, we need to use gotScraping as well
		const downloadPromises = segmentsToDownload.map((segment) => {
			return queue.add(async () => {
				const { index } = segment;
				const segmentUrl = new URL(segment.uri, qualityPlaylistUrl).href;
				const segmentPath = path.join(
					tempDir,
					`segment_${String(index).padStart(6, '0')}.ts`
				);

				const maxRetries = 5;
				for (let i = 0; i < maxRetries; i++) {
					try {
						// Download segment using gotScraping to bypass Cloudflare
						const segmentResponse = await gotScraping.get({
							url: segmentUrl,
							headers: {
								Accept: '*/*',
								'Accept-Language': 'en-US,en;q=0.9',
								Origin: 'https://kick.com',
								Referer: qualityPlaylistUrl,
								Connection: 'keep-alive',
								'Sec-Fetch-Dest': 'empty',
								'Sec-Fetch-Mode': 'cors',
								'Sec-Fetch-Site': 'same-origin',
								TE: 'trailers',
							},
							responseType: 'buffer', // Get response as buffer for binary data
							timeout: { request: 300000 }, // Increased from 60000 to 300000ms (5 minutes)
						});

						fs.writeFileSync(segmentPath, segmentResponse.body);
						break; // Success, exit retry loop
					} catch (error) {
						console.log(
							`\nError descargando segmento ${index} (intento ${
								i + 1
							}/${maxRetries}): ${error.message}\n`
						);
						if (i === maxRetries - 1) {
							throw error; // Rethrow error after last retry
						}
						// Wait before retrying
						await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
					}
				}

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
