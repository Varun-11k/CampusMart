const fs=require('fs');
const lines=fs.readFileSync('c:/Users/user/Desktop/MARKET/BACKEND/controllers/authController.js','utf8').split('\n');
fs.writeFileSync('c:/Users/user/Desktop/MARKET/authchunk3.txt', lines.slice(150,330).join('\n'));
console.log('done', lines.length);