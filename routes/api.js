const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crawler = require('../services/crawler');
const UploadService = require('../services/upload-service');
const { downloadImageNative, createProductFolder, createInfoJson } = require('../utils/api-helpers');

// Khởi tạo upload service
const uploadService = new UploadService();

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

// API endpoint để upload tất cả products lên server
router.post('/upload-all', async function (req, res) {
  try {
    console.log('🚀 Bắt đầu upload tất cả products...');
    
    // Đọc dữ liệu từ cache.json
    const cachePath = path.join(__dirname, '..', 'cache.json');
    const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const products = cacheData.data || [];
    
    console.log(`📊 Tìm thấy ${products.length} products để upload`);
    
    if (products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không có dữ liệu để upload' 
      });
    }
    
    // Upload tất cả products
    const result = await uploadService.uploadAllProducts(products);
    
    res.json({
      success: true,
      message: `Upload hoàn thành!`,
      stats: {
        total: result.total,
        success: result.success,
        errors: result.errors.length
      },
      errors: result.errors,
      results: result.results
    });
    
  } catch (error) {
    console.error('❌ Lỗi upload products:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi upload products',
      error: error.message
    });
  }
});

// API endpoint để upload 1 product cụ thể
router.post('/upload-product/:index', async function (req, res) {
  try {
    const productIndex = parseInt(req.params.index);
    
    // Đọc dữ liệu từ cache.json
    const cachePath = path.join(__dirname, '..', 'cache.json');
    const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const products = cacheData.data || [];
    
    if (productIndex < 0 || productIndex >= products.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Index không hợp lệ' 
      });
    }
    
    const product = products[productIndex];
    console.log(`🚀 Uploading product ${productIndex + 1}: ${product.title}`);
    
    // Reset stats
    uploadService.resetStats();
    
    // Upload product
    const result = await uploadService.uploadSingleProduct(product);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Upload product ${productIndex + 1} hoàn thành!`,
        product: result.product,
        productId: result.productId,
        stats: uploadService.getStats()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Lỗi upload product',
        error: result.error,
        stats: uploadService.getStats()
      });
    }
    
  } catch (error) {
    console.error('❌ Lỗi upload product:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi upload product',
      error: error.message
    });
  }
});

// API endpoint để xem upload stats
router.get('/upload-stats', function (req, res) {
  const stats = uploadService.getStats();
  res.json({
    success: true,
    stats: stats
  });
});

module.exports = router;
