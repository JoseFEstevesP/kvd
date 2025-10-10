
import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';
import { getVideoInfo } from './api.js';
import { downloadVod } from './downloader.js';
import { processVideo } from './ffmpeg.js';
import { loadHistory, addPathToHistory, chooseHistoryPath } from './history.js';

const errorUrlFile = path.join(process.cwd(), 'error_url.txt');

async function main() {
  console.log('=== Kick VOD Downloader ===');
  console.log('Versión ejecutable - Distribución standalone\n');

  let url = process.argv[2];

  if (fs.existsSync(errorUrlFile)) {
    const resumeUrl = fs.readFileSync(errorUrlFile, 'utf-8');
    const { resume } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'resume',
        message: `Se encontró una URL de una descarga fallida: ${resumeUrl}. ¿Desea reanudar la descarga?`,
        default: true,
      },
    ]);

    if (resume) {
      url = resumeUrl;
    } else {
      fs.unlinkSync(errorUrlFile);
    }
  }

  if (!url) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Por favor, introduce la URL del VOD de Kick:',
        validate: input => {
          if (!input.trim()) {
            return 'La URL no puede estar vacía.';
          }
          if (!input.includes('kick.com')) {
            return 'La URL debe ser de Kick.com';
          }
          return true;
        },
      },
    ]);
    url = answers.url;
  }

  const history = loadHistory();
  let outputDir = await chooseHistoryPath(history);

  if (outputDir === 'new') {
    const { newPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newPath',
        message: 'Introduce la ruta de descarga:',
        default: process.cwd(),
        validate: input => {
          if (fs.existsSync(input) && fs.lstatSync(input).isDirectory()) {
            return true;
          }
          return 'El directorio no existe. Por favor, introduce una ruta válida.';
        }
      },
    ]);
    outputDir = newPath;
    addPathToHistory(outputDir, history);
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
    const outputFilename = path.join(outputDir, `${sanitizedTitle}.mp4`);

    console.log('\nProcesando video con FFmpeg...');
    await processVideo(tempDir, outputFilename);

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    if (fs.existsSync(errorUrlFile)) {
      fs.unlinkSync(errorUrlFile);
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
    fs.writeFileSync(errorUrlFile, url);
    console.error(
      'La descarga ha fallado. La URL ha sido guardada. Los archivos temporales no se han borrado para poder reanudarla más tarde.'
    );
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
