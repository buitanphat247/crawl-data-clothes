const cheerio = require('cheerio');
const request = require('request-promise');
const config = require('../config');

// Hàm lấy sản phẩm từ HTML
function getProductsFromHtml($html) {
  const products = [];
  $html('.product-loop').each((index, el) => {
    const title = $html(el).find('.proloop-detail h3 a').text().trim();
    const price = $html(el).find('.price').text().trim();
    const priceOld = $html(el).find('.price-del').text().trim();
    const sale = $html(el).find('.pro-sale').text().trim();
    const productUrl = $html(el).find('.proloop-link').attr('href');
    const fullUrl = productUrl ? `${config.BASE_URL}${productUrl}` : null;

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
      headers: config.DEFAULT_HEADERS
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
    console.log(`❌ Lỗi crawl chi tiết: ${error.message}`);
    return null;
  }
}

// Hàm load trang tiếp theo
async function loadNextPage(pageNumber, baseUrl = config.SALE_URL) {
  try {
    const nextPageHtml = await request({
      uri: `${baseUrl}?page=${pageNumber}`,
      headers: {
        ...config.DEFAULT_HEADERS,
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
    console.log(`❌ Lỗi load trang ${pageNumber}: ${error.message}`);
    return { $nextPage: null, newProducts: [] };
  }
}

// Hàm crawl trang chính
async function crawlMainPage() {
  const html = await request({
    uri: config.SALE_URL + '?gad_source=1&gad_campaignid=22827924712&gbraid=0AAAAA91RmBEwJ_UeFqXT4E6NrYmY0CL2W&gclid=CjwKCAjwmNLHBhA4EiwA3ts3mbE8ZPUIXlEVdN_8VmIIxmjDiAywhL0t7y5HVp00qwwZ6RONBGyO6RoCdvQQAvD_BwE',
    headers: config.DEFAULT_HEADERS
  });
  
  return cheerio.load(html);
}

// Hàm crawl từ URL bất kỳ
async function crawlPage(url) {
  const html = await request({
    uri: url,
    headers: config.DEFAULT_HEADERS
  });
  
  return cheerio.load(html);
}

module.exports = {
  getProductsFromHtml,
  crawlProductDetails,
  loadNextPage,
  crawlMainPage,
  crawlPage
};
