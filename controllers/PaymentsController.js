// Payments Controller 

const { pool } = require('../db/db');

async function getPayments(req, res) {
    const user_id = req.user.id;
    const userRole = req.user.roleId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    try {
        let baseQuery = `
            SELECT p.*, o.total as order_total, o.status as order_status, o.customer_id
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
        `;
        let countQuery = `
            SELECT COUNT(*) as total
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
        `;
        let where = [];
        let params = [];

        // Role-based filtering
        if (userRole === 3) { // Customer - only their own payments
            where.push('o.customer_id = ?');
            params.push(user_id);
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - payments for orders containing their products
            where.push(`o.order_id IN (
                SELECT DISTINCT oi.order_id 
                FROM order_items oi 
                JOIN products p ON oi.product_id = p.product_id 
                WHERE p.vendor_id = ?
            )`);
            params.push(user_id);
        }
        // Admin (role 1) can see all payments - no WHERE clause needed

        // Search filter
        if (search) {
            where.push('(p.payment_id LIKE ? OR o.order_id LIKE ? OR o.customer_id LIKE ? OR p.amount LIKE ? OR p.method LIKE ? OR p.status LIKE ? OR o.status LIKE ? )');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (where.length > 0) {
            baseQuery += ' WHERE ' + where.join(' AND ');
            countQuery += ' WHERE ' + where.join(' AND ');
        }

        baseQuery += ' ORDER BY p.processed_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [payments] = await pool.query(baseQuery, params);
        const [countRows] = await pool.query(countQuery, params.slice(0, -2));
        const total = countRows[0]?.total || 0;
        res.json({ payments, total });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function getPaymentById(req, res) {
    const { id } = req.params;
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    try {
        let query = `
            SELECT p.*, o.total as order_total, o.status as order_status, o.customer_id
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            WHERE p.payment_id = ?
        `;

        let params = [id];

        const [payments] = await pool.query(query, params);

        if (payments.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const payment = payments[0];

        // Check permissions based on user role
        if (userRole === 3) { // Customer - can only see their own payments
            if (payment.customer_id != user_id) {
                return res.status(403).json({ error: 'Access denied' });
            }
        } else if (userRole === 3 || userRole === 4 || userRole === 5) { // Vendor - can only see payments for orders containing their products
            const [vendorOrders] = await pool.query(`
                SELECT COUNT(*) as count 
                FROM order_items oi 
                JOIN products p ON oi.product_id = p.product_id 
                WHERE oi.order_id = ? AND p.vendor_id = ?
            `, [payment.order_id, user_id]);
            
            if (vendorOrders[0].count === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        // Admin (role 1) can see any payment - no additional check needed

        res.json(payment);
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function createPayment(req, res) {
    const { order_id, amount, method } = req.body;
    const user_id = req.user.id;
    const userRole = req.user.roleId;

    // Only customers can create payments
    if (userRole !== 3) {
        return res.status(403).json({ error: 'Only customers can create payments' });
    }

    if (!order_id || !amount || !method) {
        return res.status(400).json({ error: 'Order ID, amount, and method are required' });
    }

    if (!['card', 'transfer'].includes(method)) {
        return res.status(400).json({ error: 'Method must be either "card" or "transfer"' });
    }

    try {
        // Check if order exists and belongs to the customer
        const [orders] = await pool.query(
            'SELECT * FROM orders WHERE order_id = ? AND customer_id = ?',
            [order_id, user_id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        // Check if payment already exists for this order
        const [existingPayments] = await pool.query(
            'SELECT * FROM payments WHERE order_id = ?',
            [order_id]
        );

        if (existingPayments.length > 0) {
            return res.status(400).json({ error: 'Payment already exists for this order' });
        }

        // Validate amount
        if (amount != order.total) {
            return res.status(400).json({ 
                error: `Payment amount must match order total: ${order.total}` 
            });
        }

        // Create payment
        const [result] = await pool.query(
            'INSERT INTO payments (order_id, amount, method, status, processed_at) VALUES (?, ?, ?, ?, NOW())',
            [order_id, amount, method, 'pending']
        );

        res.status(201).json({ 
            message: 'Payment created successfully', 
            payment_id: result.insertId 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

async function updatePaymentStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    const userRole = req.user.roleId;
    const user_id = req.user.id;

    // Only admins and vendors can update payment status
    if (userRole !== 1 && userRole !== 2) {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (!['paid', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Status must be either "paid" or "pending"' });
    }

    try {
        // Get the payment and order details
        const [payments] = await pool.query(`
            SELECT p.*, o.order_id 
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            WHERE p.payment_id = ?
        `, [id]);

        if (payments.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // For vendors, check if payment is for an order containing their products
        if (userRole === 2) {
            const [vendorOrders] = await pool.query(`
                SELECT COUNT(*) as count 
                FROM order_items oi 
                JOIN products p ON oi.product_id = p.product_id 
                WHERE oi.order_id = ? AND p.vendor_id = ?
            `, [payments[0].order_id, user_id]);
            
            if (vendorOrders[0].count === 0) {
                return res.status(403).json({ error: 'Access denied - payment is not for your products' });
            }
        }

        const [result] = await pool.query(
            'UPDATE payments SET status = ?, processed_at = NOW() WHERE payment_id = ?',
            [status, id]
        );

        // If payment is marked as paid, update order status to processing
        if (status === 'paid') {
            await pool.query(
                'UPDATE orders SET status = ? WHERE order_id = ?',
                ['processing', payments[0].order_id]
            );
            
            // Update vendor payment status to 'approved' when customer payment is paid
            try {
                await pool.query(
                    'UPDATE vendor_payments SET payment_status = ?, payment_date = NOW() WHERE order_id = ?',
                    ['approved', payments[0].order_id]
                );
                            } catch (vendorPaymentError) {
                console.error('Error updating vendor payment status:', vendorPaymentError);
                // Don't fail the payment update if vendor payment update fails
            }
        }

        res.json({ message: 'Payment status updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({error:'Server Error', details: err?.message});
    }
}

// List all subscription payments (admin only)
async function getSubscriptionPayments(req, res) {
    const userRole = req.user.roleId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    if (userRole !== 1) {
        return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }
    try {
        let baseQuery = `
            SELECT sp.*, 
                   u.name AS vendor_name, 
                   u.email AS vendor_email, 
                   p.name_en AS package_name, 
                   p.name_ar AS package_name_ar
            FROM subscription_payments sp
            JOIN users u ON sp.user_id = u.user_id
            LEFT JOIN vendor_subscriptions vs ON sp.subscription_id = vs.subscription_id
            LEFT JOIN subscription_packages p ON vs.package_id = p.package_id
        `;
        let countQuery = `
            SELECT COUNT(*) as total
            FROM subscription_payments sp
            JOIN users u ON sp.user_id = u.user_id
            LEFT JOIN vendor_subscriptions vs ON sp.subscription_id = vs.subscription_id
            LEFT JOIN subscription_packages p ON vs.package_id = p.package_id
        `;
        let where = [];
        let params = [];
        if (search) {
            where.push('(sp.payment_id LIKE ? OR u.name LIKE ? OR p.name_en LIKE ? OR p.name_ar LIKE ? OR sp.amount LIKE ? OR sp.payment_method LIKE ? OR sp.payment_status LIKE ? )');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (where.length > 0) {
            baseQuery += ' WHERE ' + where.join(' AND ');
            countQuery += ' WHERE ' + where.join(' AND ');
        }
        baseQuery += ' ORDER BY sp.payment_date DESC, sp.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [payments] = await pool.query(baseQuery, params);
        const [countRows] = await pool.query(countQuery, params.slice(0, -2));
        const total = countRows[0]?.total || 0;
        res.json({ payments, total });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error', details: err?.message });
    }
}

// List all vendor payments (admin only)
async function getVendorPayments(req, res) {
    const userRole = req.user.roleId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    if (userRole !== 1) {
        return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }
    try {
        let baseQuery = `
            SELECT vp.*, u.name AS vendor_name, u.email AS vendor_email, u.role_id, o.order_id, o.total AS order_total
            FROM vendor_payments vp
            JOIN users u ON vp.vendor_id = u.user_id
            JOIN orders o ON vp.order_id = o.order_id
        `;
        let countQuery = `
            SELECT COUNT(*) as total
            FROM vendor_payments vp
            JOIN users u ON vp.vendor_id = u.user_id
            JOIN orders o ON vp.order_id = o.order_id
        `;
        let where = [];
        let params = [];
        if (search) {
            where.push('(vp.payment_id LIKE ? OR u.name LIKE ? OR o.order_id LIKE ? OR vp.amount LIKE ? OR vp.commission_amount LIKE ? OR vp.net_amount LIKE ? OR vp.payment_status LIKE ? )');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (where.length > 0) {
            baseQuery += ' WHERE ' + where.join(' AND ');
            countQuery += ' WHERE ' + where.join(' AND ');
        }
        baseQuery += ' ORDER BY vp.payment_date DESC, vp.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [payments] = await pool.query(baseQuery, params);
        const [countRows] = await pool.query(countQuery, params.slice(0, -2));
        const total = countRows[0]?.total || 0;
        res.json({ payments, total });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error', details: err?.message });
    }
}

// Activate a subscription payment and update related subscription
async function activateSubscriptionPayment(req, res) {
    const { id } = req.params;
    const userRole = req.user.roleId;
    
                if (userRole !== 1 && userRole !== 10) {
                return res.status(403).json({ error: 'Access denied - Admin or Order Manager required' });
    }
    
    try {
        // 1. Check if payment exists
                const [paymentRows] = await pool.query('SELECT * FROM subscription_payments WHERE payment_id = ?', [id]);
                if (paymentRows.length === 0) {
                        return res.status(404).json({ error: 'Subscription payment not found' });
        }
        
        const payment = paymentRows[0];
                // 2. Update payment status
                const [updateResult] = await pool.query('UPDATE subscription_payments SET payment_status = ? WHERE payment_id = ?', ['completed', id]);
                // 3. Update subscription status
                const [subscriptionResult] = await pool.query('UPDATE vendor_subscriptions SET status = ?, payment_status = ? WHERE subscription_id = ?', ['active', 'paid', payment.subscription_id]);
                // 4. Fetch updated payment
        const [updatedRows] = await pool.query('SELECT * FROM subscription_payments WHERE payment_id = ?', [id]);
                        res.json({
            success: true,
            message: 'Subscription payment activated and subscription set to active/paid.',
            payment: updatedRows[0] || null
        });
    } catch (err) {
        console.error('=== DEBUG: Error in activateSubscriptionPayment ===');
        console.error('Error:', err);
        res.status(500).json({ error: 'Server Error', details: err?.message });
    }
}

module.exports = { 
    getPayments, 
    getPaymentById, 
    createPayment, 
    updatePaymentStatus,
    getSubscriptionPayments,
    getVendorPayments,
    activateSubscriptionPayment
}; 