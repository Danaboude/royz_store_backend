const db = require('../db/db');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const xlsx = require('xlsx');
const ProductMedia = require('../models/ProductMedia');
const Categories = require('../models/Categories');

// Utility to prepend base URL to media/image URL
function withBaseUrl(url, req = null) {

  if (url && url.startsWith('/uploads/')) {
    if (req) {
      return `${req.protocol}://${req.get('host')}${url}`;
    }
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

    return `http://${baseUrl}${url}`;
  }
  return url;
}

// List products for a specific vendor (with pagination/search)
exports.getVendorProducts = async ({ vendorId, page = 1, limit = 20, search = '', isAdmin = false, req = null }) => {
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = 'SELECT * FROM products';
  let params = [];
  let whereClauses = [];
  if (!isAdmin) {
    whereClauses.push('vendor_id = ?');
    params.push(vendorId);
  }
  // Always filter out deleted products
  whereClauses.push('deleted = 0');
  if (search && search.trim() !== '') {
    whereClauses.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  const [products] = await db.pool.query(query, params);
  // Prepend base URL to image_url for each product
  return products.map(product => ({
    ...product,
    image_url: withBaseUrl(product.image_url, req)
  }));
};
exports.exportProductsToExcelForVendor = async (vendorId) => {
  try {
    const productss = await Product.findAll();
    const products = productss.filter(product => product.vendor_id === vendorId);

    // Transform products data for Excel
    const MAX_EXCEL_CELL_LENGTH = 32767;
    const safeCell = (value) => {
      if (typeof value === 'string' && value.length > MAX_EXCEL_CELL_LENGTH) {
        return value.slice(0, MAX_EXCEL_CELL_LENGTH - 3) + '...';
      }
      return value;
    };

    // Fetch all media for each product
    const excelData = await Promise.all(products.map(async product => {
      let mediaList = [];
      try {
        mediaList = await ProductMedia.findByProductId(product.product_id);
      } catch (e) {
        mediaList = [];
      }
      const imageUrls = mediaList.filter(m => m.media_type === 'image').map(m => m.media_url).join(', ');
      const videoUrls = mediaList.filter(m => m.media_type === 'video').map(m => m.media_url).join(', ');

      // Fetch category name
      let categoryName = '';
      try {
        const category = await Categories.getById(product.category_id);
        categoryName = category ? category.name_en : '';
      } catch (e) {
        categoryName = '';
      }

      return {
        'Product ID': product.product_id,
        'Name': safeCell(product.name),
        'Description': safeCell(product.description),
        'Price': product.price,
        'Stock': product.stock,
        'Category ID': product.category_id,
        'Category Name': safeCell(categoryName),
        'Vendor ID': product.vendor_id,
        'Image URL': safeCell(product.image_url || ''),
        'Image URLs': safeCell(imageUrls),
        'Video URLs': safeCell(videoUrls),
        'Is New': product.is_new ? 'Yes' : 'No',
        'Is Best Selling': product.is_best_selling ? 'Yes' : 'No',
        'Is Deal Offer': product.is_deal_offer ? 'Yes' : 'No',
        'Original Price': product.original_price || '',
        'Discount Percentage': product.discount_percentage || '',
        'Discount Start Date': safeCell(product.discount_start_date || ''),
        'Discount End Date': safeCell(product.discount_end_date || ''),
        'Created At': safeCell(product.created_at),
        'Updated At': safeCell(product.updated_at)
      };
    }));

    // Create workbook and worksheet
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 10 }, // Product ID
      { wch: 30 }, // Name
      { wch: 50 }, // Description
      { wch: 12 }, // Price
      { wch: 10 }, // Stock
      { wch: 12 }, // Category ID
      { wch: 20 }, // Category Name
      { wch: 12 }, // Vendor ID
      { wch: 50 }, // Image URL
      { wch: 80 }, // Image URLs
      { wch: 80 }, // Video URLs
      { wch: 10 }, // Is New
      { wch: 15 }, // Is Best Selling
      { wch: 15 }, // Is Deal Offer
      { wch: 15 }, // Original Price
      { wch: 20 }, // Discount Percentage
      { wch: 20 }, // Discount Start Date
      { wch: 20 }, // Discount End Date
      { wch: 20 }, // Created At
      { wch: 20 }  // Updated At
    ];
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Products');

    // Generate buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return buffer; // Return the buffer
  } catch (error) {
    console.error('Error exporting products:', error);
    throw new Error('Server Error'); // Throw an error to be handled in the route
  }
};

// Add a new product for a vendor
exports.createProductForVendor = async ({ vendorId, ...productData }) => {
  // Only allow real columns
  const allowedFields = [
    'category_id', 'name', 'description', 'price', 'stock', 'image_url',
    'is_new', 'is_best_selling', 'is_deal_offer', 'original_price',
    'discount_percentage', 'discount_start_date', 'discount_end_date',
    'is_gift', 'created_at'
  ];
  const insertData = {};
  for (const key of allowedFields) {
    if (key in productData) insertData[key] = productData[key];
  }

  const [result] = await db.pool.query('INSERT INTO products SET ?', { ...insertData, vendor_id: vendorId });
  return { id: result.insertId, ...insertData, vendor_id: vendorId };
};

// Update a product for a vendor
exports.updateProductForVendor = async ({ vendorId, productId, ...productData }) => {
  // Only allow real columns
  const allowedFields = [
    'category_id', 'name', 'description', 'price', 'stock', 'image_url',
    'is_new', 'is_best_selling', 'is_deal_offer', 'original_price',
    'discount_percentage', 'discount_start_date', 'discount_end_date',
    'is_gift', 'created_at'
  ];
  const updateData = {};
  for (const key of allowedFields) {
    if (key in productData) updateData[key] = productData[key];
  }
  await db.pool.query('UPDATE products SET ? WHERE product_id = ? AND vendor_id = ?', [updateData, productId, vendorId]);
  return { id: productId, ...updateData, vendor_id: vendorId };
};

// Delete a product for a vendor
exports.deleteProductForVendor = async ({ vendorId, productId }) => {
  await db.pool.query('DELETE FROM products WHERE product_id = ? AND vendor_id = ?', [productId, vendorId]);
};

exports.uploadProductMediaForVendor = async ({ vendorId, productId, files, file, req = null }) => {
  // Check product ownership
  const [products] = await db.pool.query(
    'SELECT * FROM products WHERE product_id = ? AND vendor_id = ? AND deleted = 0',
    [productId, vendorId]
  );

  if (!products.length) {
    throw new Error('Product not found or not owned by vendor');
  }

  // Handle both single file and multiple files
  const filesToProcess = files || (file ? [file] : []);

  if (!filesToProcess || filesToProcess.length === 0) {
    throw new Error('No files uploaded');
  }

  const insertedMedia = [];

  for (const fileItem of filesToProcess) {
    const mediaUrl = `/uploads/product-media/${fileItem.filename}`;
    const mediaType = fileItem.mimetype.startsWith('video/') ? 'video' : 'image';

    // Insert each media entry
    const [result] = await db.pool.query(
      'INSERT INTO product_media (product_id, media_url, media_type) VALUES (?, ?, ?)',
      [productId, mediaUrl, mediaType]
    );

    insertedMedia.push({
      media_id: result.insertId,
      media_url: withBaseUrl(mediaUrl, req),
      media_type: mediaType,
    });
  }

  return insertedMedia;
};


