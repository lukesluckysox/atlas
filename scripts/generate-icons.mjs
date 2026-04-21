// Run: node scripts/generate-icons.mjs
// Generates placeholder SVG icons. Replace with real icons before launch.
import { writeFileSync } from 'fs';

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#F5F0E8"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size*0.35}" fill="none" stroke="#D4A843" stroke-width="${size*0.04}"/>
  <line x1="${size/2}" y1="${size*0.15}" x2="${size/2}" y2="${size*0.85}" stroke="#D4A843" stroke-width="${size*0.025}"/>
  <line x1="${size*0.15}" y1="${size/2}" x2="${size*0.85}" y2="${size/2}" stroke="#D4A843" stroke-width="${size*0.025}"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size*0.05}" fill="#2C1810"/>
</svg>`;

writeFileSync('public/icon-192.png', svg(192));
writeFileSync('public/icon-512.png', svg(512));
console.log('Icons written (SVG format, rename as needed)');
