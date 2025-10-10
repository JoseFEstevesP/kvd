import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as cliProgress from 'cli-progress';

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
	const ffmpegPath = ffmpeg.path;

	// --- Merging Step (using exec) ---
	await new Promise((resolve, reject) => {
		console.log(`Uniendo ${files.length} segmentos...`);
		const command = `"${ffmpegPath}" -y -f concat -safe 0 -i "${fileListPath}" -c copy "${mergedPath}"`;
		exec(command, (error, _stdout, _stderr) => {
			if (error) {
				reject(new Error(`Error al unir segmentos: ${_stderr || error.message}`));
				return;
			}
			console.log('Segmentos unidos correctamente.');
			console.log('Borrando segmentos individuales...');
			files.forEach(file => {
				try {
					fs.unlinkSync(path.join(tempDir, file));
				} catch (e) { /* ignore */ }
			});
			fs.unlinkSync(fileListPath);
			console.log('Segmentos individuales borrados.');
			resolve();
		});
	});

	// --- Get Duration Step ---
	const duration = await new Promise((resolve, reject) => {
		exec(`"${ffmpegPath}" -i "${mergedPath}"`, (error, _stdout, stderr) => {
			// FFmpeg sends info to stderr, so error can be non-null even on success
			const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
			if (durationMatch) {
				const hours = parseInt(durationMatch[1], 10);
				const minutes = parseInt(durationMatch[2], 10);
				const seconds = parseInt(durationMatch[3], 10);
				const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
				resolve(totalSeconds);
			} else {
				reject(new Error(`No se pudo obtener la duración del video. stderr: ${stderr}`));
			}
		});
	});

	// --- Conversion Step (with progress bar) ---
	console.log('Convirtiendo a MP4...');
	const progressBar = new cliProgress.SingleBar({
		format: 'Convirtiendo |{bar}| {percentage}% | {eta_formatted}',
		barCompleteChar: '\u2588',
		barIncompleteChar: '\u2591',
		 hideCursor: true,
	});
	progressBar.start(duration, 0);

	await new Promise((resolve, reject) => {
		const ffmpegProcess = spawn(ffmpegPath, [
			'-y', // Overwrite output file if it exists
			'-progress', 'pipe:1', // Pipe progress to stdout
			'-i', mergedPath,
			'-c', 'copy',
			'-bsf:a', 'aac_adtstoasc',
			outputFilename
		]);

		// FFmpeg progress is now on stdout
		ffmpegProcess.stdout.on('data', (data) => {
			const log = data.toString();
			const timeMatch = log.match(/out_time_ms=(\d+)/);
			if (timeMatch) {
				const currentTime = Math.round(parseInt(timeMatch[1], 10) / 1000000);
				progressBar.update(currentTime);
			}
		});

		let stderrOutput = '';
		ffmpegProcess.stderr.on('data', (data) => {
			stderrOutput += data.toString();
		});

		ffmpegProcess.on('close', (code) => {
			progressBar.stop();
			if (code === 0) {
				console.log(`\nVideo guardado como: ${outputFilename}`);
				resolve();
			} else {
				reject(new Error(`FFmpeg falló con código de salida ${code}.\n${stderrOutput}`));
			}
		});

		ffmpegProcess.on('error', (err) => {
			progressBar.stop();
			reject(new Error(`Error al iniciar FFmpeg: ${err.message}`));
		});
	});

	fs.unlinkSync(mergedPath);
	console.log('Procesamiento completado.');
}