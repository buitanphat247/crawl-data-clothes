const config = require('../config');
const cache = require('../utils/cache');
const scraper = require('../utils/scraper');

class CrawlerService {
  constructor() {
    this.isCrawling = false;
    this.crawlCompleted = false;
    this.crawlData = [];
  }

  // Hàm crawl dữ liệu chính
  async crawlJobs() {
    // Kiểm tra nếu đang crawl hoặc đã hoàn thành
    if (this.isCrawling) {
      console.log('⏳ Đang crawl, vui lòng chờ...');
      return;
    }
    
    if (this.crawlCompleted) {
      console.log('✅ Đã crawl hoàn thành, sử dụng dữ liệu cache');
      return;
    }
    
    // Kiểm tra cache trước
    const cachedData = cache.loadCache();
    if (cachedData) {
      console.log('📦 Đã load dữ liệu từ cache, không cần crawl lại');
      this.crawlData = cachedData;
      this.crawlCompleted = true;
      return;
    }
    
    this.isCrawling = true;
    
    try {
      console.log('🚀 Bắt đầu crawl dữ liệu từ tất cả URLs...');
      console.log(`📡 Sẽ crawl ${config.CRAWL_URLS.length} URLs:`);
      config.CRAWL_URLS.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
      });

      var data = [];
      let allProducts = [];

