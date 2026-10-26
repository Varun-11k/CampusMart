require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const connectDatabase = require('./config/database');
const app = require('./app');
const User = require('./models/User');
const CampusFeedPost = require('./models/CampusFeedPost');

const timer = setTimeout(() => { console.error('TIMEOUT'); process.exit(99); }, 20000);

(async () => {
  await connectDatabase();
  const user = await User.findOne({}).select('_id tokenVersion name').lean();
  const token = jwt.sign({ userId: user._id.toString(), tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET);
  const server = app.listen(0, () => {
    const port = server.address().port;
    const base = 'http://127.0.0.1:' + port;
    const body = JSON.stringify({ content: 'smoke test post', category: 'general', visibility: 'campus' });
    const req = http.request(base + '/api/campus-feed', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'Content-Length': Buffer.byteLength(body) } }, async (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', async () => {
        console.log('CREATE_STATUS', res.statusCode);
        const count = await CampusFeedPost.countDocuments({});
        const active = await CampusFeedPost.countDocuments({ status: 'active' });
        console.log('DB_COUNT', count, 'ACTIVE', active);
        // list with token
        http.get(base + '/api/campus-feed', { headers: { Authorization: 'Bearer ' + token } }, (res2) => {
          let d2 = ''; res2.on('data', c => d2 += c); res2.on('end', () => {
            console.log('LIST_STATUS', res2.statusCode);
            console.log('LIST_BODY', d2.slice(0,200));
            // mine
            http.get(base + '/api/campus-feed/mine', { headers: { Authorization: 'Bearer ' + token } }, (res3) => {
              let d3 = ''; res3.on('data', c => d3 += c); res3.on('end', () => {
                console.log('MINE_STATUS', res3.statusCode);
                console.log('MINE_BODY', d3.slice(0,200));
                clearTimeout(timer); process.exit(0);
              });
            }).on('error', (e) => { console.error(e.message); process.exit(1); });
          });
        }).on('error', (e) => { console.error(e.message); process.exit(1); });
      });
    });
    req.on('error', (e) => { console.error('CREATE_ERR', e.message); process.exit(1); });
    req.write(body); req.end();
  });
})().catch(e => { console.error(e); process.exit(1); });
