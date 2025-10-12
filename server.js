const express = require('express');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express();
app.use(express.json());

app.post('/extract', async (req, res) => {
  const { video_url, ad_id } = req.body;
  
  if (!video_url || !ad_id) {
    return res.status(400).json({ error: 'Missing video_url or ad_id' });
  }
  
  const videoPath = `/tmp/${ad_id}.mp4`;
  
  try {
    await downloadFile(video_url, videoPath);
    const frames = await Promise.all([0, 3, 7].map(t => extractFrame(videoPath, ad_id, t)));
    fs.unlinkSync(videoPath);
    
    res.json({ ad_id, frames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function extractFrame(videoPath, ad_id, timestamp) {
  return new Promise((resolve, reject) => {
    const framePath = `/tmp/${ad_id}_${timestamp}s.jpg`;
    
    const ffmpeg = spawn('ffmpeg', [
      '-ss', timestamp.toString(),
      '-i', videoPath,
      '-frames:v', '1',
      '-q:v', '2',
      framePath
    ]);
    
    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg failed: ${code}`));
      
      const base64 = fs.readFileSync(framePath, { encoding: 'base64' });
      fs.unlinkSync(framePath);
      
      resolve({
        timestamp,
        image: `data:image/jpeg;base64,${base64}`
      });
    });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
