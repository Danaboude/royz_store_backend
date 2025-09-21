// Vendor Payments routes 

const express = require('express');
const VendorPayment = require('../models/VendorPayment');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { pool } = require('../db/db');
const VendorPaymentsController = require('../controllers/VendorPaymentsController');

const router = express.Router();

// Debug log for all requests to this router
router.use((req, res, next) => {
      next();
});

// All vendor payment operations require authentication
router.use(authenticateJWT);

// Vendor fetches their own payments (with pagination/search)
router.get('/payments', authorizeRoles([3, 4, 5]), async (req, res) => {
    req.query.vendor_id = req.user.id;
  return VendorPaymentsController.getVendorPayments(req, res);
});

// Get vendor permissions - vendor only
router.get('/permissions', authorizeRoles([3, 4, 5]), async (req, res) => {
  try {
        // Check if vendor has active subscription from vendor_subscriptions table
    const [subscription] = await pool.query(
      'SELECT status FROM vendor_subscriptions WHERE user_id = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    
    const hasActiveSubscription = subscription.length > 0;
    
    // Define permissions based on subscription status
    const permissions = {
      can_export_payments: hasActiveSubscription,
      can_request_withdrawal: hasActiveSubscription,
      can_view_analytics: hasActiveSubscription,
      can_manage_products: hasActiveSubscription,
      subscription_status: hasActiveSubscription ? 'active' : 'inactive',
    };
    
    res.json({
      success: true,
      data: permissions,
      message: 'Vendor permissions retrieved successfully'
    });
  } catch (error) {
    console.error('[vendorPaymentsRouter] Error getting permissions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server Error', 
      details: error.message 
    });
  }
});

// Get all vendor payments - admin only
router.get("/", authorizeRoles([1]), async (req, res) => {
    try {
        const payments = await VendorPayment.findAll();
        res.json(payments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
});

// Get vendor payments by vendor ID - admin only
router.get("/vendor/:vendorId", authorizeRoles([1]), async (req, res) => {
    try {
        const { vendorId } = req.params;
        const payments = await VendorPayment.findByVendorId(vendorId);
        res.json(payments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
});

// Export vendor's own payments - vendor only (MUST BE BEFORE /:id route)
router.get("/export-my-payments", authorizeRoles([3, 4, 5]), async (req, res) => {
    try {
                                const vendorId = req.user.id;
        const { format = 'csv', status, start_date, end_date } = req.query;
        
        let query = `
            SELECT vp.*, u.name AS vendor_name, u.email AS vendor_email, o.total AS order_total
            FROM vendor_payments vp
            JOIN users u ON vp.vendor_id = u.user_id
            JOIN orders o ON vp.order_id = o.order_id
            WHERE vp.vendor_id = ?
        `;
        
        const params = [vendorId];
        
        if (status && status !== 'all') {
            query += ' AND vp.payment_status = ?';
            params.push(status);
        }
        
        if (start_date) {
            query += ' AND vp.created_at >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            query += ' AND vp.created_at <= ?';
            params.push(end_date);
        }
        
        query += ' ORDER BY vp.created_at DESC';
        
        const [payments] = await pool.query(query, params);
        
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="my_payments.csv"');
            
            const csvHeader = 'Payment ID,Order ID,Amount,Commission Rate,Commission Amount,Net Amount,Status,Payment Date,Payment Method,Created At\n';
            const csvData = payments.map(p => 
                `${p.payment_id},${p.order_id},${p.amount},${p.commission_rate},${p.commission_amount},${p.net_amount},${p.payment_status},${p.payment_date || ''},${p.payment_method || ''},${p.created_at}`
            ).join('\n');
            
            res.send(csvHeader + csvData);
        } else {
            // For Excel format, return JSON data
            res.json({ 
                success: true, 
                message: 'Payments exported successfully',
                data: payments,
                total: payments.length,
                format: format
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
});

// Get vendor payment by ID - admin only
router.get("/:id", authorizeRoles([1]), async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await VendorPayment.findById(id);
        
        if (!payment) {
            return res.status(404).json({ error: 'Vendor payment not found' });
        }
        
        res.json(payment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
});

// Update vendor payment status - admin only
router.put("/:id/status", authorizeRoles([1]), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, payment_date, payment_method } = req.body;
        
        await VendorPayment.updateStatus(id, status, payment_date, payment_method);
        res.json({ message: 'Vendor payment status updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
});

// Get vendor payment summary - admin only
router.get("/vendor/:vendorId/summary", authorizeRoles([1]), async (req, res) => {
    try {
        const { vendorId } = req.params;
        const summary = await VendorPayment.getVendorPaymentSummary(vendorId);
        res.json(summary);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
});

// Create vendor payment - admin only
router.post("/", authorizeRoles([1]), async (req, res) => {
    try {
        const paymentData = req.body;
        const result = await VendorPayment.create(paymentData);
        res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
});

// Bulk update vendor payment status - admin only
router.put("/bulk-status", authorizeRoles([1]), async (req, res) => {
    try {
        const { payment_ids, status, payment_date, payment_method } = req.body;
        
        if (!Array.isArray(payment_ids) || payment_ids.length === 0) {
            return res.status(400).json({ error: 'Payment IDs array is required' });
        }
        
        let updatedCount = 0;
        for (const paymentId of payment_ids) {
            try {
                await VendorPayment.updateStatus(paymentId, status, payment_date, payment_method);
                updatedCount++;
            } catch (error) {
                console.error(`Error updating payment ${paymentId}:`, error);
            }
        }
        
        res.json({ 
            message: `Successfully updated ${updatedCount} out of ${payment_ids.length} payments`,
            updated_count: updatedCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
});

// Export vendor payments - admin only
router.get("/export", authorizeRoles([1]), async (req, res) => {
    try {
        const { format = 'csv', status, vendor_id, start_date, end_date } = req.query;
        
        let query = `
            SELECT vp.*, u.name AS vendor_name, u.email AS vendor_email, o.total AS order_total
            FROM vendor_payments vp
            JOIN users u ON vp.vendor_id = u.user_id
            JOIN orders o ON vp.order_id = o.order_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            query += ' AND vp.payment_status = ?';
            params.push(status);
        }
        
        if (vendor_id) {
            query += ' AND vp.vendor_id = ?';
            params.push(vendor_id);
        }
        
        if (start_date) {
            query += ' AND vp.created_at >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            query += ' AND vp.created_at <= ?';
            params.push(end_date);
        }
        
        query += ' ORDER BY vp.created_at DESC';
        
        const [payments] = await pool.query(query, params);
        
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="vendor_payments.csv"');
            
            const csvHeader = 'Payment ID,Vendor Name,Vendor Email,Order ID,Amount,Commission Rate,Commission Amount,Net Amount,Status,Payment Date,Payment Method,Created At\n';
            const csvData = payments.map(p => 
                `${p.payment_id},"${p.vendor_name}","${p.vendor_email}",${p.order_id},${p.amount},${p.commission_rate},${p.commission_amount},${p.net_amount},${p.payment_status},${p.payment_date || ''},${p.payment_method || ''},${p.created_at}`
            ).join('\n');
            
            res.send(csvHeader + csvData);
        } else {
            // For Excel format, you might want to use a library like exceljs
            res.json({ message: 'Excel export not implemented yet', data: payments });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
});

module.exports = router; 