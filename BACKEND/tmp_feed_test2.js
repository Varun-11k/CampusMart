require('dotenv').config();
const http = require('http');
const connectDatabase = require('./config/database');
const app = require('./app');

(async () => {
  await connectDatabase();
  const server = app.listen(0, async () => {
    const port = server.address().port;
    http.get('http://127.0.0.1:' + port + '/api/campus-feed', (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        console.log('STATUS', res.statusCode);
        console.log(d.slice(0, 3000));
        server.close(() => process.exit(0));
      });
    }).on('error', (e) => {
      console.error(e);
      server.close(() => process.exit(1));
    });
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
