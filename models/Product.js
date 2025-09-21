// Product model 

const { pool } = require('../db/db');

class Product {
    constructor(data) {
        this.product_id = data.product_id;
        this.vendor_id = data.vendor_id;
        this.category_id = data.category_id;
        this.name = data.name;
        this.description = data.description;
        this.price = data.price;
        this.stock = data.stock;
        this.image_url = data.image_url;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.category_name = data.category_name;
        this.vendor_name = data.vendor_name;
        this.average_rating = data.average_rating || 0;
        this.review_count = data.review_count || 0;
        // New fields for special categories and discounts
        this.is_new = data.is_new || false;
        this.is_best_selling = data.is_best_selling || false;
        this.is_deal_offer = data.is_deal_offer || false;
        this.original_price = data.original_price;
        this.discount_percentage = data.discount_percentage;
        this.discount_start_date = data.discount_start_date;
        this.discount_end_date = data.discount_end_date;
        this.final_price = data.final_price || data.price;
        this.has_active_discount = data.has_active_discount || false;
        this.is_gift = data.is_gift || false;
    }

    // Static methods for database operations
    static async findAll() {
        try {
            const [rows] = await pool.query(`
                SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching products: ${error.message}`);
        }
    }

    static async findAllWithPagination(limit = 20, offset = 0) {
        try {
            // Get total count
            const [countResult] = await pool.query(`
                SELECT COUNT(*) as total
                FROM products p 
                WHERE p.deleted = 0
            `);
            const total = countResult[0].total;

            // Get paginated data
            const [rows] = await pool.query(`
                SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
            
            return {
                products: rows,
                total: total
            };
        } catch (error) {
            throw new Error(`Error fetching products with pagination: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id 
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.product_id = ? AND p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
            `, [id]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching product: ${error.message}`);
        }
    }

    static async findByVendor(vendorId) {
        try {
            const [rows] = await pool.query(`
                SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id 
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.vendor_id = ? AND p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
            `, [vendorId]);
            
            return rows;
        } catch (error) {
            throw new Error(`Error fetching vendor products: ${error.message}`);
        }
    }

    static async findByCategory(categoryId) {
        try {
            const [rows] = await pool.query(`
                SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id 
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.category_id = ? AND p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
            `, [categoryId]);
            
            return rows;
        } catch (error) {
            throw new Error(`Error fetching category products: ${error.message}`);
        }
    }

    static async create(productData) {
        try {
            const { vendor_id, category_id, name, description, price, stock, image_url, is_new, is_best_selling, is_deal_offer, original_price, discount_percentage, discount_start_date, discount_end_date } = productData;
            
            // Validate required fields
            if (!name || !price) {
                throw new Error('Name and price are required');
            }

            if (price <= 0) {
                throw new Error('Price must be greater than 0');
            }

            if (stock !== undefined && stock < 0) {
                throw new Error('Stock cannot be negative');
            }

            // Validate discount fields
            if (discount_percentage !== undefined && (discount_percentage < 0 || discount_percentage > 100)) {
                throw new Error('Discount percentage must be between 0 and 100');
            }

            // Only require discount start date if discount percentage is greater than 0
            if (discount_percentage && discount_percentage > 0 && !discount_start_date) {
                throw new Error('Discount start date is required when discount percentage is set');
            }
            
            const [result] = await pool.query(
                'INSERT INTO products (vendor_id, category_id, name, description, price, stock, image_url, is_new, is_best_selling, is_deal_offer, original_price, discount_percentage, discount_start_date, discount_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [vendor_id, category_id, name, description, price, stock, image_url, is_new || false, is_best_selling || false, is_deal_offer || false, original_price, discount_percentage, discount_start_date, discount_end_date]
            );
            
            return { product_id: result.insertId, message: 'Product created successfully' };
        } catch (error) {
            throw new Error(`Error creating product: ${error.message}`);
        }
    }

