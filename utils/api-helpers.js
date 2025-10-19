const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

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
        fs.unlink(filepath, () => { }); // Xóa file lỗi
        reject(err);
      });

    }).on('error', (err) => {
      fs.unlink(filepath, () => { }); // Xóa file lỗi
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

module.exports = {
  downloadImageNative,
  createProductFolder,
  createInfoJson
};
