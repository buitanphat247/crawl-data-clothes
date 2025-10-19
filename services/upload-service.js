const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const FormData = require('form-data');

class UploadService {
  constructor() {
    this.baseUrl = 'http://localhost:8080';
    this.uploadStats = {
      total: 0,
      success: 0,
      errors: []
    };
  }

  // Reset stats
  resetStats() {
    this.uploadStats = {
      total: 0,
      success: 0,
      errors: []
    };
  }

  // Get stats
  getStats() {
    return this.uploadStats;
  }

  // 1. Upload product lên /api/products
  async uploadProduct(product) {
    try {
      const productData = {
        name: product.title,
        description: product.desc || '',
        price: this.parsePrice(product.price),
        stock: 200 // Default stock
      };

      console.log(`🔍 Debug: Uploading product data:`, productData);
      console.log(`🔍 Debug: API URL: ${this.baseUrl}/api/products`);
      
      const response = await axios.post(`${this.baseUrl}/api/products`, productData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`🔍 Debug: Response status: ${response.status}`);
      console.log(`🔍 Debug: Product upload response:`, response.data);
      console.log(`✅ Uploaded product: ${product.title}`);
      
      // Lấy product ID từ response.data.data.id
      const productId = response.data.data?.id;
      console.log(`🔍 Debug: Product ID: ${productId}`);
      
      if (!productId) {
        throw new Error('Không có productId từ response');
      }
      
      this.uploadStats.success++;
      return {
        id: productId,
        ...response.data.data
      };
    } catch (error) {
      console.error(`❌ Error uploading product ${product.title}:`, error.message);
      console.error(`❌ Error response:`, error.response?.data);
      
      this.uploadStats.errors.push({
        type: 'product',
        name: product.title,
        error: error.message
      });
      return null;
    }
  }

  // 2. Upload product attributes lên /api/product-attributes
  async uploadProductAttributes(productId, product) {
    const attributes = [];

    try {
      // Upload SKU attribute
      if (product.SKU && product.SKU.value) {
        const skuAttribute = {
          productId: productId,
          name: 'SKU',
          value: product.SKU.value
        };
        
        try {
          const response = await axios.post(`${this.baseUrl}/api/product-attributes`, skuAttribute);
          console.log(`✅ Uploaded SKU attribute: ${product.SKU.value}`);
          attributes.push(skuAttribute);
        } catch (error) {
          console.error(`❌ Error uploading SKU ${product.SKU.value}:`, error.message);
        }
      }

      // Upload Size attributes
      if (product.sizeList && Array.isArray(product.sizeList)) {
        for (const size of product.sizeList) {
          const sizeAttribute = {
            productId: productId,
            name: 'Size',
            value: size
          };
          
          try {
            const response = await axios.post(`${this.baseUrl}/api/product-attributes`, sizeAttribute);
            console.log(`✅ Uploaded Size attribute: ${size}`);
            attributes.push(sizeAttribute);
          } catch (error) {
            console.error(`❌ Error uploading Size ${size}:`, error.message);
          }
        }
      }

      // Upload Color attributes
      if (product.colorList && Array.isArray(product.colorList)) {
        for (const color of product.colorList) {
          const colorAttribute = {
            productId: productId,
            name: 'Color',
            value: color
          };
          
          try {
            const response = await axios.post(`${this.baseUrl}/api/product-attributes`, colorAttribute);
            console.log(`✅ Uploaded Color attribute: ${color}`);
            attributes.push(colorAttribute);
          } catch (error) {
            console.error(`❌ Error uploading Color ${color}:`, error.message);
          }
        }
      }

      console.log(`✅ Uploaded ${attributes.length} attributes for product ${productId}`);
      return attributes;
    } catch (error) {
      console.error(`❌ Error uploading attributes for product ${productId}:`, error.message);
      return [];
    }
  }

  // 3. Download ảnh về folder images trước
  async downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
      const fullUrl = url.startsWith('http') ? url : `https:${url}`;
      
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const file = fs.createWriteStream(filepath);
      const client = fullUrl.startsWith('https:') ? https : http;

