// Statistics model for comprehensive analytics

const { pool } = require('../db/db');

class Statistics {
    // Sales Statistics
    static async getSalesByMonth(year, month = null) {
        try {
            let query = `
                SELECT 
                    DATE_FORMAT(o.placed_at, '%Y-%m') as month,
                    COUNT(o.order_id) as total_orders,
                    SUM(o.total) as total_revenue,
                    AVG(o.total) as average_order_value,
                    COUNT(DISTINCT o.customer_id) as unique_customers
                FROM orders o
                WHERE o.status != 'cancelled'
                AND YEAR(o.placed_at) = ?
            `;
            
            const params = [year];
            
            if (month) {
                query += ' AND MONTH(o.placed_at) = ?';
                params.push(month);
            }
            
            query += `
                GROUP BY DATE_FORMAT(o.placed_at, '%Y-%m')
                ORDER BY month DESC
            `;
            
            const [rows] = await pool.query(query, params);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching sales by month: ${error.message}`);
        }
    }

    static async getSalesBySeller(vendorId = null, startDate = null, endDate = null) {
        try {
            let query = `
                SELECT 
                    u.user_id as vendor_id,
                    u.name as vendor_name,
                    COUNT(o.order_id) as total_orders,
                    SUM(oi.qty * oi.price) as total_revenue,
                    AVG(oi.qty * oi.price) as average_order_value,
                    COUNT(DISTINCT o.customer_id) as unique_customers,
                    SUM(oi.qty) as total_items_sold
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                JOIN products p ON oi.product_id = p.product_id
                JOIN users u ON p.vendor_id = u.user_id
                WHERE o.status != 'cancelled'
            `;
            
            const params = [];
            
            if (vendorId) {
                query += ' AND u.user_id = ?';
                params.push(vendorId);
            }
            
            if (startDate) {
                query += ' AND o.placed_at >= ?';
                params.push(startDate);
            }
            
            if (endDate) {
                query += ' AND o.placed_at <= ?';
                params.push(endDate);
            }
            
            query += `
                GROUP BY u.user_id, u.name
                ORDER BY total_revenue DESC
            `;
            
            const [rows] = await pool.query(query, params);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching sales by seller: ${error.message}`);
        }
    }

    static async getTopSellingProducts(limit = 10, period = '30') {
        try {
            const query = `
                SELECT 
                    p.product_id,
                    p.name as product_name,
                    p.price,
                    u.name as vendor_name,
                    SUM(oi.qty) as total_quantity_sold,
                    SUM(oi.qty * oi.price) as total_revenue,
                    COUNT(DISTINCT o.order_id) as order_count,
                    AVG(r.rating) as average_rating,
                    COUNT(r.review_id) as review_count
                FROM products p
                JOIN order_items oi ON p.product_id = oi.product_id
                JOIN orders o ON oi.order_id = o.order_id
                JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE o.status != 'cancelled'
                AND o.placed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY p.product_id, p.name, p.price, u.name
                ORDER BY total_quantity_sold DESC
                LIMIT ?
            `;
            
            const [rows] = await pool.query(query, [period, limit]);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching top selling products: ${error.message}`);
        }
    }

    static async getRevenueAnalytics(startDate = null, endDate = null) {
        try {
            let query = `
                SELECT 
                    DATE(o.placed_at) as date,
                    COUNT(o.order_id) as orders_count,
                    SUM(o.total) as daily_revenue,
                    AVG(o.total) as average_order_value,
                    COUNT(DISTINCT o.customer_id) as unique_customers
                FROM orders o
                WHERE o.status != 'cancelled'
            `;
            
            const params = [];
            
            if (startDate) {
                query += ' AND o.placed_at >= ?';
                params.push(startDate);
            }
            
            if (endDate) {
                query += ' AND o.placed_at <= ?';
                params.push(endDate);
            }
            
            query += `
                GROUP BY DATE(o.placed_at)
                ORDER BY date DESC
            `;
            
            const [rows] = await pool.query(query, params);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching revenue analytics: ${error.message}`);
        }
    }

    // Customer Analytics
    static async getCustomerAnalytics() {
        try {
            const query = `
                SELECT 
                    COUNT(DISTINCT u.user_id) as total_customers,
                    COUNT(DISTINCT CASE WHEN o.order_id IS NOT NULL THEN u.user_id END) as customers_with_orders,
                    COUNT(DISTINCT CASE WHEN o.placed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN u.user_id END) as active_customers_30d,
                    COUNT(DISTINCT CASE WHEN o.placed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN u.user_id END) as active_customers_7d,
                    AVG(CASE WHEN o.order_id IS NOT NULL THEN o.total END) as average_customer_spend,
                    COUNT(DISTINCT CASE WHEN o.total > 100 THEN u.user_id END) as high_value_customers
                FROM users u
                LEFT JOIN orders o ON u.user_id = o.customer_id AND o.status != 'cancelled'
                WHERE u.role_id = 3
            `;
            
            const [rows] = await pool.query(query);
            return rows[0];
        } catch (error) {
            throw new Error(`Error fetching customer analytics: ${error.message}`);
        }
    }

    static async getCustomerRetentionRate() {
        try {
            const query = `
                WITH customer_orders AS (
                    SELECT 
                        customer_id,
                        DATE_FORMAT(placed_at, '%Y-%m') as order_month,
                        COUNT(*) as orders_count
                    FROM orders
                    WHERE status != 'cancelled'
                    GROUP BY customer_id, DATE_FORMAT(placed_at, '%Y-%m')
                ),
                monthly_customers AS (
                    SELECT 
                        order_month,
                        COUNT(DISTINCT customer_id) as unique_customers
                    FROM customer_orders
                    GROUP BY order_month
                ),
                returning_customers AS (
                    SELECT 
                        co1.order_month,
                        COUNT(DISTINCT co1.customer_id) as returning_customers
                    FROM customer_orders co1
                    JOIN customer_orders co2 ON co1.customer_id = co2.customer_id
                    WHERE co1.order_month > co2.order_month
                    GROUP BY co1.order_month
                )
                SELECT 
                    mc.order_month,
                    mc.unique_customers,
                    COALESCE(rc.returning_customers, 0) as returning_customers,
                    CASE 
                        WHEN mc.unique_customers > 0 
                        THEN (COALESCE(rc.returning_customers, 0) / mc.unique_customers) * 100
                        ELSE 0
                    END as retention_rate
                FROM monthly_customers mc
                LEFT JOIN returning_customers rc ON mc.order_month = rc.order_month
                ORDER BY mc.order_month DESC
                LIMIT 12
            `;
            
            const [rows] = await pool.query(query);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching customer retention rate: ${error.message}`);
        }
    }

    // Product Performance Analytics
    static async getProductPerformanceAnalytics() {
        try {
            const query = `
                SELECT 
                    p.product_id,
                    p.name as product_name,
                    p.price,
                    p.stock,
                    u.name as vendor_name,
                    COUNT(oi.id) as times_ordered,
                    SUM(oi.qty) as total_quantity_sold,
                    SUM(oi.qty * oi.price) as total_revenue,
                    AVG(r.rating) as average_rating,
                    COUNT(r.review_id) as review_count,
                    CASE 
                        WHEN p.stock = 0 THEN 'Out of Stock'
                        WHEN p.stock <= 5 THEN 'Low Stock'
                        ELSE 'In Stock'
                    END as stock_status
                FROM products p
                JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN order_items oi ON p.product_id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status != 'cancelled'
                LEFT JOIN reviews r ON p.product_id = r.product_id
                GROUP BY p.product_id, p.name, p.price, p.stock, u.name
                ORDER BY total_revenue DESC
            `;
            
            const [rows] = await pool.query(query);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching product performance analytics: ${error.message}`);
        }
    }

    // Category Analytics
    static async getCategoryAnalytics() {
        try {
            const query = `
                SELECT 
                    c.category_id,
                    c.name_en as category_name,
                    c.name_ar as category_name_ar,
                    COUNT(p.product_id) as total_products,
                    COUNT(CASE WHEN p.stock > 0 THEN p.product_id END) as in_stock_products,
                    SUM(oi.qty) as total_quantity_sold,
                    SUM(oi.qty * oi.price) as total_revenue,
                    AVG(p.price) as average_product_price,
                    COUNT(DISTINCT o.customer_id) as unique_customers
                FROM categories c
                LEFT JOIN products p ON c.category_id = p.category_id AND p.deleted = 0
                LEFT JOIN order_items oi ON p.product_id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status != 'cancelled'
                GROUP BY c.category_id, c.name_en, c.name_ar
                ORDER BY total_revenue DESC
            `;
            
            const [rows] = await pool.query(query);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching category analytics: ${error.message}`);
        }
    }

    // Dashboard Statistics
    static async getDashboardStats() {
        try {
            const query = `
                SELECT 
                    -- Total Revenue
                    (SELECT SUM(total) FROM orders WHERE status = 'delivered') as total_revenue,
                    
                    -- Today's Revenue
                    (SELECT SUM(total) FROM orders WHERE status = 'delivered' AND DATE(placed_at) = CURDATE()) as today_revenue,
                    
                    -- This Month's Revenue
                    (SELECT SUM(total) FROM orders WHERE status = 'delivered' AND DATE_FORMAT(placed_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')) as month_revenue,
                    
                    -- Total Orders
                    (SELECT COUNT(*) FROM orders WHERE status = 'delivered') as total_orders,
                    
                    -- Today's Orders
                    (SELECT COUNT(*) FROM orders WHERE status = 'delivered' AND DATE(placed_at) = CURDATE()) as today_orders,
                    
                    -- This Month's Orders
                    (SELECT COUNT(*) FROM orders WHERE status = 'delivered' AND DATE_FORMAT(placed_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')) as month_orders,
                    
                    -- Total Customers
                    (SELECT COUNT(*) FROM users WHERE role_id = 3) as total_customers,
                    
                    -- Total Products
                    (SELECT COUNT(*) FROM products WHERE deleted = 0) as total_products,
                    
                    -- Products Out of Stock
                    (SELECT COUNT(*) FROM products WHERE stock = 0 AND deleted = 0) as out_of_stock_products,
                    
                    -- Pending Orders
                    (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
                    
                    -- Average Order Value
                    (SELECT AVG(total) FROM orders WHERE status = 'delivered') as average_order_value
            `;
            
            const [rows] = await pool.query(query);
            return rows[0];
        } catch (error) {
            throw new Error(`Error fetching dashboard stats: ${error.message}`);
        }
    }

    // Dashboard Summary Statistics
    static async getDashboardSummary() {
        try {
            const query = `
                SELECT 
                    -- Total Revenue
                    (SELECT SUM(total) FROM orders WHERE status = 'delivered') as total_revenue,
                    
                    -- Today's Revenue
                    (SELECT SUM(total) FROM orders WHERE status = 'delivered' AND DATE(placed_at) = CURDATE()) as today_revenue,
                    
                    -- This Month's Revenue
                    (SELECT SUM(total) FROM orders WHERE status = 'delivered' AND DATE_FORMAT(placed_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')) as month_revenue,
                    
                    -- Total Orders
                    (SELECT COUNT(*) FROM orders WHERE status = 'delivered') as total_orders,
                    
                    -- Today's Orders
                    (SELECT COUNT(*) FROM orders WHERE status = 'delivered' AND DATE(placed_at) = CURDATE()) as today_orders,
                    
                    -- This Month's Orders
                    (SELECT COUNT(*) FROM orders WHERE status = 'delivered' AND DATE_FORMAT(placed_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')) as month_orders,
                    
                    -- Total Customers
                    (SELECT COUNT(*) FROM users WHERE role_id = 3) as total_customers,
                    
                    -- Total Products
                    (SELECT COUNT(*) FROM products WHERE deleted = 0) as total_products,
                    
                    -- Products Out of Stock
                    (SELECT COUNT(*) FROM products WHERE stock = 0 AND deleted = 0) as out_of_stock_products,
                    
                    -- Pending Orders
                    (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
                    
                    -- Average Order Value
                    (SELECT AVG(total) FROM orders WHERE status = 'delivered') as average_order_value
            `;
            
            const [rows] = await pool.query(query);
            return rows[0];
        } catch (error) {
            throw new Error(`Error fetching dashboard summary: ${error.message}`);
        }
    }

    // Real-time Analytics
    static async getRealTimeStats() {
        try {
            const query = `
                SELECT 
                    -- Orders in last 24 hours
                    (SELECT COUNT(*) FROM orders WHERE placed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as orders_24h,
                    
                    -- Revenue in last 24 hours
                    (SELECT SUM(total) FROM orders WHERE placed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND status != 'cancelled') as revenue_24h,
                    
                    -- New customers in last 24 hours (using a default value since users table doesn't have created_at)
                    (SELECT COUNT(*) FROM users WHERE role_id = 3) as new_customers_24h,
                    
                    -- Active users (customers with orders in last 7 days)
                    (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE placed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND status != 'cancelled') as active_customers_7d
            `;
            
            const [rows] = await pool.query(query);
            return rows[0];
        } catch (error) {
            throw new Error(`Error fetching real-time stats: ${error.message}`);
        }
    }

    // Vendor Performance Comparison
    static async getVendorPerformanceComparison() {
        try {
            const query = `
                SELECT 
                    u.user_id,
                    u.name as vendor_name,
                    COUNT(p.product_id) as total_products,
                    COALESCE(SUM(oi.qty), 0) as total_items_sold,
                    COALESCE(SUM(oi.qty * oi.price), 0.0) as total_revenue,
                    COALESCE(AVG(r.rating), 0.0) as average_rating,
                    COALESCE(COUNT(r.review_id), 0) as total_reviews,
                    COALESCE(COUNT(DISTINCT o.customer_id), 0) as unique_customers,
                    CASE 
                        WHEN COALESCE(SUM(oi.qty * oi.price), 0.0) > 10000 THEN 'High Performer'
                        WHEN COALESCE(SUM(oi.qty * oi.price), 0.0) > 5000 THEN 'Medium Performer'
                        ELSE 'Low Performer'
                    END as performance_category
                FROM users u
                LEFT JOIN products p ON u.user_id = p.vendor_id AND p.deleted = 0
                LEFT JOIN order_items oi ON p.product_id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status != 'cancelled'
                LEFT JOIN reviews r ON p.product_id = r.product_id
                WHERE u.role_id IN (3, 4, 5)
                GROUP BY u.user_id, u.name
                ORDER BY total_revenue DESC
            `;
            
            const [rows] = await pool.query(query);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching vendor performance comparison: ${error.message}`);
        }
    }

    // Vendor Monitoring Stats (for admin dashboard)
    static async getVendorMonitoringStats(page = 1, limit = 20, search = '') {
        try {
            const offset = (page - 1) * limit;
            let whereClause = 'WHERE u.role_id IN (3, 4, 5)';
            let params = [];
            if (search) {
                whereClause += ' AND u.name LIKE ?';
                params.push(`%${search}%`);
            }
            // If limit is 0, fetch all data (for export)
            const dataQuery = `
                SELECT 
                    u.user_id,
                    u.name as vendor_name,
                    COUNT(DISTINCT p.product_id) as total_products,
                    COALESCE(SUM(oi.qty), 0) as total_items_sold,
                    COALESCE(SUM(oi.qty * oi.price), 0.0) as total_sales,
                    COALESCE(SUM(vp.commission_amount), 0.0) as total_commission,
                    COALESCE(SUM(vp.net_amount), 0.0) as net_amount,
                    COALESCE(COUNT(DISTINCT o.order_id), 0) as total_orders,
                    COALESCE(AVG(r.rating), 0.0) as average_rating,
                    COALESCE(COUNT(r.review_id), 0) as total_reviews,
                    COALESCE(COUNT(DISTINCT o.customer_id), 0) as unique_customers
                FROM users u
                LEFT JOIN products p ON u.user_id = p.vendor_id AND p.deleted = 0
                LEFT JOIN order_items oi ON p.product_id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status != 'cancelled'
                LEFT JOIN reviews r ON p.product_id = r.product_id
                LEFT JOIN vendor_payments vp ON u.user_id = vp.vendor_id
                ${whereClause}
                GROUP BY u.user_id, u.name
                ORDER BY total_sales DESC
                ${limit > 0 ? 'LIMIT ? OFFSET ?' : ''}
            `;
            if (limit > 0) params.push(limit, offset);
            const [rows] = await pool.query(dataQuery, params);

            // Get total count for pagination
            let countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
            const [countRows] = await pool.query(countQuery, search ? [`%${search}%`] : []);
            const total = countRows[0]?.total || 0;

            return { rows, total };
        } catch (error) {
            throw new Error(`Error fetching vendor monitoring stats: ${error.message}`);
        }
    }
}

module.exports = Statistics; 