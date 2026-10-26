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
    http.get('http://127.0.0.1:' + port + '/api/health', (res) => {
      console.log('health status', res.statusCode);
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        console.log('health body', d.slice(0, 500));
        server.close(() => process.exit(0));
      });
    }).on('error', (e) => {
      console.error('health req error', e);
      server.close(() => process.exit(1));
    });
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
