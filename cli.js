#!/usr/bin/env node

import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { getVideoInfo } from './api.js';
import { downloadVod } from './downloader.js';
import { processVideo } from './ffmpeg.js';

async function main() {
  console.log('=== Kick VOD Downloader ===');
  console.log('Versión ejecutable - Distribución standalone\n');

  let url = process.argv[2];

  if (!url) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Por favor, introduce la URL del VOD de Kick:',
        validate: (input) => {
          if (!input.trim()) {
            return 'La URL no puede estar vacía.';
          }
          if (!input.includes('kick.com')) {
            return 'La URL debe ser de Kick.com';
          }
          return true;
        }
      }
    ]);
    url = answers.url;
  }

  const videoId = url.split('/').pop();
  const tempDir = path.join(process.cwd(), `temp_segments_${videoId}`);

  try {
    console.log('Obteniendo información del video...\n');
    
    const videoInfo = await getVideoInfo(url);
    console.log(`Título: ${videoInfo.title}\n`);

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    await downloadVod(videoInfo.playlistUrl, tempDir);

    const sanitizedTitle = videoInfo.title
      .replace(/[<>:"/\\|?*]/g, '_')
      .substring(0, 200);
    const outputFilename = `${sanitizedTitle}.mp4`;

    console.log('\nProcesando video con FFmpeg...');
    await processVideo(tempDir, outputFilename);

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log('\n✅ ¡Descarga completada exitosamente!');
    console.log(`Archivo guardado: ${outputFilename}`);
    
    const stats = fs.statSync(outputFilename);
    const fileSizeInBytes = stats.size;
    const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);
    const fileSizeInGigabytes = fileSizeInBytes / (1024 * 1024 * 1024);

    if (fileSizeInGigabytes > 1) {
        console.log(`Tamaño: ${fileSizeInGigabytes.toFixed(2)} GB`);
    } else {
        console.log(`Tamaño: ${fileSizeInMegabytes.toFixed(2)} MB`);
    }

    console.log(`Ruta: ${path.resolve(outputFilename)}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error('La descarga ha fallado. Los archivos temporales no se han borrado para poder reanudarla más tarde.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});