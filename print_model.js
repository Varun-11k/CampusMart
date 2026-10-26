const fs = require('fs');
const lines = fs.readFileSync('C:/Users/user/Desktop/MARKET/BACKEND/models/CampusFeedPost.js', 'utf8').split(/\r?\n/);
console.log(lines.join('\n'));