    static async update(id, userId, updateData, userRole = null) {
        try {
            const { category_id, name, description, price, stock, image_url, is_new, is_best_selling, is_deal_offer, original_price, discount_percentage, discount_start_date, discount_end_date } = updateData;
            
            // Check if product exists and is not deleted
            const [existing] = await pool.query(
                'SELECT * FROM products WHERE product_id = ? AND deleted = 0',
                [id]
            );

            if (existing.length === 0) {
                throw new Error('Product not found');
            }

            const product = existing[0];

            // Check permissions: admin and product manager can update any product, vendor can only update their own
            if (userRole !== 1 && userRole !== 11 && product.vendor_id !== userId) {
                throw new Error('Access denied: You can only update your own products');
            }

            // Validate price if provided
            if (price !== undefined && price <= 0) {
                throw new Error('Price must be greater than 0');
            }

            // Validate stock if provided
            if (stock !== undefined && stock < 0) {
                throw new Error('Stock cannot be negative');
            }

            // Validate discount fields
            if (discount_percentage !== undefined && (discount_percentage < 0 || discount_percentage > 100)) {
                throw new Error('Discount percentage must be between 0 and 100');
            }

            // Only require discount start date if discount percentage is greater than 0
            if (discount_percentage && discount_percentage > 0 && !discount_start_date) {
                throw new Error('Discount start date is required when discount percentage is set');
            }

            await pool.query(
                'UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, stock = ?, image_url = ?, is_new = ?, is_best_selling = ?, is_deal_offer = ?, original_price = ?, discount_percentage = ?, discount_start_date = ?, discount_end_date = ? WHERE product_id = ?',
                [category_id, name, description, price, stock, image_url, is_new, is_best_selling, is_deal_offer, original_price, discount_percentage, discount_start_date, discount_end_date, id]
            );

            return { message: 'Product updated successfully' };
        } catch (error) {
            throw new Error(`Error updating product: ${error.message}`);
        }
    }

