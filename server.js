const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

// Fonction pour formater les noms de fichiers
function formatFileName(title, extension) {
  const sanitizedTitle = title.replace(/[<>:"\/\\|?*]+/g, '').trim();
  return `hj_dev-${sanitizedTitle}.${extension}`;
}

// Fonction pour convertir la taille en bytes en format lisible (Mo, Go)
function formatSize(size) {
  if (size < 1024) return `${size} B`;
  const units = ['Ko', 'Mo', 'Go', 'To'];
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  return `${size.toFixed(2)} ${units[index]}`;
}

// Endpoint pour récupérer les formats disponibles
app.get('/formats', (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'URL manquante' });
  }

  exec(`yt-dlp -F "${videoUrl}" --restrict-filenames`, (err, stdout) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des formats' });
    }

    const formats = stdout
      .split('\n')
      .filter((line) => /^[0-9]+/.test(line))
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const size = parts[0]; // This would be dynamically fetched from yt-dlp command (size information)
        return {
          format_id: parts[0],
          resolution: parts[2] || 'Audio only',
          ext: parts[1],
          size: formatSize(parseInt(size)) // Placeholder for actual file size
        };
      });

    res.json({ formats });
  });
});

// Endpoint pour télécharger une vidéo dans un format spécifique (avec audio et vidéo combinés)
app.get('/download', (req, res) => {
  const { url, format } = req.query;

  if (!url || !format) {
    return res.status(400).send('URL ou format manquant');
  }

  exec(`yt-dlp --get-title "${url}"`, (err, stdout) => {
    if (err) {
      return res.status(500).send('Erreur lors de la récupération du titre de la vidéo');
    }

    const title = stdout.trim();
    const filePath = `downloads/${formatFileName(title, 'mp4')}`;

    // Commande pour télécharger la vidéo et l'audio combinés
    const command = `yt-dlp -f bestvideo+bestaudio "${url}" -o "${filePath}" --progress-template "progress: %(progress.downloaded_bytes)d/%(progress.total_bytes)d"`;

    const process = exec(command);

    process.stdout.on('data', (data) => {
      console.log(data);
    });

    process.on('close', (code) => {
      if (code === 0) {
        res.download(filePath, () => {
          fs.unlink(filePath, () => {});
        });
      } else {
        res.status(500).send('Erreur lors du téléchargement');
      }
    });
  });
});

app.listen(3000, '0.0.0.0', () => {
    console.log('Serveur lancé sur http://0.0.0.0:3000');
});
