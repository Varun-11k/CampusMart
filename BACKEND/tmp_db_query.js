require('dotenv').config();
const connectDatabase = require('./config/database');
const mongoose = require('mongoose');
const CampusFeedPost = require('./models/CampusFeedPost');

(async () => {
  await connectDatabase();
  console.log('connected');
  const count = await CampusFeedPost.countDocuments({ status: 'active' });
  console.log('count', count);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
