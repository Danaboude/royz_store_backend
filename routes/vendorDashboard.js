const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const { pool } = require('../db/db');

// Get dashboard statistics
router.get('/statistics', authenticateJWT, async (req, res) => {
  try {
    const vendorId = req.user.id;
    
    // Get basic statistics
    const [statsResult] = await pool.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) as pending_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END) as cancelled_orders
      FROM vendors v
      LEFT JOIN products p ON v.id = p.vendor_id AND p.deleted = 0
      LEFT JOIN orders o ON p.id = o.product_id
      WHERE v.id = ?
    `, [vendorId]);

    const stats = statsResult[0];

    // Get monthly revenue
    const [monthlyRevenue] = await pool.query(`
      SELECT COALESCE(SUM(o.total_amount), 0) as monthly_revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.vendor_id = ? 
      AND o.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
    `, [vendorId]);

    res.json({
      success: true,
      data: {
        totalProducts: stats.total_products,
        totalOrders: stats.total_orders,
        totalRevenue: stats.total_revenue,
        monthlyRevenue: monthlyRevenue[0].monthly_revenue,
        pendingOrders: stats.pending_orders,
        completedOrders: stats.completed_orders,
        cancelledOrders: stats.cancelled_orders
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
});

// Get recent orders for dashboard
router.get('/recent-orders', authenticateJWT, async (req, res) => {
  try {
    const vendorId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    
    const [recentOrders] = await pool.query(`
      SELECT 
        o.id,
        o.total_amount,
        o.status,
        o.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE p.vendor_id = ?
      ORDER BY o.created_at DESC
      LIMIT ?
    `, [vendorId, limit]);

    const [totalOrders] = await pool.query(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.vendor_id = ?
    `, [vendorId]);

    res.json({
      success: true,
      data: {
        orders: recentOrders.map(order => ({
          id: order.id,
          total_amount: order.total_amount,
          status: order.status,
          created_at: order.created_at,
          customer_name: `${order.first_name} ${order.last_name}`,
          customer_email: order.email
        })),
        total: totalOrders[0].total
      }
    });
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent orders'
    });
  }
});

// Get top products for dashboard
router.get('/top-products', authenticateJWT, async (req, res) => {
  try {
    const vendorId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    
    const [topProducts] = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.price,
        COUNT(DISTINCT o.id) as times_ordered,
        COALESCE(SUM(o.total_amount), 0) as total_revenue
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id
      WHERE p.vendor_id = ?
      GROUP BY p.id
      ORDER BY times_ordered DESC, total_revenue DESC
      LIMIT ?
    `, [vendorId, limit]);

    const [totalProducts] = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      WHERE p.vendor_id = ?
    `, [vendorId]);

    res.json({
      success: true,
      data: {
        products: topProducts.map(product => ({
          id: product.id,
          name: product.name,
          price: product.price,
          times_ordered: product.times_ordered,
          total_revenue: product.total_revenue
        })),
        total: totalProducts[0].total
      }
    });
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top products'
    });
  }
});

module.exports = router; 