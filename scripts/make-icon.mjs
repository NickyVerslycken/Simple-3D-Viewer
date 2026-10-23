// Renders build/icon.svg to build/icon.png (1024px); electron-builder derives .ico/.icns from it.
import sharp from 'sharp';

await sharp('build/icon.svg', { density: 300 }).resize(1024, 1024).png().toFile('build/icon.png');
console.log('wrote build/icon.png');
