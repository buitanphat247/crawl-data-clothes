const express = require('express');
const path = require('path');
const config = require('./config');
const crawler = require('./services/crawler');
const apiRoutes = require('./routes/api');

const app = express();

// Serve static HTML file
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API routes
app.use('/api', apiRoutes);

// Start server
app.listen(config.PORT, function () {
  console.log(`🚀 Server đang chạy tại: http://localhost:${config.PORT}`);
  console.log(`📊 Dashboard: http://localhost:${config.PORT}`);
  console.log(`🔗 API: http://localhost:${config.PORT}/api/data`);
  console.log('⏳ Đang bắt đầu crawl dữ liệu...\n');
  
  // Chạy crawl ngay khi server start
  crawler.crawlJobs();
});