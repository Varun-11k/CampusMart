const fs = require('fs');
const lines = fs.readFileSync('C:/Users/user/Desktop/MARKET/FRONTEND/OldIsGold/src/pages/CampusFeed.jsx', 'utf8').split(/\r?\n/);
console.log(lines.slice(59, 140).join('\n'));
