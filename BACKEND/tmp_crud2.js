require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const connectDatabase = require('./config/database');
const app = require('./app');
const User = require('./models/User');

const timer = setTimeout(() => { console.error('TIMEOUT'); process.exit(99); }, 20000);

(async () => {
  await connectDatabase();
  const user = await User.findOne({}).select('_id tokenVersion name').lean();
  const token = jwt.sign({ userId: user._id.toString(), tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET);
  const server = app.listen(0, () => {
    const port = server.address().port;
    const base = 'http://127.0.0.1:' + port;
    const body = JSON.stringify({ content: 'smoke test post', category: 'general', visibility: 'campus' });
    const req = http.request(base + '/api/campus-feed', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        console.log('CREATE_STATUS', res.statusCode);
        console.log('CREATE_BODY', d);
        // list
        http.get(base + '/api/campus-feed', (res2) => {
          let d2 = ''; res2.on('data', c => d2 += c); res2.on('end', () => {
            console.log('LIST_STATUS', res2.statusCode);
            console.log('LIST_BODY', d2.slice(0,500));
            clearTimeout(timer); process.exit(0);
          });
        }).on('error', (e) => { console.error('LIST_ERR', e.message); process.exit(1); });
      });
    });
    req.on('error', (e) => { console.error('CREATE_ERR', e.message); process.exit(1); });
    req.write(body); req.end();
  });
})().catch(e => { console.error(e); process.exit(1); });
