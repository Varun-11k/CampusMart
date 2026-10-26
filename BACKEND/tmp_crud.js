require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const connectDatabase = require('./config/database');
const app = require('./app');
const User = require('./models/User');

const timer = setTimeout(() => { console.error('TIMEOUT'); process.exit(99); }, 25000);

(async () => {
  await connectDatabase();
  const user = await User.findOne({}).select('_id tokenVersion name').lean();
  if (!user) { console.error('NO_USER'); process.exit(1); }
  console.log('USER', user._id.toString(), user.name);
  const token = jwt.sign({ userId: user._id.toString(), tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET);
  const server = app.listen(0, () => {
    const port = server.address().port;
    const base = 'http://127.0.0.1:' + port;
    // create post
    const body = JSON.stringify({ content: 'smoke test post', category: 'general', visibility: 'campus' });
    const createReq = http.request(base + '/api/campus-feed', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        console.log('CREATE', res.statusCode, d.slice(0, 300));
        // list
        http.get(base + '/api/campus-feed', (res2) => {
          let d2 = ''; res2.on('data', c => d2 += c); res2.on('end', () => {
            console.log('LIST', res2.statusCode, d2.slice(0, 300));
            clearTimeout(timer); process.exit(0);
          });
        });
      });
    });
    createReq.write(body); createReq.end();
  });
})().catch(e => { console.error(e); process.exit(1); });
