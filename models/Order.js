// Order model 

const { pool } = require('../db/db');

class Order {
    constructor(data) {
        this.order_id = data.order_id;
        this.customer_id = data.customer_id;
        this.total = data.total;
        this.status = data.status;
        this.address_id = data.address_id;
        this.payment_id = data.payment_id ?? null;
        this.customer_name = data.customer_name;
        this.customer_phone = data.customer_phone;
        this.delivery_address = data.delivery_address;
        this.delivery_zone_id = data.delivery_zone_id ?? null;
        this.delivery_notes = data.delivery_notes ?? null;
        this.payment_status = data.payment_status;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.placed_at = data.placed_at;
        this.payment_method = data.payment_method ?? null;
        this.delivery_id = data.delivery_id ?? null;
    }

    // Static methods for database operations
    static async findAll() {
        try {
            const [rows] = await pool.query(`
                SELECT o.*, u.name as customer_name, u.phone as customer_phone, da.address as delivery_address, 
                       p.status as payment_status, p.method as payment_method, p.payment_id, 
                       o.delivery_zone_id, dz.name_en as delivery_zone_name, dz.delivery_fee,
                       dp.vehicle_type, dp.vehicle_number, u_dp.name as delivery_person_name
                FROM orders o
                LEFT JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
                LEFT JOIN delivery_personnel dp ON o.delivery_id = dp.delivery_id
                LEFT JOIN users u_dp ON dp.user_id = u_dp.user_id
                ORDER BY o.placed_at DESC
            `);
            
            return rows.map(row => new Order(row));
        } catch (error) {
            throw new Error(`Error fetching orders: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT o.*, u.name as customer_name, u.phone as customer_phone, da.address as delivery_address, 
                       p.status as payment_status, p.method as payment_method, p.payment_id, 
                       o.delivery_zone_id, dz.name_en as delivery_zone_name, dz.delivery_fee,
                       dp.vehicle_type, dp.vehicle_number, u_dp.name as delivery_person_name,
                       o.delivery_notes
                FROM orders o
                LEFT JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
                LEFT JOIN delivery_personnel dp ON o.delivery_id = dp.delivery_id
                LEFT JOIN users u_dp ON dp.user_id = u_dp.user_id
                WHERE o.order_id = ?
            `, [id]);
            
            return rows.length > 0 ? new Order(rows[0]) : null;
        } catch (error) {
            throw new Error(`Error fetching order: ${error.message}`);
        }
    }

    static async findByCustomer(customerId) {
        try {
            const [rows] = await pool.query(`
                SELECT o.*, p.method as payment_method, p.payment_id, u.name as customer_name, u.phone as customer_phone, da.address as delivery_address, 
                       p.status as payment_status, o.delivery_zone_id, dz.name_en as delivery_zone_name, dz.delivery_fee,
                       dp.vehicle_type, dp.vehicle_number, u_dp.name as delivery_person_name
                FROM orders o
                LEFT JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
                LEFT JOIN delivery_personnel dp ON o.delivery_id = dp.delivery_id
                LEFT JOIN users u_dp ON dp.user_id = u_dp.user_id
                WHERE o.customer_id = ?
                ORDER BY o.placed_at DESC
            `, [customerId]);
            
            return rows.map(row => new Order(row));
        } catch (error) {
            throw new Error(`Error fetching customer orders: ${error.message}`);
        }
    }

    static async findByProduct(productId) {
        try {
            const [rows] = await pool.query(`
                SELECT o.*, p.method as payment_method, p.payment_id, u.name as customer_name, da.address as delivery_address, p.status as payment_status
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                WHERE oi.product_id = ?
                ORDER BY o.created_at DESC
            `, [productId]);
            
            return rows;
        } catch (error) {
            throw new Error(`Error fetching orders by product: ${error.message}`);
        }
    }

    static async findByStatus(status) {
        try {
            const [rows] = await pool.query(`
                SELECT o.*, p.method as payment_method, p.payment_id, u.name as customer_name, da.address as delivery_address, p.status as payment_status
                FROM orders o
                LEFT JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                WHERE o.status = ?
                ORDER BY o.created_at DESC
            `, [status]);
            
            return rows;
        } catch (error) {
            throw new Error(`Error fetching orders by status: ${error.message}`);
        }
    }

    static async create(orderData) {
        try {
            const { customer_id, vendor_id, total, address_id, delivery_zone_id, delivery_fee, payment_method, split_group_id, confirmation_status, coupon_id } = orderData;
            
            // Validate required fields
            if (!customer_id || !total) {
                throw new Error('Customer ID and total are required');
            }

            if (total <= 0) {
                throw new Error('Total must be greater than 0');
            }
            
            const [result] = await pool.query(
                'INSERT INTO orders (customer_id, vendor_id, total, status, address_id, delivery_zone_id, delivery_fee, split_group_id, confirmation_status, coupon_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [customer_id, vendor_id, total, 'pending', address_id, delivery_zone_id || null, delivery_fee || null, split_group_id, confirmation_status, coupon_id || null]
            );
            
            const order_id = result.insertId;
            
            // If payment method is provided, create payment record
            if (payment_method) {
                await pool.query(
                    'INSERT INTO payments (order_id, amount, method, status, processed_at) VALUES (?, ?, ?, ?, NOW())',
                    [order_id, total, payment_method, 'pending']
                );
            }
            
            return { order_id, message: 'Order created successfully' };
        } catch (error) {
            throw new Error(`Error creating order: ${error.message}`);
        }
    }