      // Crawl từng URL
      for (let urlIndex = 0; urlIndex < config.CRAWL_URLS.length; urlIndex++) {
        const url = config.CRAWL_URLS[urlIndex];
        console.log(`\n🌐 [${urlIndex + 1}/${config.CRAWL_URLS.length}] Đang crawl: ${url}`);
        
        try {
          const $ = await scraper.crawlPage(url);
          console.log(`✅ Đã tải URL thành công!`);

          // Lấy sản phẩm từ trang này
          console.log('🔍 Đang parse sản phẩm...');
          let pageProducts = scraper.getProductsFromHtml($);
          console.log(`📊 Tìm thấy ${pageProducts.length} sản phẩm từ URL này`);

          // Load thêm trang nếu được cấu hình
          if (config.MAX_NEXT_PAGES > 0) {
            console.log(`🔄 Đang load thêm ${config.MAX_NEXT_PAGES} trang tiếp theo...`);
            
            for (let pageNum = 2; pageNum <= config.MAX_NEXT_PAGES + 1; pageNum++) {
              console.log(`📡 Đang tải trang ${pageNum}...`);
              const { $nextPage, newProducts } = await scraper.loadNextPage(pageNum, url);
              
              if (newProducts.length === 0) {
                console.log(`❌ Trang ${pageNum} không có sản phẩm, dừng load`);
                break;
              }
              
              // Kiểm tra trùng lặp
              const existingUrls = pageProducts.map(p => p.url);
              const uniqueNewProducts = newProducts.filter(p => !existingUrls.includes(p.url));
              
              if (uniqueNewProducts.length === 0) {
                console.log(`❌ Trang ${pageNum}: Tất cả sản phẩm đã tồn tại, dừng load`);
                break;
              }
              
              pageProducts = pageProducts.concat(uniqueNewProducts);
              console.log(`✅ Trang ${pageNum}: Thêm ${uniqueNewProducts.length} sản phẩm mới (Tổng: ${pageProducts.length})`);
              
              // Delay giữa các request
              if (pageNum <= config.MAX_NEXT_PAGES) {
                console.log('⏳ Chờ 1 giây...');
                await new Promise(resolve => setTimeout(resolve, config.REQUEST_DELAY));
              }
            }
          }

          // Thêm sản phẩm từ URL này vào tổng
          allProducts = allProducts.concat(pageProducts);
          console.log(`✅ URL ${urlIndex + 1}: Tổng cộng ${pageProducts.length} sản phẩm (Tổng tất cả: ${allProducts.length})`);

        } catch (error) {
          console.error(`❌ Lỗi crawl URL ${urlIndex + 1} (${url}):`, error.message);
          // Tiếp tục với URL tiếp theo
        }

        // Delay giữa các URLs
        if (urlIndex < config.CRAWL_URLS.length - 1) {
          console.log('⏳ Chờ 2 giây trước URL tiếp theo...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log(`🎯 Tổng cộng: ${allProducts.length} sản phẩm`);

      // Cấu hình số sản phẩm crawl
      const productsToCrawl = config.TEST_MODE ? allProducts.slice(0, config.MAX_PRODUCTS) : allProducts;
      console.log(`🧪 ${config.TEST_MODE ? 'Test mode' : 'Production mode'}: Crawl ${productsToCrawl.length}/${allProducts.length} sản phẩm`);

      // Đi sâu vào từng sản phẩm tuần tự
      for (let i = 0; i < productsToCrawl.length; i++) {
        const product = productsToCrawl[i];
        
        console.log(`🔍 [${i + 1}/${productsToCrawl.length}] Đang crawl: ${product.title.substring(0, 50)}...`);

        if (product.url) {
          const productDetails = await scraper.crawlProductDetails(product.url);
          
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

      // Lưu dữ liệu
      this.crawlData = data;
      this.crawlCompleted = true;
      
      // Lưu cache
      cache.saveCache(data);

      console.log(`🎉 Hoàn thành crawl dữ liệu! Tổng: ${data.length} sản phẩm`);
      
      // Click nút "Xem thêm sản phẩm" sau khi crawl xong (nếu chưa load đủ trang)
      if (config.MAX_NEXT_PAGES === 0) {
        await this.handleLoadMoreButton($);
      }
      
      // Hiển thị kết quả cuối cùng
      console.log('\n🎯 ===== KẾT THÚC CRAWL =====');
      console.log(`📊 Tổng sản phẩm đã crawl: ${data.length}`);
      console.log(`⏰ Thời gian hoàn thành: ${new Date().toLocaleString('vi-VN')}`);
      console.log('🌐 Server đang chạy tại: http://localhost:3000');
      
    } catch (error) {
      console.log(`❌ Lỗi crawl: ${error.message}`);
    } finally {
      this.isCrawling = false;
    }
  }

  // Xử lý nút "Xem thêm sản phẩm"
  async handleLoadMoreButton($) {
    console.log('🔄 Đang click nút "Xem thêm sản phẩm"...');
    try {
      const loadMoreBtn = $('.btn-loadmore');
      
      if (loadMoreBtn.length > 0) {
        const dataPage = loadMoreBtn.attr('data-page');
        console.log(`📡 Đang tải trang ${dataPage}...`);
        
        const { $nextPage, newProducts } = await scraper.loadNextPage(dataPage);
        
        if (newProducts.length > 0) {
          console.log('✅ Click thành công - Có sản phẩm mới được load');
          
          // Crawl thử 1 sản phẩm của trang tiếp theo
          console.log('🔍 Đang crawl thử 1 sản phẩm trang tiếp theo...');
          
          const firstProduct = $nextPage('.product-loop').first();
          const nextProductTitle = firstProduct.find('.proloop-detail h3 a').text().trim();
          const nextProductUrl = firstProduct.find('.proloop-link').attr('href');
          const nextProductFullUrl = nextProductUrl ? `${config.BASE_URL}${nextProductUrl}` : null;
          
          if (nextProductFullUrl) {
            const productDetails = await scraper.crawlProductDetails(nextProductFullUrl);
            
            if (productDetails) {
              const newProduct = {
                title: nextProductTitle,
                url: nextProductFullUrl,
                ...productDetails
              };
              
              this.crawlData.push(newProduct);
              
              console.log(`✅ Đã thêm sản phẩm mới! Tổng: ${this.crawlData.length} sản phẩm`);
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

  // Force crawl lại
  async forceCrawl() {
    if (this.isCrawling) {
      return { message: 'Đang crawl, vui lòng chờ...', isCrawling: true };
    }
    
    // Xóa cache và crawl lại
    cache.clearCache();
    
    this.crawlCompleted = false;
    this.crawlData = [];
    
    // Bắt đầu crawl lại
    this.crawlJobs();
    
    return { message: 'Đã bắt đầu crawl lại...', isCrawling: true };
  }

  // Lấy dữ liệu
  getData() {
    return this.crawlData;
  }

  // Lấy trạng thái
  getStatus() {
    return {
      isCrawling: this.isCrawling,
      crawlCompleted: this.crawlCompleted,
      dataCount: this.crawlData.length,
      hasCache: cache.hasCache()
    };
  }
}

module.exports = new CrawlerService();
