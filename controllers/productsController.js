const Product = require('../models/Product');
const ProductMedia = require('../models/ProductMedia');
const Categories = require('../models/Categories');
const { checkVendorSubscriptionAndProductLimit } = require('../middleware/auth');
const xlsx = require('xlsx');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

async function getAllProducts(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const deleted = req.query.deleted !== undefined ? parseInt(req.query.deleted) : 0; // NEW

        const result = await Product.findAllWithPaginationAndSearch({ limit, offset, search, deleted }); // PASS IT

        res.json({
            products: result.products,
            total: result.total,
            page,
            pageSize: limit,
            totalPages: Math.ceil(result.total / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function getProductById(req, res) {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// New endpoints for special categories
async function getNewProducts(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const result = await Product.findNewProducts(limit, offset);
        if (Array.isArray(result)) {
            res.json({ products: result, total: result.length, page, pageSize: limit });
        } else {
            res.json({ ...result, page, pageSize: limit });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function getBestSellingProducts(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const result = await Product.findBestSellingProducts(limit, offset);
        if (Array.isArray(result)) {
            res.json({ products: result, total: result.length, page, pageSize: limit });
        } else {
            res.json({ ...result, page, pageSize: limit });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function getDealOfferProducts(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const result = await Product.findDealOfferProducts(limit, offset);
        if (Array.isArray(result)) {
            res.json({ products: result, total: result.length, page, pageSize: limit });
        } else {
            res.json({ ...result, page, pageSize: limit });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function getDiscountedProducts(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const result = await Product.findDiscountedProducts(limit, offset);
        if (Array.isArray(result)) {
            res.json({ products: result, total: result.length, page, pageSize: limit });
        } else {
            res.json({ ...result, page, pageSize: limit });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function createProduct(req, res) {
    // Log the HTTP method and full body for debugging
        // Guard: reject empty or undefined body
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'Empty request body' });
    }
    try {
        const { category_id, name, description, price, stock, image_url, is_new, is_best_selling, is_deal_offer, original_price, discount_percentage, discount_start_date, discount_end_date, vendor_id: bodyVendorId } = req.body;
        // Debug log for vendor_id and body
                // Determine vendor_id: admin can specify, vendor uses own id
        let vendor_id;
        if (req.user.roleId === 1) {
            // Admin must provide vendor_id
            if (!bodyVendorId) {
                return res.status(400).json({ error: 'Admin must specify vendor_id when creating a product.' });
            }
            vendor_id = bodyVendorId;
        } else {
            vendor_id = req.user.id;
        }
                const result = await Product.create({ 
            vendor_id, 
            category_id, 
            name, 
            description, 
            price, 
            stock, 
            image_url,
            is_new,
            is_best_selling,
            is_deal_offer,
            original_price,
            discount_percentage,
            discount_start_date,
            discount_end_date
        });
        res.status(201).json({ 
            message: result.message, 
            product_id: result.product_id 
        });
    } catch (error) {
        console.error('[createProduct ERROR]', error);
        // Only send error if not already sent
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server Error', details: error.message });
        }
    }
}

// Add this middleware to the createProduct endpoint
const createProductWithChecks = [checkVendorSubscriptionAndProductLimit, createProduct];

async function updateProduct(req, res) {
    try {
        const { id } = req.params;
        const { category_id, name, description, price, stock, image_url, is_new, is_best_selling, is_deal_offer, original_price, discount_percentage, discount_start_date, discount_end_date } = req.body;
        const userId = req.user.id;
        const userRole = req.user.roleId;
                const result = await Product.update(id, userId, { 
            category_id, 
            name, 
            description, 
            price, 
            stock, 
            image_url,
            is_new,
            is_best_selling,
            is_deal_offer,
            original_price,
            discount_percentage,
            discount_start_date,
            discount_end_date
        }, userRole);

        res.json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Admin endpoints for managing special categories and discounts
async function updateProductSpecialCategories(req, res) {
    try {
        const { id } = req.params;
        const { is_new, is_best_selling, is_deal_offer } = req.body;

        const result = await Product.updateSpecialCategories(id, {
            is_new,
            is_best_selling,
            is_deal_offer
        });

        res.json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function updateProductDiscount(req, res) {
    try {
        const { id } = req.params;
        const { original_price, discount_percentage, discount_start_date, discount_end_date } = req.body;

        const result = await Product.updateDiscount(id, {
            original_price,
            discount_percentage,
            discount_start_date,
            discount_end_date
        });

        res.json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function removeProductDiscount(req, res) {
    try {
        const { id } = req.params;

        const result = await Product.removeDiscount(id);

        res.json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function deleteProduct(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.roleId; // Fixed: use roleId instead of role_id

        // Admin can delete any product, vendors can only delete their own
        const result = await Product.delete(id, userId, userRole);
        res.json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function searchProducts(req, res) {
    try {
        const { q, category_id } = req.query;
        const products = await Product.search(q, category_id);
        res.json({ products });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function getProductsByCategory(req, res) {
    try {
        const { categoryId } = req.params;
        const products = await Product.findByCategory(categoryId);
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function getGiftProducts(req, res) {
    try {
        // Optionally add pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        let result = await Product.findGiftProducts();
        if (Array.isArray(result)) {
            result = result.slice(offset, offset + limit);
            res.json({ products: result, total: result.length, page, pageSize: limit });
        } else {
            res.json({ ...result, page, pageSize: limit });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function getProductDetails(req, res) {
    try {
        const { id } = req.params;
        const { pool } = require('../db/db');

        // Get basic product information
        const [productResult] = await pool.execute(`
            SELECT 
                p.*,
                c.name_en as category_name,
                c.name_ar as category_name_ar,
                u.name as vendor_name,
                u.email as vendor_email,
                u.phone as vendor_phone,
                u.role_id as vendor_role_id,
                vt.name_en as vendor_type_name,
                vt.commission_rate,
                vs.status as subscription_status,
                sp.name_en as package_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN users u ON p.vendor_id = u.user_id
            LEFT JOIN user_vendor_types uvt ON u.user_id = uvt.user_id
            LEFT JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
            LEFT JOIN vendor_subscriptions vs ON u.user_id = vs.user_id AND vs.status = 'active'
            LEFT JOIN subscription_packages sp ON vs.package_id = sp.package_id
            WHERE p.product_id = ?
        `, [id]);

        if (productResult.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = productResult[0];

        // Get product media
        const [mediaResult] = await pool.execute(`
            SELECT * FROM product_media 
            WHERE product_id = ? 
            ORDER BY created_at ASC
        `, [id]);

        // Get sales statistics
        const [salesStats] = await pool.execute(`
            SELECT 
                COUNT(DISTINCT oi.order_id) as total_orders,
                COUNT(oi.id) as total_quantity_sold,
                SUM(oi.total_price) as total_revenue,
                AVG(oi.total_price) as avg_order_value,
                COUNT(DISTINCT o.customer_id) as unique_customers
            FROM order_items oi
            LEFT JOIN orders o ON oi.order_id = o.order_id
            WHERE oi.product_id = ?
        `, [id]);

        // Get recent orders for this product
        const [recentOrders] = await pool.execute(`
            SELECT 
                oi.order_id,
                oi.total_price,
                oi.created_at as order_date,
                o.status as order_status,
                u.name as customer_name,
                u.email as customer_email
            FROM order_items oi
            LEFT JOIN orders o ON oi.order_id = o.order_id
            LEFT JOIN users u ON o.customer_id = u.user_id
            WHERE oi.product_id = ?
            ORDER BY oi.created_at DESC
            LIMIT 10
        `, [id]);

        // Get reviews for this product
        const [reviewsResult] = await pool.execute(`
            SELECT 
                r.*,
                u.name as customer_name,
                u.email as customer_email
            FROM reviews r
            LEFT JOIN users u ON r.customer_id = u.user_id
            WHERE r.product_id = ?
            ORDER BY r.created_at DESC
        `, [id]);

        // Get vendor performance for this product
        const [vendorPerformance] = await pool.execute(`
            SELECT 
                COUNT(DISTINCT p2.product_id) as total_vendor_products,
                SUM(CASE WHEN p2.is_new = 1 THEN 1 ELSE 0 END) as new_products,
                SUM(CASE WHEN p2.is_best_selling = 1 THEN 1 ELSE 0 END) as best_selling_products,
                SUM(CASE WHEN p2.is_deal_offer = 1 THEN 1 ELSE 0 END) as deal_products
            FROM products p2
            WHERE p2.vendor_id = ?
        `, [product.vendor_id]);

        // Calculate vendor role name
        let vendorRoleName = 'Unknown';
        switch (product.vendor_role_id) {
            case 1: vendorRoleName = 'Admin'; break;
            case 3: vendorRoleName = 'Premium Vendor'; break;
            case 4: vendorRoleName = 'Standard Vendor'; break;
            case 5: vendorRoleName = 'Basic Vendor'; break;
        }

        const productDetails = {
            ...product,
            vendor_role_name: vendorRoleName,
            media: mediaResult,
            sales_statistics: salesStats[0] || {
                total_orders: 0,
                total_quantity_sold: 0,
                total_revenue: 0,
                avg_order_value: 0,
                unique_customers: 0
            },
            recent_orders: recentOrders,
            reviews: reviewsResult,
            vendor_performance: vendorPerformance[0] || {
                total_vendor_products: 0,
                new_products: 0,
                best_selling_products: 0,
                deal_products: 0
            }
        };

        res.json({
            success: true,
            data: productDetails
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server Error', 
            details: error.message 
        });
    }
}

async function updateProductWithMedia(req, res) {
    try {
        const { id } = req.params;
        const { 
            category_id, 
            name, 
            description, 
            price, 
            stock, 
            image_url, 
            is_new, 
            is_best_selling, 
            is_deal_offer, 
            original_price, 
            discount_percentage, 
            discount_start_date, 
            discount_end_date,
            media 
        } = req.body;
        
        const userId = req.user.id;
        const userRole = req.user.roleId;
        
                        // Start a database transaction
        const { getConnection } = require('../db/db');
        const connection = await getConnection();
        await connection.beginTransaction();

        try {
            // Update the product
            const productData = { 
                category_id, 
                name, 
                description, 
                price, 
                stock, 
                image_url,
                is_new,
                is_best_selling,
                is_deal_offer,
                original_price,
                discount_percentage,
                discount_start_date,
                discount_end_date
            };

            const result = await Product.update(id, userId, productData, userRole);

            // Handle media operations if provided
            if (media) {
                const { toAdd = [], toDelete = [] } = media;

                // Delete media items
                if (toDelete.length > 0) {
                    for (const mediaId of toDelete) {
                        await ProductMedia.delete(mediaId);
                    }
                }

                // Add new media items
                if (toAdd.length > 0) {
                                        // Filter out the main image if present in toAdd (use correct property names)
                    const filteredMediaItems = toAdd.filter(item => {
                        if (item.type === 'image' && item.url === image_url) {
                            return false;
                        }
                        return true;
                    });
                                        if (filteredMediaItems.length > 0) {
                        const mediaItems = filteredMediaItems.map(item => ({
                            product_id: parseInt(id),
                            media_url: item.url,
                            media_type: item.type
                        }));
                        // Remove duplicates by media_url
                        const uniqueMediaItems = mediaItems.filter((item, idx, arr) =>
                            arr.findIndex(i => i.media_url === item.media_url && i.media_type === item.media_type) === idx
                        );
                                                await ProductMedia.bulkCreate(parseInt(id), uniqueMediaItems);
                    }
                }
            }

            // Commit the transaction
            await connection.commit();

            // Get updated product with media
            const updatedProduct = await Product.findById(id);
            const productMedia = await ProductMedia.findByProductId(parseInt(id));
            
            const transformedMedia = productMedia.map(item => ({
                id: item.media_id,
                product_id: item.product_id,
                url: item.media_url,
                type: item.media_type,
                created_at: item.created_at,
                updated_at: item.updated_at
            }));

            res.json({ 
                message: result.message,
                product: updatedProduct,
                media: transformedMedia
            });

        } catch (error) {
            // Rollback the transaction on error
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error updating product with media:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Export products to Excel
async function exportProductsToExcel(req, res) {
    try {
        const products = await Product.findAll();
        
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

        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=products-export.xlsx');
        res.setHeader('Content-Length', buffer.length);

        res.send(buffer);
    } catch (error) {
        console.error('Error exporting products:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Download Excel template
async function downloadExcelTemplate(req, res) {
    try {
        // Create template data with headers and example row
        const templateData = [
            {
                'Name': 'Example Product',
                'Description': 'This is an example product description',
                'Price': 99.99,
                'Stock': 100,
                'Category ID': 1,
                'Category Name': 'Electronics',
                'Vendor ID': 1,
                'Image URL': 'https://example.com/image.jpg',
                'Image URLs': 'https://example.com/image1.jpg, https://example.com/image2.png',
                'Video URLs': 'https://example.com/video1.mp4, https://example.com/video2.webm',
                'Is New': 'Yes',
                'Is Best Selling': 'No',
                'Is Deal Offer': 'No',
                'Original Price': '',
                'Discount Percentage': '',
                'Discount Start Date': '',
                'Discount End Date': ''
            }
        ];

        // Create workbook and worksheet
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(templateData);

        // Set column widths
        const columnWidths = [
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
        ];
        worksheet['!cols'] = columnWidths;

        // Add worksheet to workbook
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Products Template');

        // Generate buffer
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=products-template.xlsx');
        res.setHeader('Content-Length', buffer.length);

        res.send(buffer);
    } catch (error) {
        console.error('Error downloading template:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Import products from Excel
async function importProductsFromExcel(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ error: 'Excel file is empty' });
        }

        const results = {
            total: data.length,
            success: 0,
            failed: 0,
            errors: []
        };

        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 2; // +2 because Excel is 1-indexed and we have headers

            try {
                // Validate required fields
                if (!row['Name'] || !row['Price'] || !row['Category ID']) {
                    results.failed++;
                    results.errors.push(`Row ${rowNumber}: Missing required fields (Name, Price, Category ID)`);
                    continue;
                }

                // Prepare product data
                const productData = {
                    name: row['Name'].toString().trim(),
                    description: row['Description'] ? row['Description'].toString().trim() : '',
                    price: parseFloat(row['Price']) || 0,
                    stock: parseInt(row['Stock']) || 0,
                    category_id: parseInt(row['Category ID']) || 1,
                    vendor_id: parseInt(row['Vendor ID']), // Use current user as vendor
                    image_url: row['Image URL'] ? row['Image URL'].toString().trim() : null,
                    is_new: row['Is New'] && row['Is New'].toString().toLowerCase() === 'yes' ? 1 : 0,
                    is_best_selling: row['Is Best Selling'] && row['Is Best Selling'].toString().toLowerCase() === 'yes' ? 1 : 0,
                    is_deal_offer: row['Is Deal Offer'] && row['Is Deal Offer'].toString().toLowerCase() === 'yes' ? 1 : 0,
                    original_price: row['Original Price'] ? parseFloat(row['Original Price']) : null,
                    discount_percentage: row['Discount Percentage'] ? parseFloat(row['Discount Percentage']) : null,
                    discount_start_date: row['Discount Start Date'] ? row['Discount Start Date'].toString() : null,
                    discount_end_date: row['Discount End Date'] ? row['Discount End Date'].toString() : null
                };

                // Validate price
                if (productData.price <= 0) {
                    results.failed++;
                    results.errors.push(`Row ${rowNumber}: Price must be greater than 0`);
                    continue;
                }

                // Validate stock
                if (productData.stock < 0) {
                    results.failed++;
                    results.errors.push(`Row ${rowNumber}: Stock cannot be negative`);
                    continue;
                }

                // Create product
                const created = await Product.create(productData);
                const productId = created.product_id;

                // Process media columns
                const imageUrls = row['Image URLs'] ? row['Image URLs'].split(',').map(u => u.trim()).filter(Boolean) : [];
                const videoUrls = row['Video URLs'] ? row['Video URLs'].split(',').map(u => u.trim()).filter(Boolean) : [];
                const mediaItems = [
                    ...imageUrls.map(url => ({ product_id: productId, media_url: url, media_type: 'image' })),
                    ...videoUrls.map(url => ({ product_id: productId, media_url: url, media_type: 'video' }))
                ];
                if (mediaItems.length > 0) {
                    await ProductMedia.bulkCreate(productId, mediaItems);
                }

                results.success++;

            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${rowNumber}: ${error.message}`);
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json({
            message: 'Import completed',
            results
        });

    } catch (error) {
        console.error('Error importing products:', error);
        
        // Clean up uploaded file if it exists
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
            }
        }
        
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Create product with media files
async function createProductWithMedia(req, res) {
    try {
        const { 
            vendor_id: bodyVendorId,
            category_id, 
            name, 
            description, 
            price, 
            stock, 
            image_url, 
            is_new, 
            is_best_selling, 
            is_deal_offer, 
            original_price, 
            discount_percentage, 
            discount_start_date, 
            discount_end_date,
            media_urls = [] // Array of media URLs to add
        } = req.body;
        
        const userId = req.user.id;
        const userRole = req.user.roleId;
        
                // Determine vendor_id: admin can specify, vendor uses own id
        let vendor_id;
        if (userRole === 1) {
            // Admin must provide vendor_id
            if (!bodyVendorId) {
                return res.status(400).json({ error: 'Admin must specify vendor_id when creating a product.' });
            }
            vendor_id = bodyVendorId;
        } else {
            vendor_id = userId;
        }

        // Start a database transaction
        const { getConnection } = require('../db/db');
        const connection = await getConnection();
        await connection.beginTransaction();

        try {
            // Create the product
            const productData = { 
                vendor_id, // Use the determined vendor_id
                category_id, 
                name, 
                description, 
                price, 
                stock, 
                image_url,
                is_new,
                is_best_selling,
                is_deal_offer,
                original_price,
                discount_percentage,
                discount_start_date,
                discount_end_date
            };

            const result = await Product.create(productData);
            const productId = result.product_id;

            // Add media items if provided
            if (media_urls && media_urls.length > 0) {
                const mediaItems = media_urls.map(item => ({
                    product_id: productId,
                    media_url: item.url,
                    media_type: item.type
                }));
                await ProductMedia.bulkCreate(productId, mediaItems);
            }

            // Commit the transaction
            await connection.commit();

            // Get created product with media
            const createdProduct = await Product.findById(productId);
            const productMedia = await ProductMedia.findByProductId(productId);
            
            const transformedMedia = productMedia.map(item => ({
                id: item.media_id,
                product_id: item.product_id,
                url: item.media_url,
                type: item.media_type,
                created_at: item.created_at,
                updated_at: item.updated_at
            }));

            res.status(201).json({ 
                message: result.message,
                product: createdProduct,
                media: transformedMedia
            });

        } catch (error) {
            // Rollback the transaction on error
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error creating product with media:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

async function patchProduct(req, res) {
    try {
        const { id } = req.params;
        const updateFields = req.body;
        // Only allow updating the 'deleted' field for now
        if (typeof updateFields.deleted === 'undefined') {
            return res.status(400).json({ error: 'Only the deleted field can be patched.' });
        }
        // Update the product's deleted status
        const { pool } = require('../db/db');
        await pool.query('UPDATE products SET deleted = ? WHERE product_id = ?', [updateFields.deleted, id]);
        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// List products for a specific vendor (with pagination/search)
exports.getVendorProducts = async ({ vendorId, page = 1, limit = 20, search = '' }) => {
  const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = 'SELECT * FROM products WHERE vendor_id = ? AND deleted = 0';
  let params = [vendorId];
  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  const [products] = await pool.query(query, params);
  // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM products WHERE vendor_id = ? AND deleted = 0';
  let countParams = [vendorId];
  if (search) {
    countQuery += ' AND (name LIKE ? OR description LIKE ?)';
    countParams.push(`%${search}%`, `%${search}%`);
  }
  const [countRows] = await pool.query(countQuery, countParams);
  return { products, total: countRows[0]?.total || 0 };
};

// Create a product for a vendor
exports.createProductForVendor = async (product) => {
  // vendor_id must be set
  if (!product.vendor_id) throw new Error('vendor_id is required');
  const fields = Object.keys(product).filter(k => k !== 'product_id');
  const values = fields.map(k => product[k]);
  const placeholders = fields.map(() => '?').join(',');
  const sql = `INSERT INTO products (${fields.join(',')}) VALUES (${placeholders})`;
  const [result] = await pool.query(sql, values);
  return { product_id: result.insertId, ...product };
};

// Update a product for a vendor (must own the product)
exports.updateProductForVendor = async (productId, product, vendorId) => {
  // Only allow update if vendor owns the product
  const [rows] = await pool.query('SELECT * FROM products WHERE product_id = ? AND vendor_id = ? AND deleted = 0', [productId, vendorId]);
  if (!rows.length) throw new Error('Product not found or not owned by vendor');
  const fields = Object.keys(product).filter(k => k !== 'product_id');
  const values = fields.map(k => product[k]);
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const sql = `UPDATE products SET ${setClause} WHERE product_id = ? AND vendor_id = ?`;
  await pool.query(sql, [...values, productId, vendorId]);
  return { product_id: productId, ...product };
};

// Delete a product for a vendor (must own the product)
exports.deleteProductForVendor = async (productId, vendorId) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE product_id = ? AND vendor_id = ? AND deleted = 0', [productId, vendorId]);
  if (!rows.length) throw new Error('Product not found or not owned by vendor');
  await pool.query('DELETE FROM products WHERE product_id = ? AND vendor_id = ?', [productId, vendorId]);
  return { product_id: productId };
};

// Import products from Excel for a vendor (reuse existing logic, but set vendor_id)
exports.importProductsFromExcelForVendor = async (file, vendorId) => {
  // You may need to adapt this to your import logic
  // For now, just throw not implemented
  throw new Error('Import for vendor not implemented.');
};

// Export products to Excel for a vendor (reuse existing logic, but filter by vendor_id)
exports.exportProductsToExcelForVendor = async (vendorId) => {
  // You may need to adapt this to your export logic
  // For now, just throw not implemented
  throw new Error('Export for vendor not implemented.');
};

module.exports = { 
    getAllProducts, 
    getProductById, 
    createProduct: createProductWithChecks, 
    updateProduct, 
    deleteProduct, 
    searchProducts,
    getNewProducts,
    getBestSellingProducts,
    getDealOfferProducts,
    getDiscountedProducts,
    updateProductSpecialCategories,
    updateProductDiscount,
    removeProductDiscount,
    getProductsByCategory,
    getGiftProducts,
    getProductDetails,
    updateProductWithMedia,
    exportProductsToExcel,
    downloadExcelTemplate,
    importProductsFromExcel,
    upload,
    createProductWithMedia,
    patchProduct
};
