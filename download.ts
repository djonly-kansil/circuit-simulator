import fs from 'fs';
import https from 'https';
import path from 'path';

const download = (url: string, dest: string) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function main() {
  try {
    fs.mkdirSync('public/wasm', { recursive: true });
    console.log('Downloading ngspice.wasm...');
    await download('https://raw.githubusercontent.com/shishir-dey/ngspiceX/main/public/wasm/ngspice.wasm', 'public/wasm/ngspice.wasm');
    console.log('Downloading ngspice.js...');
    await download('https://raw.githubusercontent.com/shishir-dey/ngspiceX/main/public/wasm/ngspice.js', 'public/wasm/ngspice.js');
    console.log('Downloads completed successfully.');
  } catch (e) {
    console.error('Download failed:', e);
    process.exit(1);
  }
}

main();
