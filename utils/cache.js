const fs = require('fs');
const path = require('path');
const config = require('../config');

// Cache file path
const CACHE_FILE = path.join(__dirname, '..', 'cache.json');

// Hàm load cache
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const now = Date.now();
      
      // Kiểm tra cache có hết hạn không
      if (now - cacheData.timestamp < config.CACHE_EXPIRY) {
        console.log('📦 Đang load dữ liệu từ cache...');
        return cacheData.data;
      } else {
        console.log('⏰ Cache đã hết hạn, sẽ crawl lại...');
        fs.unlinkSync(CACHE_FILE); // Xóa cache cũ
      }
    }
    return null;
  } catch (error) {
    console.log('❌ Lỗi khi load cache:', error.message);
    return null;
  }
}

// Hàm save cache
function saveCache(data) {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: data
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
    console.log('💾 Đã lưu cache thành công!');
    return true;
  } catch (error) {
    console.log('❌ Lỗi khi lưu cache:', error.message);
    return false;
  }
}

// Hàm xóa cache
function clearCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log('🗑️ Đã xóa cache');
      return true;
    }
    return false;
  } catch (error) {
    console.log('❌ Lỗi khi xóa cache:', error.message);
    return false;
  }
}

// Hàm kiểm tra cache có tồn tại không
function hasCache() {
  return fs.existsSync(CACHE_FILE);
}

module.exports = {
  loadCache,
  saveCache,
  clearCache,
  hasCache
};
