require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http = require('http');
const mongoose = require('mongoose');
const connectDatabase = require('./config/database');
const app = require('./app');

const timer = setTimeout(() => { console.error('TIMEOUT'); process.exit(99); }, 20000);

(async () => {
  try {
    await connectDatabase();
    console.log('DB_OK');
    const server = app.listen(0, () => {
      const port = server.address().port;
      const req = http.get('http://127.0.0.1:' + port + '/api/campus-feed', (res) => {
        console.log('STATUS', res.statusCode);
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { console.log('BODY', d.slice(0, 500)); clearTimeout(timer); process.exit(0); });
      });
      req.on('error', (e) => { console.error('REQ_ERR', e.message); clearTimeout(timer); process.exit(1); });
    });
  } catch (e) {
    console.error('DB_FAIL', e.message);
    clearTimeout(timer);
    process.exit(1);
  }
})();
