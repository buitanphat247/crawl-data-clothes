var express = require('express');
var app = express();
const cheerio = require('cheerio');
const request = require('request-promise');
const fs = require('fs');
const path = require('path');

// Biến global để lưu dữ liệu
let crawlData = [];
let isCrawling = false;
let crawlCompleted = false;

// Cấu hình test mode
const TEST_MODE = false;
const MAX_PRODUCTS = 1;
const MAX_NEXT_PAGES = 3;

// Cache file path
const CACHE_FILE = path.join(__dirname, 'cache.json');
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 phút

// Serve static HTML file
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

// Hàm load cache
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const now = Date.now();
      
      // Kiểm tra cache có hết hạn không
      if (now - cacheData.timestamp < CACHE_EXPIRY) {
        console.log('📦 Đang load dữ liệu từ cache...');
        crawlData = cacheData.data;
        crawlCompleted = true;
        return true;
      } else {
        console.log('⏰ Cache đã hết hạn, sẽ crawl lại...');
        fs.unlinkSync(CACHE_FILE); // Xóa cache cũ
      }
    }
    return false;
  } catch (error) {
    console.log('❌ Lỗi khi load cache:', error.message);
    return false;
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
  } catch (error) {
    console.log('❌ Lỗi khi lưu cache:', error.message);
  }
}

// API endpoint để trả về dữ liệu JSON
app.get('/api/data', function (req, res) {
  res.json(crawlData);
});

// API endpoint để force crawl lại
app.get('/api/force-crawl', function (req, res) {
  if (isCrawling) {
    return res.json({ message: 'Đang crawl, vui lòng chờ...', isCrawling: true });
  }
  
  // Xóa cache và crawl lại
  if (fs.existsSync(CACHE_FILE)) {
    fs.unlinkSync(CACHE_FILE);
  }
  
  crawlCompleted = false;
  crawlData = [];
  
  // Bắt đầu crawl lại
  crawlJobs();
  
  res.json({ message: 'Đã bắt đầu crawl lại...', isCrawling: true });
});

// API endpoint để kiểm tra trạng thái
app.get('/api/status', function (req, res) {
  res.json({
    isCrawling: isCrawling,
    crawlCompleted: crawlCompleted,
    dataCount: crawlData.length,
    hasCache: fs.existsSync(CACHE_FILE)
  });
});

