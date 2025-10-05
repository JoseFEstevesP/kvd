import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function processVideo(tempDir, outputFilename) {
	console.log('Procesando video con FFmpeg...');

	const files = fs
		.readdirSync(tempDir)
		.filter(file => file.endsWith('.ts'))
		.sort();

	if (files.length === 0) {
		throw new Error('No se encontraron segmentos para procesar.');
	}

	const fileListPath = path.join(tempDir, 'filelist.txt');
	const fileListContent = files
		.map(file => `file '${path.join(tempDir, file)}'`)
		.join('\n');

	fs.writeFileSync(fileListPath, fileListContent);

	const mergedPath = path.join(tempDir, 'merged.ts');
	let ffmpegPath = ffmpeg.path;

	await new Promise((resolve, reject) => {
		console.log('Uniendo segmentos...');
		const command = `"${ffmpegPath}" -f concat -safe 0 -i "${fileListPath}" -c copy "${mergedPath}"`;
		exec(command, (error, _stdout, _stderr) => {
			if (error) {
				reject(new Error(`Error al unir segmentos: ${error.message}`));
				return;
			}
			console.log('Segmentos unidos correctamente.');
			resolve();
		});
	});

	await new Promise((resolve, reject) => {
		console.log('Convirtiendo a MP4...');
		const command = `"${ffmpegPath}" -i "${mergedPath}" -c copy -bsf:a aac_adtstoasc "${outputFilename}"`;
		exec(command, (error, _stdout, _stderr) => {
			if (error) {
				reject(new Error(`Error al convertir a MP4: ${error.message}`));
				return;
			}
			console.log(`Video guardado como: ${outputFilename}`);
			resolve();
		});
	});

	fs.unlinkSync(fileListPath);
	fs.unlinkSync(mergedPath);

	console.log('Procesamiento completado.');
}
