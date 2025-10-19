const express = require('express');
const router = express.Router();
const crawler = require('../services/crawler');

// API endpoint để trả về dữ liệu JSON
router.get('/data', function (req, res) {
  res.json(crawler.getData());
});

// API endpoint để force crawl lại
router.get('/force-crawl', function (req, res) {
  crawler.forceCrawl().then(result => {
    res.json(result);
  });
});

// API endpoint để kiểm tra trạng thái
router.get('/status', function (req, res) {
  res.json(crawler.getStatus());
});

module.exports = router;
