require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http = require('http');
const connectDatabase = require('./config/database');
const app = require('./app');

const timer = setTimeout(() => { console.error('TIMEOUT'); process.exit(99); }, 20000);

(async () => {
  await connectDatabase();
  const server = app.listen(0, () => {
    const port = server.address().port;
    const req = http.get('http://127.0.0.1:' + port + '/api/campus-feed/reels', (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        console.log('REELS_STATUS', res.statusCode);
        console.log('REELS_BODY', d.slice(0,300));
        clearTimeout(timer); process.exit(0);
      });
    });
    req.on('error', (e) => { console.error('REQ_ERR', e.message); process.exit(1); });
  });
})().catch(e => { console.error('DB_FAIL', e.message); process.exit(1); });
