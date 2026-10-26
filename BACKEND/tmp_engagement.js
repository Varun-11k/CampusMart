require('dotenv').config();
const http = require('http');
const connectDatabase = require('./config/database');
const app = require('./app');
const jwt = require('jsonwebtoken');

setTimeout(() => { console.error('FORCE EXIT'); process.exit(99); }, 10000);

(async () => {
  await connectDatabase();
  const server = app.listen(0, () => {
    const port = server.address().port;
    const token = jwt.sign({ userId: new (require('mongoose')).Types.ObjectId().toString(), tokenVersion: 0 }, process.env.JWT_SECRET);
    const req = http.get('http://127.0.0.1:' + port + '/api/engagement/feed', { headers: { Authorization: 'Bearer ' + token } }, (res) => {
      console.log('status', res.statusCode);
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { console.log(d.slice(0,500)); process.exit(0); });
    });
    req.on('error', e => { console.error(e.message); process.exit(1); });
  });
})().catch(e => { console.error(e); process.exit(1); });