    static async updateStatus(id, status) {
        try {
            const validStatuses = ['pending', 'processing', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'returned'];
            
            if (!validStatuses.includes(status)) {
                throw new Error('Invalid order status');
            }

            const [result] = await pool.query(
                'UPDATE orders SET status = ? WHERE order_id = ?',
                [status, id]
            );

            if (result.affectedRows === 0) {
                throw new Error('Order not found');
            }

            return { message: 'Order status updated successfully' };
        } catch (error) {
            throw new Error(`Error updating order status: ${error.message}`);
        }
    }

    static async cancel(id) {
                // Cancel an order and unreserve stock
        // Do not allow cancelling delivered orders
        const [existing] = await pool.query(
            'SELECT status FROM orders WHERE order_id = ?',
            [id]
        );
        
                if (existing.length === 0) {
                        throw new Error('Order not found');
        }
        if (existing[0].status === 'delivered') {
                        throw new Error('Cannot cancel delivered order');
        }
        
                // Set status to cancelled
        await this.updateStatus(id, 'cancelled');
                // Unreserve stock
        await this.unreserveStock(id);
                return { message: 'Order cancelled and stock unreserved' };
    }

    static async unreserveStock(orderId) {
        // Add back product quantities for a cancelled order
        const items = await this.getOrderItems(orderId);
        for (const item of items) {
            await pool.query(
                'UPDATE products SET stock = stock + ? WHERE product_id = ?',
                [item.qty || item.quantity, item.product_id]
            );
        }
    }

    static async delete(id) {
        try {
            // Check if order exists and is cancellable
            const [existing] = await pool.query(
                'SELECT status FROM orders WHERE order_id = ?',
                [id]
            );

            if (existing.length === 0) {
                throw new Error('Order not found');
            }

            if (existing[0].status === 'delivered') {
                throw new Error('Cannot delete delivered order');
            }

            // Unreserve stock before deleting
            await this.unreserveStock(id);

            const [result] = await pool.query('DELETE FROM orders WHERE order_id = ?', [id]);

            if (result.affectedRows === 0) {
                throw new Error('Order not found');
            }

            return { message: 'Order deleted successfully' };
        } catch (error) {
            throw new Error(`Error deleting order: ${error.message}`);
        }
    }

