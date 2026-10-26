const fs = require('fs');
const lines = fs.readFileSync('C:/Users/user/Desktop/MARKET/BACKEND/controllers/campusFeedController.js', 'utf8').split(/\r?\n/);
console.log(lines.slice(255, 420).join('\n'));
