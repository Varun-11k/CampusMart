const https = require('https');
https.get('https://campusmart-ss8x.onrender.com/api/campus-feed', (res) => {
  console.log('STATUS', res.statusCode);
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => { console.log(d.slice(0,1000)); process.exit(0); });
}).on('error', e => { console.error(e); process.exit(1); });