    static async getOrderItems(orderId) {
        try {
            const [rows] = await pool.query(`
                SELECT oi.*, p.name as product_name, p.price as product_price, 
                       p.vendor_id, u.name as vendor_name,
                       dt.status as delivery_status,
                       COALESCE(oi.price, p.price) as price,
                       COALESCE(oi.total_price, (oi.qty * COALESCE(oi.price, p.price))) as total_price,
                       oi.qty as quantity
                FROM order_items oi
                JOIN products p ON oi.product_id = p.product_id
                JOIN users u ON p.vendor_id = u.user_id
                LEFT JOIN delivery_tracking dt ON dt.order_id = oi.order_id AND dt.delivery_id = (
                  SELECT delivery_id FROM delivery_assignments WHERE order_id = oi.order_id LIMIT 1
                )
                WHERE oi.order_id = ?
            `, [orderId]);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching order items: ${error.message}`);
        }
    }

    static async addOrderItem(orderId, itemData) {
        try {
            const { product_id, quantity, price } = itemData;
            
            if (!product_id || !quantity || !price) {
                throw new Error('Product ID, quantity, and price are required');
            }

            if (quantity <= 0) {
                throw new Error('Quantity must be greater than 0');
            }

            if (price <= 0) {
                throw new Error('Price must be greater than 0');
            }
            
            const [result] = await pool.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderId, product_id, quantity, price]
            );
            
            return { item_id: result.insertId, message: 'Order item added successfully' };
        } catch (error) {
            throw new Error(`Error adding order item: ${error.message}`);
        }
    }

    static async calculateTotal(orderId) {
        try {
            const [rows] = await pool.query(`
                SELECT SUM(quantity * price) as total
                FROM order_items
                WHERE order_id = ?
            `, [orderId]);
            
            return rows[0].total || 0;
        } catch (error) {
            throw new Error(`Error calculating order total: ${error.message}`);
        }
    }

    static async updateTotal(orderId) {
        try {
            const total = await this.calculateTotal(orderId);
            
            const [result] = await pool.query(
                'UPDATE orders SET total = ? WHERE order_id = ?',
                [total, orderId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Order not found');
            }

            return { message: 'Order total updated successfully', total: total };
        } catch (error) {
            throw new Error(`Error updating order total: ${error.message}`);
        }
    }

    static async findAllWithPaginationAndSearch({ limit = 20, offset = 0, search = '' }) {
        try {
            let whereClause = '';
            let params = [];
            if (search) {
                whereClause = 'WHERE (o.order_id LIKE ? OR u.name LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }
            // Get total count
            const [countResult] = await pool.query(`
                SELECT COUNT(*) as total
                FROM orders o
                LEFT JOIN users u ON o.customer_id = u.user_id
                ${whereClause}
            `, params);
            const total = countResult[0].total;

            // Get data (all if limit=0, paginated otherwise)
            const dataQuery = `
                SELECT o.*, p.method as payment_method, p.payment_id, u.name as customer_name, u.phone as customer_phone, da.address as delivery_address, 
                       p.status as payment_status, o.delivery_zone_id, dz.name_en as delivery_zone_name, dz.delivery_fee,
                       dp.vehicle_type, dp.vehicle_number, u_dp.name as delivery_person_name
                FROM orders o
                LEFT JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
                LEFT JOIN delivery_personnel dp ON o.delivery_id = dp.delivery_id
                LEFT JOIN users u_dp ON dp.user_id = u_dp.user_id
                ${whereClause}
                ORDER BY o.placed_at DESC
                ${limit > 0 ? 'LIMIT ? OFFSET ?' : ''}
            `;
            const dataParams = limit > 0 ? [...params, limit, offset] : params;
            const [rows] = await pool.query(dataQuery, dataParams);
            return {
                orders: rows.map(row => new Order(row)),
                total: total
            };
        } catch (error) {
            throw new Error(`Error fetching orders with pagination and search: ${error.message}`);
        }
    }

    static async findByVendor(vendorId, { limit = 20, offset = 0, search = '' } = {}) {
        try {
                                                // Find all order_ids that have at least one product from this vendor
            let whereClause = 'WHERE p.vendor_id = ?';
            let params = [vendorId];
            if (search) {
                whereClause += ' AND (o.order_id LIKE ? OR u.name LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }
            
                                    // Get total count
            const [countResult] = await pool.query(`
                SELECT COUNT(DISTINCT o.order_id) as total
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN users u ON o.customer_id = u.user_id
                ${whereClause}
            `, params);
            const total = countResult[0].total;
            
                                    // Get paginated data
            const dataQuery = `
                SELECT DISTINCT o.*, pmt.method as payment_method, pmt.payment_id, u.name as customer_name, u.phone as customer_phone, da.address as delivery_address, 
                       pmt.status as payment_status, o.delivery_zone_id, dz.name_en as delivery_zone_name, dz.delivery_fee,
                       dp.vehicle_type, dp.vehicle_number, u_dp.name as delivery_person_name
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN users u ON o.customer_id = u.user_id
                LEFT JOIN delivery_addresses da ON o.address_id = da.address_id
                LEFT JOIN payments pmt ON o.order_id = pmt.order_id
                LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.zone_id
                LEFT JOIN delivery_personnel dp ON o.delivery_id = dp.delivery_id
                LEFT JOIN users u_dp ON dp.user_id = u_dp.user_id
                ${whereClause}
                ORDER BY o.placed_at DESC
                ${limit > 0 ? 'LIMIT ? OFFSET ?' : ''}
            `;
            const dataParams = limit > 0 ? [...params, limit, offset] : params;
            
                                    const [rows] = await pool.query(dataQuery, dataParams);
            
                                                return {
                orders: rows.map(row => new Order(row)),
                total: total
            };
        } catch (error) {
            console.error('Error in Order.findByVendor:', error);
            throw new Error(`Error fetching vendor orders: ${error.message}`);
        }
    }

    static async hasVendorInOrder(orderId, vendorId) {
        try {
            const [rows] = await pool.query(`
                SELECT COUNT(*) as count
                FROM order_items oi
                JOIN products p ON oi.product_id = p.product_id
                WHERE oi.order_id = ? AND p.vendor_id = ?
            `, [orderId, vendorId]);
            return rows[0].count > 0;
        } catch (error) {
            throw new Error(`Error checking vendor in order: ${error.message}`);
        }
    }

    // Instance methods
    toJSON() {
        return {
            order_id: this.order_id,
            customer_id: this.customer_id,
            total: this.total,
            status: this.status,
            address_id: this.address_id,
            payment_id: this.payment_id,
            customer_name: this.customer_name,
            customer_phone: this.customer_phone,
            delivery_address: this.delivery_address,
            delivery_zone_id: this.delivery_zone_id,
            delivery_notes: this.delivery_notes,
            payment_status: this.payment_status,
            created_at: this.created_at,
            updated_at: this.updated_at,
            placed_at: this.placed_at,
            payment_method: this.payment_method,
            delivery_id: this.delivery_id ?? null
        };
    }
}

module.exports = Order; 