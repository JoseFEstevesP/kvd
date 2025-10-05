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

  const tempDir = path.join(process.cwd(), 'temp_segments');

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
    console.log(`Ruta: ${path.resolve(outputFilename)}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    
    if (fs.existsSync(tempDir)) {
      console.log('Limpiando archivos temporales...');
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});