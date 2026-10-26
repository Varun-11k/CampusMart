require('dotenv').config();
const http = require('http');
const connectDatabase = require('./config/database');
const app = require('./app');

(async () => {
  await connectDatabase();
  console.log('connected');
  const server = app.listen(0, () => {
    const port = server.address().port;
    console.log('listening', port);
    const req = http.get('http://127.0.0.1:' + port + '/api/campus-feed', (res) => {
      console.log('response status', res.statusCode);
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        console.log('body', d.slice(0, 1000));
        server.close(() => process.exit(0));
      });
    });
    req.on('error', (e) => {
      console.error('req error', e);
      server.close(() => process.exit(1));
    });
    req.setTimeout(5000, () => {
      console.error('request timeout');
      req.destroy();
      server.close(() => process.exit(2));
    });
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
