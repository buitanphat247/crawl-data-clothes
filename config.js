// Cấu hình chung
module.exports = {
  // Test mode
  TEST_MODE: false,
  MAX_PRODUCTS: 1,
  MAX_NEXT_PAGES: 3,
  
  // Cache settings
  CACHE_EXPIRY: 30 * 60 * 1000, // 30 phút
  
  // Request settings
  REQUEST_DELAY: 1000, // 1 giây delay giữa các request
  
  // URLs
  BASE_URL: 'https://giovannioutlet.com',
  SALE_URL: 'https://giovannioutlet.com/collections/sale',
  
  // Headers
  DEFAULT_HEADERS: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  
  // Server settings
  PORT: 3000
};
