const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
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

// Helper function để download ảnh sử dụng native modules
function downloadImageNative(url, filepath) {
  return new Promise((resolve, reject) => {
    // Xử lý URL có thể bắt đầu bằng //
    const fullUrl = url.startsWith('http') ? url : `https:${url}`;
    
    // Tạo thư mục nếu chưa tồn tại
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const file = fs.createWriteStream(filepath);
    
    // Chọn module phù hợp dựa trên protocol
    const client = fullUrl.startsWith('https:') ? https : http;
    
    client.get(fullUrl, (response) => {
      // Kiểm tra status code
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Đã tải: ${path.basename(filepath)}`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Xóa file lỗi
        reject(err);
      });
      
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Xóa file lỗi
      console.error(`❌ Lỗi download ${url}:`, err.message);
      reject(err);
    });
  });
}

// Helper function để tạo folder structure
function createProductFolder(productId, baseDir) {
  const productDir = path.join(baseDir, productId.toString());
  const imagesDir = path.join(productDir, 'images');
  
  if (!fs.existsSync(productDir)) {
    fs.mkdirSync(productDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  return { productDir, imagesDir };
}

// Helper function để tạo info.json
function createInfoJson(product, productDir) {
  const infoData = {
    title: product.title,
    price: product.price,
    priceOld: product.priceOld,
    sale: product.sale,
    url: product.url,
    SKU: product.SKU,
    status: product.status,
    brand: product.brand,
    sizeList: product.sizeList,
    colorList: product.colorList,
    desc: product.desc,
    exportedAt: new Date().toISOString()
  };
  
  const infoPath = path.join(productDir, 'info.json');
  fs.writeFileSync(infoPath, JSON.stringify(infoData, null, 2), 'utf8');
}

// API endpoint để export products - phiên bản cực đơn giản
router.post('/export-products', async function (req, res) {
  console.log('🚀 Bắt đầu export products...');
  
  try {
    // Đọc dữ liệu từ cache.json
    const cachePath = path.join(__dirname, '..', 'cache.json');
    const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const products = cacheData.data || [];
    
    console.log(`📊 Tìm thấy ${products.length} products để export`);
    
    if (products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không có dữ liệu để export' 
      });
    }
    
    // Export tất cả products
    const maxProducts = products.length;
    console.log(`🚀 Sẽ export tất cả ${maxProducts} products`);
    
    // Tạo thư mục export
    const exportDir = path.join(__dirname, '..', 'exported_products');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Xử lý từng product
    const processProduct = async (product, productId) => {
      try {
        // Tạo folder cho product
        const { productDir, imagesDir } = createProductFolder(productId, exportDir);
        
        // Tạo info.json
        createInfoJson(product, productDir);
        
        // Download ảnh nếu có
        if (product.imageList && Array.isArray(product.imageList)) {
          const downloadPromises = product.imageList.map(async (imageUrl, j) => {
            try {
              // Xử lý URL để lấy extension
              let imageExtension = '.jpg'; // default
              try {
                const urlObj = new URL(imageUrl.startsWith('http') ? imageUrl : `https:${imageUrl}`);
                const ext = path.extname(urlObj.pathname);
                if (ext) imageExtension = ext;
              } catch (e) {
                // Nếu không parse được URL, dùng default
              }
              
              const imageName = `image_${j + 1}${imageExtension}`;
              const imagePath = path.join(imagesDir, imageName);
              
              await downloadImageNative(imageUrl, imagePath);
            } catch (error) {
              console.error(`Lỗi download ảnh ${j + 1} của product ${productId}:`, error.message);
            }
          });
          
          // Chờ tất cả ảnh download xong
          await Promise.allSettled(downloadPromises);
        }
        
        console.log(`✅ Đã export product ${productId}: ${product.title}`);
        return { success: true, productId, title: product.title };
        
      } catch (error) {
        console.error(`❌ Lỗi export product ${productId}:`, error.message);
        return { success: false, productId, title: product.title, error: error.message };
      }
    };
    
    // Xử lý tất cả products tuần tự
    console.log(`📦 Xử lý ${maxProducts} products tuần tự`);
    
    for (let i = 0; i < maxProducts; i++) {
      const product = products[i];
      const productId = i + 1;
      
      console.log(`🔄 Xử lý product ${productId}/${maxProducts}: ${product.title}`);
      
      try {
        // Tạo folder cho product
        const { productDir, imagesDir } = createProductFolder(productId, exportDir);
        
        // Tạo info.json
        createInfoJson(product, productDir);
        
        console.log(`✅ Đã tạo folder và info.json cho product ${productId}`);
        
        successCount++;
        
        // Nghỉ ngắn giữa các products
        if (i < maxProducts - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Lỗi product ${productId}:`, error.message);
        errorCount++;
        errors.push({
          productId: productId,
          title: product.title,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Export hoàn thành! Thành công: ${successCount}, Lỗi: ${errorCount}`);
    
    res.json({
      success: true,
      message: `Export hoàn thành! Thành công: ${successCount}, Lỗi: ${errorCount}`,
      stats: {
        total: maxProducts,
        success: successCount,
        errors: errorCount
      },
      errors: errors,
      exportPath: exportDir
    });
    
  } catch (error) {
    console.error('❌ Lỗi export products:', error);
    
    // Kiểm tra nếu response đã được gửi
    if (res.headersSent) {
      console.error('Response đã được gửi, không thể gửi error response');
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi export products',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
