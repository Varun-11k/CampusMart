require('dotenv').config();
const http = require('http');
const connectDatabase = require('./config/database');
const app = require('./app');

setTimeout(() => { console.error('FORCE EXIT'); process.exit(99); }, 10000);

(async () => {
  await connectDatabase();
  console.log('connected');
  const server = app.listen(0, () => {
    const port = server.address().port;
    console.log('listening', port);
    const req = http.get('http://127.0.0.1:' + port + '/api/campus-feed', (res) => {
      console.log('feed status', res.statusCode);
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        console.log('feed body', d.slice(0, 1000));
      });
    });
    req.on('error', (e) => { console.error('feed req error', e.message); });
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
