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
  SALE_URL: 'https://giovannioutlet.com/collections/quan-ao-nam',
  
  // Danh sách tất cả URLs cần crawl
  CRAWL_URLS: [
    'https://giovannioutlet.com/collections/quan-ao-nam',
    'https://giovannioutlet.com/collections/giay-nam',
    'https://giovannioutlet.com/collections/cap-tui-nam',
    'https://giovannioutlet.com/collections/vi-bop-nam',
    'https://giovannioutlet.com/collections/vali',
    'https://giovannioutlet.com/collections/san-pham-nu',
    'https://giovannioutlet.com/collections/tui-xach-nu',
    'https://giovannioutlet.com/collections/vi-bop-nu',
    'https://giovannioutlet.com/collections/phu-kien'
  ],

  // Headers
  DEFAULT_HEADERS: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },

  // Server settings
  PORT: 3000
};
