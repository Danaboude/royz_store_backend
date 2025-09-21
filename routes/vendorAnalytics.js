const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const { pool } = require('../db/db');

// Get vendor analytics by ID
router.get('/:vendorId', authenticateJWT, async (req, res) => {
  try {
    const { vendorId } = req.params;
    
    // Get vendor analytics data
    const [analyticsResult] = await pool.query(`
      SELECT 
        v.id,
        v.vendor_name,
        v.email as vendor_email,
        v.phone as vendor_phone,
        v.business_type,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COALESCE(SUM(o.commission_amount), 0) as total_commission,
        COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) as pending_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_orders
      FROM vendors v
      LEFT JOIN products p ON v.id = p.vendor_id AND p.deleted = 0
      LEFT JOIN orders o ON p.id = o.product_id
      WHERE v.id = ?
      GROUP BY v.id
    `, [vendorId]);

    if (analyticsResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const analytics = analyticsResult[0];

    // Get monthly performance
    const [monthlyPerformance] = await pool.query(`
      SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m') as month,
        COUNT(DISTINCT o.id) as orders,
        COALESCE(SUM(o.total_amount), 0) as revenue,
        COALESCE(SUM(o.commission_amount), 0) as commission
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.vendor_id = ?
      GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, [vendorId]);

    // Get top products
    const [topProducts] = await pool.query(`
      SELECT 
        p.id,
        p.name as product_name,
        COUNT(DISTINCT o.id) as times_ordered,
        COALESCE(SUM(o.total_amount), 0) as total_revenue
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id
      WHERE p.vendor_id = ? AND p.deleted = 0
      GROUP BY p.id
      ORDER BY times_ordered DESC, total_revenue DESC
      LIMIT 5
    `, [vendorId]);

    res.json({
      success: true,
      data: {
        vendor: {
          id: analytics.id,
          vendor_name: analytics.vendor_name,
          vendor_email: analytics.vendor_email,
          vendor_phone: analytics.vendor_phone,
          business_type: analytics.business_type,
          total_products: analytics.total_products,
          total_orders: analytics.total_orders,
          total_revenue: analytics.total_revenue,
          total_commission: analytics.total_commission,
          pending_orders: analytics.pending_orders,
          completed_orders: analytics.completed_orders
        },
        monthlyPerformance: monthlyPerformance.map(row => ({
          month: row.month,
          orders: row.orders,
          revenue: row.revenue,
          commission: row.commission
        })),
        topProducts: topProducts.map(row => ({
          id: row.id,
          product_name: row.product_name,
          times_ordered: row.times_ordered,
          total_revenue: row.total_revenue
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching vendor analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor analytics'
    });
  }
});

// Get vendor analytics for current user
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const vendorId = req.user.id; // Assuming user ID is the vendor ID
    
    // Get vendor analytics data
    const [analyticsResult] = await pool.query(`
      SELECT 
        v.id,
        v.vendor_name,
        v.email as vendor_email,
        v.phone as vendor_phone,
        v.business_type,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COALESCE(SUM(o.commission_amount), 0) as total_commission,
        COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) as pending_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_orders
      FROM vendors v
      LEFT JOIN products p ON v.id = p.vendor_id
      LEFT JOIN orders o ON p.id = o.product_id
      WHERE v.id = ?
      GROUP BY v.id
    `, [vendorId]);

    if (analyticsResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const analytics = analyticsResult[0];

    // Get monthly performance
    const [monthlyPerformance] = await pool.query(`
      SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m') as month,
        COUNT(DISTINCT o.id) as orders,
        COALESCE(SUM(o.total_amount), 0) as revenue,
        COALESCE(SUM(o.commission_amount), 0) as commission
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.vendor_id = ?
      GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, [vendorId]);

    // Get top products
    const [topProducts] = await pool.query(`
      SELECT 
        p.id,
        p.name as product_name,
        COUNT(DISTINCT o.id) as times_ordered,
        COALESCE(SUM(o.total_amount), 0) as total_revenue
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id
      WHERE p.vendor_id = ?
      GROUP BY p.id
      ORDER BY times_ordered DESC, total_revenue DESC
      LIMIT 5
    `, [vendorId]);

    res.json({
      success: true,
      data: {
        vendor: {
          id: analytics.id,
          vendor_name: analytics.vendor_name,
          vendor_email: analytics.vendor_email,
          vendor_phone: analytics.vendor_phone,
          business_type: analytics.business_type,
          total_products: analytics.total_products,
          total_orders: analytics.total_orders,
          total_revenue: analytics.total_revenue,
          total_commission: analytics.total_commission,
          pending_orders: analytics.pending_orders,
          completed_orders: analytics.completed_orders
        },
        monthlyPerformance: monthlyPerformance.map(row => ({
          month: row.month,
          orders: row.orders,
          revenue: row.revenue,
          commission: row.commission
        })),
        topProducts: topProducts.map(row => ({
          id: row.id,
          product_name: row.product_name,
          times_ordered: row.times_ordered,
          total_revenue: row.total_revenue
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching vendor analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor analytics'
    });
  }
});

module.exports = router; 