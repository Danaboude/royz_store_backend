const { pool } = require('../db/db');

class VendorPayment {
    constructor(data) {
        this.payment_id = data.payment_id;
        this.vendor_id = data.vendor_id;
        this.order_id = data.order_id;
        this.amount = data.amount;
        this.commission_rate = data.commission_rate;
        this.commission_amount = data.commission_amount;
        this.net_amount = data.net_amount;
        this.payment_status = data.payment_status;
        this.payment_date = data.payment_date;
        this.payment_method = data.payment_method;
        this.notes = data.notes;
        this.created_at = data.created_at;
    }

    static async create(paymentData) {
        try {
            const { 
                vendor_id, order_id, amount, commission_rate, 
                commission_amount, net_amount, payment_status, 
                payment_method, notes 
            } = paymentData;
            
            if (!vendor_id || !order_id || !amount || commission_rate === undefined) {
                throw new Error('Vendor ID, order ID, amount, and commission rate are required');
            }

            const [result] = await pool.query(
                'INSERT INTO vendor_payments (vendor_id, order_id, amount, commission_rate, commission_amount, net_amount, payment_status, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [vendor_id, order_id, amount, commission_rate, commission_amount, net_amount, payment_status || 'pending', payment_method, notes]
            );
            
            return { payment_id: result.insertId, message: 'Vendor payment record created successfully' };
        } catch (error) {
            throw new Error(`Error creating vendor payment: ${error.message}`);
        }
    }

    static async findByVendorId(vendorId) {
        try {
            const [rows] = await pool.query(`
                SELECT vp.*, o.total as order_total, o.status as order_status,
                       u.name as vendor_name, u.email as vendor_email
                FROM vendor_payments vp
                JOIN orders o ON vp.order_id = o.order_id
                JOIN users u ON vp.vendor_id = u.user_id
                WHERE vp.vendor_id = ?
                ORDER BY vp.created_at DESC
            `, [vendorId]);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching vendor payments: ${error.message}`);
        }
    }

    static async findByOrderId(orderId) {
        try {
            const [rows] = await pool.query(`
                SELECT vp.*, u.name as vendor_name, u.email as vendor_email
                FROM vendor_payments vp
                JOIN users u ON vp.vendor_id = u.user_id
                WHERE vp.order_id = ?
            `, [orderId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching vendor payment by order: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT vp.*, o.total as order_total, o.status as order_status,
                       u.name as vendor_name, u.email as vendor_email
                FROM vendor_payments vp
                JOIN orders o ON vp.order_id = o.order_id
                JOIN users u ON vp.vendor_id = u.user_id
                WHERE vp.payment_id = ?
            `, [id]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching vendor payment: ${error.message}`);
        }
    }

    static async updateStatus(id, status, paymentDate = null, paymentMethod = null) {
        try {
            let updateFields = ['payment_status = ?'];
            let params = [status];

            if (paymentDate) {
                updateFields.push('payment_date = ?');
                params.push(paymentDate);
            }

            if (paymentMethod) {
                updateFields.push('payment_method = ?');
                params.push(paymentMethod);
            }

            params.push(id);

            const [result] = await pool.query(
                `UPDATE vendor_payments SET ${updateFields.join(', ')} WHERE payment_id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                throw new Error('Vendor payment not found');
            }

            return { message: 'Vendor payment status updated successfully' };
        } catch (error) {
            throw new Error(`Error updating vendor payment status: ${error.message}`);
        }
    }

    static async calculateCommission(amount, commissionRate) {
        try {
            const commissionAmount = amount * (commissionRate / 100);
            const netAmount = amount - commissionAmount;
            
            return {
                commission_amount: parseFloat(commissionAmount.toFixed(2)),
                net_amount: parseFloat(netAmount.toFixed(2))
            };
        } catch (error) {
            throw new Error(`Error calculating commission: ${error.message}`);
        }
    }

    static async getVendorPaymentSummary(vendorId) {
        try {
            const [rows] = await pool.query(`
                SELECT 
                    COUNT(*) as total_payments,
                    SUM(amount) as total_amount,
                    SUM(commission_amount) as total_commission,
                    SUM(net_amount) as total_net,
                    AVG(commission_rate) as avg_commission_rate,
                    COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_payments,
                    COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments
                FROM vendor_payments
                WHERE vendor_id = ?
            `, [vendorId]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching vendor payment summary: ${error.message}`);
        }
    }

    static async findAll() {
        try {
            const [rows] = await pool.query(`
                SELECT vp.*, o.total as order_total, o.status as order_status,
                       u.name as vendor_name, u.email as vendor_email
                FROM vendor_payments vp
                JOIN orders o ON vp.order_id = o.order_id
                JOIN users u ON vp.vendor_id = u.user_id
                ORDER BY vp.created_at DESC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching all vendor payments: ${error.message}`);
        }
    }
}

module.exports = VendorPayment; 