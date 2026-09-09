const fs = require('node:fs');
const path = require('node:path');

const sourceDirectory = path.resolve(__dirname, '..', 'reward_images');
const publicDirectory = path.resolve(__dirname, '..', 'public', 'reward_images');

if (fs.existsSync(sourceDirectory)) {
  fs.rmSync(publicDirectory, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(publicDirectory), { recursive: true });
  fs.cpSync(sourceDirectory, publicDirectory, { recursive: true });
}
