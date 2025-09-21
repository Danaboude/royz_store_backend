const { pool } = require('../db/db');

class VendorPaymentsController {
    
    // Get all vendor payments with filtering
    static async getVendorPayments(req, res) {
        try {
            const { status, vendor_id, start_date, end_date, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            let whereConditions = [];
            let params = [];

            if (status) {
                whereConditions.push('vp.payment_status = ?');
                params.push(status);
            }

            if (vendor_id) {
                whereConditions.push('vp.vendor_id = ?');
                params.push(vendor_id);
            }

            if (start_date) {
                whereConditions.push('vp.created_at >= ?');
                params.push(start_date);
            }

            if (end_date) {
                whereConditions.push('vp.created_at <= ?');
                params.push(end_date);
            }

            const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

            const [payments] = await pool.execute(`
                SELECT 
                    vp.*,
                    u.name as vendor_name,
                    u.email as vendor_email,
                    u.phone as vendor_phone,
                    o.order_id,
                    o.total as order_total,
                    o.status as order_status,
                    p.method as payment_method,
                    pc.payment_received,
                    pc.confirmed_at as payment_confirmed_at
                FROM vendor_payments vp
                JOIN users u ON vp.vendor_id = u.user_id
                JOIN orders o ON vp.order_id = o.order_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                LEFT JOIN payment_confirmations pc ON o.order_id = pc.order_id
                ${whereClause}
                ORDER BY vp.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, parseInt(limit), offset]);

            // Get total count
            const [countResult] = await pool.execute(`
                SELECT COUNT(*) as total
                FROM vendor_payments vp
                JOIN users u ON vp.vendor_id = u.user_id
                JOIN orders o ON vp.order_id = o.order_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                ${whereClause}
            `, params);

            res.json({
                success: true,
                data: payments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / limit)
                },
                message: 'Vendor payments retrieved successfully'
            });

        } catch (error) {
            console.error('Error getting vendor payments:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get vendor payments',
                details: error.message
            });
        }
    }

    // Process vendor payment (Admin marks as paid)
    static async processVendorPayment(req, res) {
        try {
            const { payment_id, payment_method, transaction_id, notes } = req.body;
            const admin_id = req.user.id;

            // Validate required fields
            if (!payment_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment ID is required'
                });
            }

            // Get vendor payment details
            const [paymentResult] = await pool.execute(`
                SELECT vp.*, u.name as vendor_name, o.order_id, o.total as order_total
                FROM vendor_payments vp
                JOIN users u ON vp.vendor_id = u.user_id
                JOIN orders o ON vp.order_id = o.order_id
                WHERE vp.payment_id = ?
            `, [payment_id]);

            if (paymentResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Vendor payment not found'
                });
            }

            const payment = paymentResult[0];

            // Check if payment is already processed
            if (payment.payment_status === 'paid') {
                return res.status(400).json({
                    success: false,
                    error: 'Payment is already processed'
                });
            }

            // Check if payment is approved (customer payment received)
            if (payment.payment_status !== 'approved') {
                return res.status(400).json({
                    success: false,
                    error: 'Payment must be approved before processing'
                });
            }

            // Begin transaction
            await pool.execute('START TRANSACTION');

            try {
                // Update vendor payment status to paid
                await pool.execute(`
                    UPDATE vendor_payments 
                    SET payment_status = ?, 
                        payment_date = NOW(),
                        payment_method = ?,
                        transaction_id = ?,
                        notes = ?
                    WHERE payment_id = ?
                `, ['paid', payment_method || 'cash', transaction_id || null, notes || null, payment_id]);

                // Create notification for vendor
                await pool.execute(`
                    INSERT INTO notifications (user_id, message, type, related_id)
                    VALUES (?, ?, 'vendor_payment', ?)
                `, [
                    payment.vendor_id,
                    `Your payment of ${payment.net_amount} ل.س for order #${payment.order_id} has been processed.`,
                    payment_id
                ]);

                await pool.execute('COMMIT');

                res.json({
                    success: true,
                    message: 'Vendor payment processed successfully',
                    data: {
                        payment_id,
                        vendor_name: payment.vendor_name,
                        amount: payment.net_amount,
                        order_id: payment.order_id,
                        payment_method: payment_method || 'cash'
                    }
                });

            } catch (error) {
                await pool.execute('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error('Error processing vendor payment:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process vendor payment',
                details: error.message
            });
        }
    }

    // Get COD payments summary (cash payments that need processing)
    static async getCODPaymentsSummary(req, res) {
        try {
            const [summary] = await pool.execute(`
                SELECT 
                    COUNT(*) as total_cod_orders,
                    SUM(CASE WHEN vp.payment_status = 'approved' THEN 1 ELSE 0 END) as pending_vendor_payments,
                    SUM(CASE WHEN vp.payment_status = 'paid' THEN 1 ELSE 0 END) as processed_vendor_payments,
                    SUM(CASE WHEN vp.payment_status = 'approved' THEN vp.net_amount ELSE 0 END) as total_pending_amount,
                    SUM(CASE WHEN vp.payment_status = 'paid' THEN vp.net_amount ELSE 0 END) as total_processed_amount
                FROM vendor_payments vp
                JOIN orders o ON vp.order_id = o.order_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                WHERE p.method = 'cash'
            `);

            // Get recent COD orders
            const [recentOrders] = await pool.execute(`
                SELECT 
                    o.order_id,
                    o.total as order_total,
                    o.status as order_status,
                    p.method as payment_method,
                    vp.payment_status as vendor_payment_status,
                    vp.net_amount as vendor_payment_amount,
                    u.name as vendor_name,
                    pc.payment_received,
                    pc.confirmed_at as payment_confirmed_at
                FROM orders o
                JOIN vendor_payments vp ON o.order_id = vp.order_id
                JOIN users u ON vp.vendor_id = u.user_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                LEFT JOIN payment_confirmations pc ON o.order_id = pc.order_id
                WHERE p.method = 'cash'
                ORDER BY o.placed_at DESC
                LIMIT 10
            `);

            res.json({
                success: true,
                data: {
                    summary: summary[0],
                    recentOrders
                },
                message: 'COD payments summary retrieved successfully'
            });

        } catch (error) {
            console.error('Error getting COD payments summary:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get COD payments summary',
                details: error.message
            });
        }
    }

    // Bulk process vendor payments
    static async bulkProcessVendorPayments(req, res) {
        try {
            const { payment_ids, payment_method, transaction_id, notes } = req.body;
            const admin_id = req.user.id;

            if (!payment_ids || !Array.isArray(payment_ids) || payment_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment IDs array is required'
                });
            }

            // Get vendor payments that can be processed
            const [payments] = await pool.execute(`
                SELECT vp.*, u.name as vendor_name
                FROM vendor_payments vp
                JOIN users u ON vp.vendor_id = u.user_id
                WHERE vp.payment_id IN (${payment_ids.map(() => '?').join(',')})
                AND vp.payment_status = 'approved'
            `, payment_ids);

            if (payments.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No approved payments found for processing'
                });
            }

            // Begin transaction
            await pool.execute('START TRANSACTION');

            try {
                const processedPayments = [];

                for (const payment of payments) {
                    // Update vendor payment status
                    await pool.execute(`
                        UPDATE vendor_payments 
                        SET payment_status = ?, 
                            payment_date = NOW(),
                            payment_method = ?,
                            transaction_id = ?,
                            notes = ?
                        WHERE payment_id = ?
                    `, ['paid', payment_method || 'cash', transaction_id || null, notes || null, payment.payment_id]);

                    // Create notification for vendor
                    await pool.execute(`
                        INSERT INTO notifications (user_id, message, type, related_id)
                        VALUES (?, ?, 'vendor_payment', ?)
                    `, [
                        payment.vendor_id,
                        `Your payment of ${payment.net_amount} ل.س for order #${payment.order_id} has been processed.`,
                        payment.payment_id
                    ]);

                    processedPayments.push({
                        payment_id: payment.payment_id,
                        vendor_name: payment.vendor_name,
                        amount: payment.net_amount,
                        order_id: payment.order_id
                    });
                }

                await pool.execute('COMMIT');

                res.json({
                    success: true,
                    message: `Successfully processed ${processedPayments.length} vendor payments`,
                    data: {
                        processed_count: processedPayments.length,
                        payments: processedPayments
                    }
                });

            } catch (error) {
                await pool.execute('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error('Error bulk processing vendor payments:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to bulk process vendor payments',
                details: error.message
            });
        }
    }

    // Export vendor payments to CSV
    static async exportVendorPayments(req, res) {
        try {
            const { status, vendor_id, start_date, end_date } = req.query;

            let whereConditions = [];
            let params = [];

            if (status) {
                whereConditions.push('vp.payment_status = ?');
                params.push(status);
            }

            if (vendor_id) {
                whereConditions.push('vp.vendor_id = ?');
                params.push(vendor_id);
            }

            if (start_date) {
                whereConditions.push('vp.created_at >= ?');
                params.push(start_date);
            }

            if (end_date) {
                whereConditions.push('vp.created_at <= ?');
                params.push(end_date);
            }

            const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

            const [payments] = await pool.execute(`
                SELECT 
                    vp.payment_id,
                    u.name as vendor_name,
                    u.email as vendor_email,
                    o.order_id,
                    vp.amount,
                    vp.commission_amount,
                    vp.net_amount,
                    vp.payment_status,
                    vp.payment_date,
                    vp.created_at,
                    p.method as payment_method
                FROM vendor_payments vp
                JOIN users u ON vp.vendor_id = u.user_id
                JOIN orders o ON vp.order_id = o.order_id
                LEFT JOIN payments p ON o.order_id = p.order_id
                ${whereClause}
                ORDER BY vp.created_at DESC
            `, params);

            // Convert to CSV format
            const csvHeaders = [
                'Payment ID',
                'Vendor Name',
                'Vendor Email',
                'Order ID',
                'Amount (ل.س)',
                'Commission (ل.س)',
                'Net Amount (ل.س)',
                'Payment Status',
                'Payment Date',
                'Created Date',
                'Payment Method'
            ];

            const csvRows = payments.map(payment => [
                payment.payment_id,
                payment.vendor_name,
                payment.vendor_email,
                payment.order_id,
                payment.amount,
                payment.commission_amount,
                payment.net_amount,
                payment.payment_status,
                payment.payment_date,
                payment.created_at,
                payment.payment_method
            ]);

            const csvContent = [csvHeaders, ...csvRows]
                .map(row => row.map(cell => `"${cell || ''}"`).join(','))
                .join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="vendor_payments.csv"');
            res.send(csvContent);

        } catch (error) {
            console.error('Error exporting vendor payments:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to export vendor payments',
                details: error.message
            });
        }
    }
}

module.exports = VendorPaymentsController; 