    static async delete(id, userId, userRole = null) {
        try {
            // Check if product exists and is not already deleted
            const [existing] = await pool.query(
                'SELECT * FROM products WHERE product_id = ? AND deleted = 0',
                [id]
            );

            if (existing.length === 0) {
                throw new Error('Product not found or already deleted');
            }

            const product = existing[0];

            // Admin (role_id = 1) and Product Manager (role_id = 11) can delete any product
            // Vendors can only delete their own products
            if (userRole !== 1 && userRole !== 11 && product.vendor_id !== userId) {
                throw new Error('Access denied: You can only delete your own products');
            }

            // Delete all product media files and database records to save space
            const [mediaFiles] = await pool.query(
                'SELECT media_url FROM product_media WHERE product_id = ?',
                [id]
            );

            // Delete media files from filesystem (only for local files, not URLs)
            const fs = require('fs');
            const path = require('path');
            
            for (const media of mediaFiles) {
                if (media.media_url && !media.media_url.startsWith('http')) {
                    // Only delete local files, not external URLs
                    const filePath = path.join(__dirname, '..', 'uploads', media.media_url);
                    try {
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                                                    }
                    } catch (fileError) {
                        console.error(`Error deleting file ${filePath}:`, fileError.message);
                    }
                }
            }

            // Delete product media database records
            await pool.query('DELETE FROM product_media WHERE product_id = ?', [id]);

            // Soft delete the product (keep order items and reviews for history)
            await pool.query('UPDATE products SET deleted = 1 WHERE product_id = ?', [id]);
            
            return { message: 'Product deleted successfully' };
        } catch (error) {
            throw new Error(`Error deleting product: ${error.message}`);
        }
    }

    static async updateStock(id, quantity) {
        try {
            const [result] = await pool.query(
                'UPDATE products SET stock = stock - ? WHERE product_id = ? AND stock >= ? AND deleted = 0',
                [quantity, id, quantity]
            );

            if (result.affectedRows === 0) {
                throw new Error('Insufficient stock or product not found');
            }

            return { message: 'Stock updated successfully' };
        } catch (error) {
            throw new Error(`Error updating stock: ${error.message}`);
        }
    }

    static async search(query, categoryId = null) {
        try {
            const searchTerm = `%${query}%`;
            let sql = `
                SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE (p.name LIKE ? OR p.description LIKE ?) AND p.deleted = 0
            `;
            
            let params = [searchTerm, searchTerm];
            
            if (categoryId && categoryId !== 'all') {
                const categoryIdInt = parseInt(categoryId);
                if (!isNaN(categoryIdInt)) {
                    sql += ' AND p.category_id = ?';
                    params.push(categoryIdInt);
                                    }
            }
            
            sql += `
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
            `;
            
                                    const [rows] = await pool.query(sql, params);
                        return rows;
        } catch (error) {
            throw new Error(`Error searching products: ${error.message}`);
        }
    }

    // New methods for special categories
    static async findNewProducts(limit = 10, offset = 0) {
        try {
            const [rows] = await pool.query(`
                SELECT SQL_CALC_FOUND_ROWS p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.is_new = TRUE AND p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
            const [[{ total }]] = await pool.query('SELECT FOUND_ROWS() as total');
            return { products: rows, total };
        } catch (error) {
            throw new Error(`Error fetching new products: ${error.message}`);
        }
    }

    static async findBestSellingProducts(limit = 10, offset = 0) {
        try {
            const [rows] = await pool.query(`
                SELECT SQL_CALC_FOUND_ROWS p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.is_best_selling = TRUE AND p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
                ORDER BY average_rating DESC, review_count DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
            const [[{ total }]] = await pool.query('SELECT FOUND_ROWS() as total');
            return { products: rows, total };
        } catch (error) {
            throw new Error(`Error fetching best selling products: ${error.message}`);
        }
    }

    static async findDealOfferProducts(limit = 10, offset = 0) {
        try {
            const [rows] = await pool.query(`
                SELECT SQL_CALC_FOUND_ROWS p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.is_deal_offer = TRUE AND p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
                ORDER BY p.discount_percentage DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
            const [[{ total }]] = await pool.query('SELECT FOUND_ROWS() as total');
            return { products: rows, total };
        } catch (error) {
            throw new Error(`Error fetching deal offer products: ${error.message}`);
        }
    }

    static async findDiscountedProducts(limit = 10, offset = 0) {
        try {
            const [rows] = await pool.query(`
                SELECT SQL_CALC_FOUND_ROWS p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.discount_percentage IS NOT NULL 
                AND p.discount_start_date <= NOW() 
                AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                AND p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
                ORDER BY p.discount_percentage DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
            const [[{ total }]] = await pool.query('SELECT FOUND_ROWS() as total');
            return { products: rows, total };
        } catch (error) {
            throw new Error(`Error fetching discounted products: ${error.message}`);
        }
    }

    // Admin methods for managing special categories and discounts
    static async updateSpecialCategories(productId, categories) {
        try {
            const { is_new, is_best_selling, is_deal_offer } = categories;
            
            await pool.query(
                'UPDATE products SET is_new = ?, is_best_selling = ?, is_deal_offer = ? WHERE product_id = ? AND deleted = 0',
                [is_new || false, is_best_selling || false, is_deal_offer || false, productId]
            );

            return { message: 'Product special categories updated successfully' };
        } catch (error) {
            throw new Error(`Error updating product special categories: ${error.message}`);
        }
    }

    static async updateDiscount(productId, discountData) {
        try {
            const { original_price, discount_percentage, discount_start_date, discount_end_date } = discountData;
            
            // Validate discount fields
            if (discount_percentage !== undefined && (discount_percentage < 0 || discount_percentage > 100)) {
                throw new Error('Discount percentage must be between 0 and 100');
            }

            // Only require discount start date if discount percentage is greater than 0
            if (discount_percentage && discount_percentage > 0 && !discount_start_date) {
                throw new Error('Discount start date is required when discount percentage is set');
            }

            await pool.query(
                'UPDATE products SET original_price = ?, discount_percentage = ?, discount_start_date = ?, discount_end_date = ? WHERE product_id = ? AND deleted = 0',
                [original_price, discount_percentage, discount_start_date, discount_end_date, productId]
            );

            return { message: 'Product discount updated successfully' };
        } catch (error) {
            throw new Error(`Error updating product discount: ${error.message}`);
        }
    }

    static async removeDiscount(productId) {
        try {
            await pool.query(
                'UPDATE products SET original_price = NULL, discount_percentage = NULL, discount_start_date = NULL, discount_end_date = NULL WHERE product_id = ? AND deleted = 0',
                [productId]
            );

            return { message: 'Product discount removed successfully' };
        } catch (error) {
            throw new Error(`Error removing product discount: ${error.message}`);
        }
    }

    // Instance methods
    toJSON() {
        return {
            product_id: this.product_id,
            vendor_id: this.vendor_id,
            category_id: this.category_id,
            name: this.name,
            description: this.description,
            price: this.price,
            stock: this.stock,
            image_url: this.image_url,
            category_name: this.category_name,
            vendor_name: this.vendor_name,
            created_at: this.created_at,
            updated_at: this.updated_at,
            average_rating: this.average_rating,
            review_count: this.review_count,
            // New fields
            is_new: this.is_new,
            is_best_selling: this.is_best_selling,
            is_deal_offer: this.is_deal_offer,
            original_price: this.original_price,
            discount_percentage: this.discount_percentage,
            discount_start_date: this.discount_start_date,
            discount_end_date: this.discount_end_date,
            final_price: this.final_price,
            has_active_discount: this.has_active_discount,
            is_gift: this.is_gift
        };
    }

    static async findGiftProducts() {
        try {
            const [rows] = await pool.query(`
                SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE p.is_gift = TRUE AND p.deleted = 0
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.is_gift, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching gift products: ${error.message}`);
        }
    }

    // Count products by vendor for product limit enforcement
    static async countByVendorId(vendorId) {
        try {
            const [rows] = await pool.query('SELECT COUNT(*) as count FROM products WHERE vendor_id = ? AND deleted = 0', [vendorId]);
            return rows[0].count;
        } catch (error) {
            throw new Error(`Error counting products for vendor: ${error.message}`);
        }
    }

    static async findAllWithPaginationAndSearch({ limit = 20, offset = 0, search = '', deleted = 0 }) {
        try {
            let whereClause = 'WHERE p.deleted = ?';
            let params = [deleted];
            if (search) {
                whereClause += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.product_id LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            // Get total count
            const [countResult] = await pool.query(`
                SELECT COUNT(*) as total
                FROM products p 
                ${whereClause}
            `, params);
            const total = countResult[0].total;

            // Get paginated data
            const [rows] = await pool.query(`
                SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar, u.name as vendor_name,
                       COALESCE(AVG(r.rating), 0) as average_rating,
                       COUNT(r.review_id) as review_count,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN p.price * (1 - p.discount_percentage / 100)
                           ELSE p.price
                       END as final_price,
                       CASE 
                           WHEN p.discount_percentage IS NOT NULL 
                           AND p.discount_start_date <= NOW() 
                           AND (p.discount_end_date IS NULL OR p.discount_end_date >= NOW())
                           THEN TRUE
                           ELSE FALSE
                       END as has_active_discount
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                ${whereClause}
                GROUP BY p.product_id, p.vendor_id, p.category_id, p.name, p.description, p.price, p.stock, p.image_url, c.name_en, c.name_ar, u.name, p.is_new, p.is_best_selling, p.is_deal_offer, p.original_price, p.discount_percentage, p.discount_start_date, p.discount_end_date, p.created_at, p.is_gift
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);
            
            return {
                products: rows,
                total: total
            };
        } catch (error) {
            throw new Error(`Error fetching products with pagination and search: ${error.message}`);
        }
    }
}

module.exports = Product; 