      client.get(fullUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded: ${path.basename(filepath)}`);
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(filepath, () => {});
          reject(err);
        });

      }).on('error', (err) => {
        fs.unlink(filepath, () => {});
        console.error(`❌ Error downloading ${url}:`, err.message);
        reject(err);
      });
    });
  }

  // 4. Upload ảnh lên cloudinary
  async uploadToCloudinary(imagePath, filename) {
    try {
      console.log(`🔍 Debug: Uploading ${imagePath} to cloudinary`);
      
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      formData.append('folder', 'spring_shop');

      const response = await axios.post(`${this.baseUrl}/api/cloudinary`, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 30000
      });

      console.log(`🔍 Debug: Cloudinary response:`, response.data);
      
      if (response.data.success && response.data.data?.secure_url) {
        return response.data.data.secure_url;
      } else {
        throw new Error('Cloudinary upload failed');
      }
    } catch (error) {
      console.error(`❌ Error uploading to cloudinary:`, error.message);
      return null;
    }
  }

  // 5. Upload product images
  async uploadProductImages(productId, product) {
    if (!product.imageList || !Array.isArray(product.imageList)) {
      console.log(`⚠️ No images for product ${productId}`);
      return [];
    }

    const uploadedImages = [];
    const imagesDir = path.join(__dirname, '..', 'exported_products', productId.toString(), 'images');
    
    // Tạo thư mục images nếu chưa có
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    console.log(`🔍 Debug: Processing ${product.imageList.length} images for product ${productId}`);

    for (let i = 0; i < product.imageList.length; i++) {
      const imageUrl = product.imageList[i];
      const imageExtension = this.getImageExtension(imageUrl);
      const localImagePath = path.join(imagesDir, `image_${i + 1}${imageExtension}`);

      try {
        // Bước 1: Download ảnh về local
        console.log(`🔍 Debug: Downloading image ${i + 1} from ${imageUrl}`);
        await this.downloadImage(imageUrl, localImagePath);
        
        // Bước 2: Upload lên cloudinary
        console.log(`🔍 Debug: Uploading image ${i + 1} to cloudinary`);
        const cloudinaryUrl = await this.uploadToCloudinary(localImagePath, `image_${i + 1}`);
        
        if (cloudinaryUrl) {
          // Bước 3: Upload link ảnh lên /api/product-images
          const imageData = {
            productId: productId,
            url: cloudinaryUrl
          };
          
          const apiResponse = await axios.post(`${this.baseUrl}/api/product-images`, imageData);
          console.log(`✅ Uploaded image ${i + 1}: ${cloudinaryUrl}`);
          uploadedImages.push(imageData);
        } else {
          console.error(`❌ Failed to upload image ${i + 1} to cloudinary`);
        }
      } catch (error) {
        console.error(`❌ Error processing image ${i + 1}:`, error.message);
      }
    }

    return uploadedImages;
  }

  // Helper function để lấy extension của ảnh
  getImageExtension(url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https:${url}`);
      const ext = path.extname(urlObj.pathname);
      return ext || '.jpg';
    } catch (e) {
      return '.jpg';
    }
  }

  // Helper function để parse price
  parsePrice(priceString) {
    if (!priceString) return 0;
    
    // Loại bỏ ký tự không phải số
    const cleanPrice = priceString.replace(/[^\d]/g, '');
    return parseInt(cleanPrice) || 0;
  }

  // Main function để upload toàn bộ product
  async uploadSingleProduct(product) {
    try {
      console.log(`🚀 Starting upload for product: ${product.title}`);
      
      // Bước 1: Upload product
      const uploadedProduct = await this.uploadProduct(product);
      if (!uploadedProduct) {
        throw new Error('Failed to upload product');
      }

      const productId = uploadedProduct.id;
      console.log(`✅ Product uploaded with ID: ${productId}`);

      // Bước 2: Upload attributes
      await this.uploadProductAttributes(productId, product);
      console.log(`✅ Attributes uploaded for product ${productId}`);

      // Bước 3: Upload images
      await this.uploadProductImages(productId, product);
      console.log(`✅ Images uploaded for product ${productId}`);

      this.uploadStats.total++;
      console.log(`🎉 Product ${product.title} uploaded successfully!`);
      
      return {
        success: true,
        product: uploadedProduct,
        productId: productId
      };
    } catch (error) {
      console.error(`❌ Error uploading product ${product.title}:`, error.message);
      this.uploadStats.errors.push({
        type: 'product',
        name: product.title,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Upload tất cả products
  async uploadAllProducts(products) {
    console.log(`🚀 Starting upload for ${products.length} products`);
    this.resetStats();

    const results = [];
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`\n📦 Processing product ${i + 1}/${products.length}: ${product.title}`);
      
      const result = await this.uploadSingleProduct(product);
      results.push(result);
      
      // Nghỉ ngắn giữa các products
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n🎉 Upload completed! Success: ${this.uploadStats.success}, Errors: ${this.uploadStats.errors.length}`);
    return {
      total: products.length,
      success: this.uploadStats.success,
      errors: this.uploadStats.errors,
      results: results
    };
  }
}

module.exports = UploadService;