// Hàm crawl dữ liệu
async function crawlJobs() {
  // Kiểm tra nếu đang crawl hoặc đã hoàn thành
  if (isCrawling) {
    console.log('⏳ Đang crawl, vui lòng chờ...');
    return;
  }
  
  if (crawlCompleted) {
    console.log('✅ Đã crawl hoàn thành, sử dụng dữ liệu cache');
    return;
  }
  
  // Kiểm tra cache trước
  if (loadCache()) {
    console.log('📦 Đã load dữ liệu từ cache, không cần crawl lại');
    return;
  }
  
  isCrawling = true;
  
  try {
    console.log('🚀 Bắt đầu crawl dữ liệu...');
    console.log('📡 Đang tải trang chính...');
    
    const html = await request({
      uri: 'https://giovannioutlet.com/collections/sale?gad_source=1&gad_campaignid=22827924712&gbraid=0AAAAA91RmBEwJ_UeFqXT4E6NrYmY0CL2W&gclid=CjwKCAjwmNLHBhA4EiwA3ts3mbE8ZPUIXlEVdN_8VmIIxmjDiAywhL0t7y5HVp00qwwZ6RONBGyO6RoCdvQQAvD_BwE',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('✅ Đã tải trang chính thành công!');

    const $ = cheerio.load(html);
    var data = [];

    // Hàm lấy sản phẩm từ HTML
    function getProductsFromHtml($html) {
      const products = [];
      $html('.product-loop').each((index, el) => {
        const title = $html(el).find('.proloop-detail h3 a').text().trim();
        const price = $html(el).find('.price').text().trim();
        const priceOld = $html(el).find('.price-del').text().trim();
        const sale = $html(el).find('.pro-sale').text().trim();
        const productUrl = $html(el).find('.proloop-link').attr('href');
        const fullUrl = productUrl ? `https://giovannioutlet.com${productUrl}` : null;

        products.push({
          title, price, priceOld, sale, url: fullUrl
        });
      });
      return products;
    }

    // Hàm crawl chi tiết sản phẩm
    async function crawlProductDetails(productUrl) {
      try {
        const productHtml = await request({
          uri: productUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const $product = cheerio.load(productHtml);
        
        // Lấy thông tin chi tiết
        const productName = $product('.product-heading h1').text().trim();
        const productSku = $product('#pro_sku strong').text().trim();
        const productStatus = $product('.pro-soldold strong').text().trim();
        const productBrand = $product('.pro-vendor strong a').text().trim();
        const productPrice = $product('.pro-price').text().trim();
        const productOldPrice = $product('.product-price del').text().trim();
        const productDiscount = $product('.pro-percent').text().trim();
        
        // Lấy kích thước và màu sắc
        const sizes = [];
        $product('#variant-swatch-0 .swatch-element').each((i, el) => {
          const val = $product(el).attr('data-value')?.trim();
          if (val) sizes.push(val);
        });
        
        const colors = [];
        $product('#variant-swatch-1 .swatch-element').each((i, el) => {
          const val = $product(el).attr('data-value')?.trim();
          if (val) colors.push(val);
        });
        
        // Lấy hình ảnh
        const imageUrls = [];
        $product('.productList-slider .product-gallery__photo').each((i, el) => {
          let url = $product(el).attr('data-image')?.trim();
          if (!url) {
            url = $product(el).find('a').attr('href')?.trim();
          }
          if (url) {
            if (url.startsWith('//')) url = 'https:' + url;
            imageUrls.push(url);
          }
        });
        
        // Lấy mô tả
        let desc = $product('.description-productdetail').text() || '';
        desc = desc.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        
        return {
          SKU: { name: 'SKU', value: productSku },
          status: { name: 'Trạng thái', value: productStatus },
          brand: { name: 'Thương hiệu', value: productBrand },
          sizeList: sizes,
          colorList: colors,
          imageList: imageUrls,
          desc: desc
        };
        
      } catch (error) {
        return null;
      }
    }

    // Hàm load trang tiếp theo
    async function loadNextPage(pageNumber) {
      try {
        const nextPageHtml = await request({
          uri: `https://giovannioutlet.com/collections/sale?page=${pageNumber}`,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        const $nextPage = cheerio.load(nextPageHtml);
        const newProducts = getProductsFromHtml($nextPage);
        
        return { $nextPage, newProducts };
        
      } catch (error) {
        return { $nextPage: null, newProducts: [] };
      }
    }

    // Lấy sản phẩm từ trang đầu tiên
    console.log('🔍 Đang parse sản phẩm trang 1...');
    let allProducts = getProductsFromHtml($);
    console.log(`📊 Trang 1: Tìm thấy ${allProducts.length} sản phẩm`);

    // Load thêm trang nếu được cấu hình
    if (MAX_NEXT_PAGES > 0) {
      console.log(`🔄 Đang load thêm ${MAX_NEXT_PAGES} trang tiếp theo...`);
      
      for (let pageNum = 2; pageNum <= MAX_NEXT_PAGES + 1; pageNum++) {
        console.log(`📡 Đang tải trang ${pageNum}...`);
        const { $nextPage, newProducts } = await loadNextPage(pageNum);
        
        if (newProducts.length === 0) {
          console.log(`❌ Trang ${pageNum} không có sản phẩm, dừng load`);
          break;
        }
        
        // Kiểm tra trùng lặp
        const existingUrls = allProducts.map(p => p.url);
        const uniqueNewProducts = newProducts.filter(p => !existingUrls.includes(p.url));
        
        if (uniqueNewProducts.length === 0) {
          console.log(`❌ Trang ${pageNum}: Tất cả sản phẩm đã tồn tại, dừng load`);
          break;
        }
        
        allProducts = allProducts.concat(uniqueNewProducts);
        console.log(`✅ Trang ${pageNum}: Thêm ${uniqueNewProducts.length} sản phẩm mới (Tổng: ${allProducts.length})`);
        
        // Delay giữa các request
        if (pageNum <= MAX_NEXT_PAGES) {
          console.log('⏳ Chờ 1 giây...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.log(`🎯 Tổng cộng: ${allProducts.length} sản phẩm`);

    // Cấu hình số sản phẩm crawl
    const productsToCrawl = TEST_MODE ? allProducts.slice(0, MAX_PRODUCTS) : allProducts;
    console.log(`🧪 ${TEST_MODE ? 'Test mode' : 'Production mode'}: Crawl ${productsToCrawl.length}/${allProducts.length} sản phẩm`);

    // Đi sâu vào từng sản phẩm tuần tự
    for (let i = 0; i < productsToCrawl.length; i++) {
      const product = productsToCrawl[i];
      
      console.log(`🔍 [${i + 1}/${productsToCrawl.length}] Đang crawl: ${product.title.substring(0, 50)}...`);

      if (product.url) {
        const productDetails = await crawlProductDetails(product.url);
        
        if (productDetails) {
          data.push({
            ...product,
            ...productDetails
          });
          console.log(`✅ [${i + 1}/${productsToCrawl.length}] Crawl thành công: ${product.title.substring(0, 30)}...`);
        } else {
          data.push({ ...product, status: 'Lỗi khi crawl chi tiết' });
          console.log(`❌ [${i + 1}/${productsToCrawl.length}] Crawl thất bại: ${product.title.substring(0, 30)}...`);
        }
      } else {
        console.log(`⚠️ [${i + 1}/${productsToCrawl.length}] Không có URL để crawl`);
        data.push({ ...product, status: 'Không có URL' });
      }
    }

    // Lưu dữ liệu vào biến global
    crawlData = data;
    crawlCompleted = true;
    
    // Lưu cache
    saveCache(data);

    console.log(`🎉 Hoàn thành crawl dữ liệu! Tổng: ${data.length} sản phẩm`);
    
    // Click nút "Xem thêm sản phẩm" sau khi crawl xong (nếu chưa load đủ trang)
    if (MAX_NEXT_PAGES === 0) {
      console.log('🔄 Đang click nút "Xem thêm sản phẩm"...');
      try {
        const loadMoreBtn = $('.btn-loadmore');
        
        if (loadMoreBtn.length > 0) {
          const dataPage = loadMoreBtn.attr('data-page');
          console.log(`📡 Đang tải trang ${dataPage}...`);
          
          const { $nextPage, newProducts } = await loadNextPage(dataPage);
          
          if (newProducts.length > 0) {
            console.log('✅ Click thành công - Có sản phẩm mới được load');
            
            // Crawl thử 1 sản phẩm của trang tiếp theo
            console.log('🔍 Đang crawl thử 1 sản phẩm trang tiếp theo...');
            
            const firstProduct = $nextPage('.product-loop').first();
            const nextProductTitle = firstProduct.find('.proloop-detail h3 a').text().trim();
            const nextProductUrl = firstProduct.find('.proloop-link').attr('href');
            const nextProductFullUrl = nextProductUrl ? `https://giovannioutlet.com${nextProductUrl}` : null;
            
            if (nextProductFullUrl) {
              const productDetails = await crawlProductDetails(nextProductFullUrl);
              
              if (productDetails) {
                const newProduct = {
                  title: nextProductTitle,
                  url: nextProductFullUrl,
                  ...productDetails
                };
                
                data.push(newProduct);
                crawlData = data;
                
                console.log(`✅ Đã thêm sản phẩm mới! Tổng: ${data.length} sản phẩm`);
              } else {
                console.log('❌ Không thể crawl sản phẩm mới');
              }
            } else {
              console.log('⚠️ Không có URL sản phẩm để crawl');
            }
          } else {
            console.log('⚠️ Click thành công nhưng không có sản phẩm mới');
          }
        } else {
          console.log('❌ Không tìm thấy nút "Xem thêm sản phẩm"');
        }
      } catch (error) {
        console.log(`❌ Lỗi khi click nút "Xem thêm sản phẩm": ${error.message}`);
      }
    }
    
    // Hiển thị kết quả cuối cùng
    console.log('\n🎯 ===== KẾT THÚC CRAWL =====');
    console.log(`📊 Tổng sản phẩm đã crawl: ${data.length}`);
    console.log(`⏰ Thời gian hoàn thành: ${new Date().toLocaleString('vi-VN')}`);
    console.log('🌐 Server đang chạy tại: http://localhost:3000');
  } catch (error) {
    console.log(`❌ Lỗi crawl: ${error.message}`);
  } finally {
    isCrawling = false;
  }
}

app.listen(3000, function () {
  console.log('🚀 Server đang chạy tại: http://localhost:3000');
  console.log('📊 Dashboard: http://localhost:3000');
  console.log('🔗 API: http://localhost:3000/api/data');
  console.log('⏳ Đang bắt đầu crawl dữ liệu...\n');
  
  // Chạy crawl ngay khi server start
  crawlJobs();
});