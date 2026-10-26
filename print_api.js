const fs = require('fs');
const lines = fs.readFileSync('C:/Users/user/Desktop/MARKET/FRONTEND/OldIsGold/src/services/api.js', 'utf8').split(/\r?\n/);
console.log(lines.slice(426, 435).join('\n'));
