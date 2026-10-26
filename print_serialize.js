const fs = require('fs');
const lines = fs.readFileSync('C:/Users/user/Desktop/MARKET/BACKEND/controllers/campusFeedController.js', 'utf8').split(/\r?\n/);
console.log(lines.slice(73, 110).join('\n'));
