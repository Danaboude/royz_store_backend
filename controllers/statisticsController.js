const Statistics = require('../models/Statistics');
const { pool } = require('../db/db');

exports.getDashboardStats = async (req, res) => {
  try {
    const data = await Statistics.getDashboardStats();
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No dashboard data available',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: data,
      message: 'Dashboard stats retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getSalesByMonth = async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year) return res.status(400).json({ error: 'Year is required' });
    
    const stats = await Statistics.getSalesByMonth(year, month);
    
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No sales data available for the specified period',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Sales by month retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getSalesByMonth:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getSalesBySeller = async (req, res) => {
  try {
    const { vendorId, startDate, endDate } = req.query;
    const stats = await Statistics.getSalesBySeller(vendorId, startDate, endDate);
    
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No sales data available for the specified seller',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Sales by seller retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getSalesBySeller:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10, period = '30' } = req.query;
    const stats = await Statistics.getTopSellingProducts(parseInt(limit), period);
    
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No top selling products data available',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Top selling products retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getTopSellingProducts:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await Statistics.getRevenueAnalytics(startDate, endDate);
    
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No revenue analytics data available',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Revenue analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getRevenueAnalytics:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getCustomerAnalytics = async (req, res) => {
  try {
    const stats = await Statistics.getCustomerAnalytics();
    
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No customer analytics data available',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Customer analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getCustomerAnalytics:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getCustomerRetentionRate = async (req, res) => {
  try {
    const stats = await Statistics.getCustomerRetentionRate();
    
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No customer retention data available',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Customer retention rate retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getCustomerRetentionRate:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getProductPerformanceAnalytics = async (req, res) => {
  try {
    const stats = await Statistics.getProductPerformanceAnalytics();
    
    // Check if data exists
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No data available',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Product performance analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getProductPerformanceAnalytics:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getCategoryAnalytics = async (req, res) => {
  try {
    const stats = await Statistics.getCategoryAnalytics();
    
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No category analytics data available',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Category analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getCategoryAnalytics:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const stats = await Statistics.getDashboardSummary();
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      // Return an object with all fields set to 0
      return res.json({
        success: true,
        data: {
          total_revenue: 0,
          total_orders: 0,
          total_customers: 0,
          total_products: 0,
          today_revenue: 0,
          today_orders: 0,
          month_revenue: 0,
          month_orders: 0,
          pending_orders: 0,
          out_of_stock_products: 0,
          average_order_value: 0,
        },
        message: 'No dashboard summary data available',
        noData: true
      });
    }
    res.json({
      success: true,
      data: stats,
      message: 'Dashboard summary retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getDashboardSummary:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getRealTimeStats = async (req, res) => {
  try {
    const stats = await Statistics.getRealTimeStats();
    
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No real-time stats data available',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Real-time stats retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getRealTimeStats:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getVendorPerformanceComparison = async (req, res) => {
  try {
    const stats = await Statistics.getVendorPerformanceComparison();
    
    if (!stats || (Array.isArray(stats) && stats.length === 0)) {
      return res.json({
        success: true,
        data: [],
        message: 'No vendor performance data available',
        noData: true
      });
    }
    
    res.json({
      success: true,
      data: stats,
      message: 'Vendor performance comparison retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getVendorPerformanceComparison:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

exports.getVendorMonitoringStats = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const { rows, total } = await Statistics.getVendorMonitoringStats(page, limit, search);
    if (!rows || (Array.isArray(rows) && rows.length === 0)) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        page,
        pageSize: limit,
        message: 'No vendor monitoring data available',
        noData: true
      });
    }
    res.json({
      success: true,
      data: rows,
      total,
      page,
      pageSize: limit,
      message: 'Vendor monitoring stats retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getVendorMonitoringStats:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message,
      noData: false
    });
  }
};

// Get vendor performance analytics
const getVendorAnalytics = async (req, res) => {
  try {
    const [vendors] = await pool.execute(`
      SELECT 
        u.user_id,
        u.name as vendor_name,
        u.email as vendor_email,
        u.phone as vendor_phone,
        vt.name_en as vendor_type,
        vt.commission_rate,
        COUNT(DISTINCT p.product_id) as total_products,
        (SELECT COUNT(DISTINCT o.order_id) FROM orders o JOIN order_items oi ON o.order_id = oi.order_id JOIN products p2 ON oi.product_id = p2.product_id WHERE p2.vendor_id = u.user_id) as total_orders,
        (SELECT COALESCE(SUM(oi.total_price), 0) FROM order_items oi JOIN orders o ON oi.order_id = o.order_id JOIN products p2 ON oi.product_id = p2.product_id WHERE p2.vendor_id = u.user_id) as total_revenue,
        COALESCE(SUM(vp.commission_amount), 0) as total_commission,
        COALESCE(SUM(vp.net_amount), 0) as total_net,
        COALESCE(AVG(vp.commission_rate), 0) as avg_commission_rate,
        COUNT(CASE WHEN vp.payment_status = 'paid' THEN 1 END) as paid_payments,
        COUNT(CASE WHEN vp.payment_status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN vp.payment_status = 'cancelled' THEN 1 END) as cancelled_payments,
        vs.status as subscription_status,
        vs.end_date as subscription_end,
        sp.name_en as package_name,
        sp.price as package_price,
        vs.max_products,
        u.created_at as registration_date
      FROM users u
      LEFT JOIN user_vendor_types uvt ON u.user_id = uvt.user_id
      LEFT JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
      LEFT JOIN products p ON u.user_id = p.vendor_id AND p.deleted = 0
      LEFT JOIN vendor_payments vp ON u.user_id = vp.vendor_id
      LEFT JOIN vendor_subscriptions vs ON u.user_id = vs.user_id AND vs.status = 'active'
      LEFT JOIN subscription_packages sp ON vs.package_id = sp.package_id
      WHERE u.role_id IN (3, 4, 5)
        AND uvt.user_id IS NOT NULL
      GROUP BY u.user_id, u.name, u.email, u.phone, vt.name_en, vt.commission_rate, vs.status, vs.end_date, sp.name_en, sp.price, vs.max_products, u.created_at
      ORDER BY total_revenue DESC
    `);

    // Get vendor performance over time (last 30 days)
    const [performanceData] = await pool.execute(`
      SELECT 
        DATE(o.placed_at) as date,
        COUNT(DISTINCT o.order_id) as orders,
        COALESCE(SUM(oi.total_price), 0) as revenue,
        COUNT(DISTINCT p.vendor_id) as active_vendors
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      JOIN products p ON oi.product_id = p.product_id
      JOIN users u ON p.vendor_id = u.user_id
      JOIN user_vendor_types uvt ON u.user_id = uvt.user_id
      WHERE o.placed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND u.role_id IN (3, 4, 5)
      GROUP BY DATE(o.placed_at)
      ORDER BY date DESC
    `);

    // Get top performing vendors by revenue
    const [topVendors] = await pool.execute(`
      SELECT 
        u.name as vendor_name,
        COALESCE(SUM(oi.total_price), 0) as total_revenue,
        COUNT(DISTINCT o.order_id) as total_orders,
        COALESCE(AVG(oi.total_price), 0) as avg_order_value
      FROM users u
      LEFT JOIN user_vendor_types uvt ON u.user_id = uvt.user_id
      LEFT JOIN products p ON u.user_id = p.vendor_id AND p.deleted = 0
      LEFT JOIN order_items oi ON p.product_id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.order_id
      WHERE u.role_id IN (3, 4, 5)
        AND uvt.user_id IS NOT NULL
      GROUP BY u.user_id, u.name
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    // Get vendor commission analytics
    const [commissionAnalytics] = await pool.execute(`
      SELECT 
        vt.name_en as vendor_type,
        COUNT(DISTINCT u.user_id) as vendor_count,
        COALESCE(SUM(vp.commission_amount), 0) as total_commission,
        COALESCE(AVG(vp.commission_rate), 0) as avg_commission_rate
      FROM vendor_types vt
      LEFT JOIN user_vendor_types uvt ON vt.vendor_type_id = uvt.vendor_type_id
      LEFT JOIN users u ON uvt.user_id = u.user_id
      LEFT JOIN vendor_payments vp ON u.user_id = vp.vendor_id
      WHERE u.role_id IN (3, 4, 5)
        AND uvt.user_id IS NOT NULL
      GROUP BY vt.vendor_type_id, vt.name_en
      ORDER BY total_commission DESC
    `);

    res.json({
      success: true,
      data: {
        vendors,
        performanceData,
        topVendors,
        commissionAnalytics
      }
    });
  } catch (error) {
    console.error('Error fetching vendor analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching vendor analytics' });
  }
};

// Get individual vendor analytics
const getVendorAnalyticsById = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const [vendorData] = await pool.execute(`
      SELECT 
        u.user_id,
        u.name as vendor_name,
        u.email as vendor_email,
        u.phone as vendor_phone,
        vt.name_en as vendor_type,
        vt.commission_rate,
        (SELECT COUNT(*) FROM products p WHERE p.vendor_id = u.user_id AND p.deleted = 0) as total_products,
        (SELECT COUNT(DISTINCT o.order_id) FROM orders o JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id WHERE p.vendor_id = u.user_id AND o.status = 'delivered') as total_orders,
        (SELECT COALESCE(SUM(vp.amount), 0) FROM vendor_payments vp WHERE vp.vendor_id = u.user_id AND vp.payment_status = 'paid') as total_revenue,
        (SELECT COALESCE(SUM(vp.commission_amount), 0) FROM vendor_payments vp WHERE vp.vendor_id = u.user_id AND vp.payment_status = 'paid') as total_commission,
        (SELECT COALESCE(SUM(vp.net_amount), 0) FROM vendor_payments vp WHERE vp.vendor_id = u.user_id AND vp.payment_status = 'paid') as total_net,
        COUNT(CASE WHEN vp.payment_status = 'paid' THEN 1 END) as paid_payments,
        COUNT(CASE WHEN vp.payment_status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN vp.payment_status = 'cancelled' THEN 1 END) as cancelled_payments,
        vs.status as subscription_status,
        vs.end_date as subscription_end,
        sp.name_en as package_name,
        sp.price as package_price,
        vs.max_products,
        u.created_at as registration_date
      FROM users u
      LEFT JOIN user_vendor_types uvt ON u.user_id = uvt.user_id
      LEFT JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
      LEFT JOIN vendor_payments vp ON u.user_id = vp.vendor_id
      LEFT JOIN vendor_subscriptions vs ON u.user_id = vs.user_id AND vs.status = 'active'
      LEFT JOIN subscription_packages sp ON vs.package_id = sp.package_id
      WHERE u.user_id = ? AND u.role_id IN (3, 4, 5)
      GROUP BY u.user_id, u.name, u.email, u.phone, vt.name_en, vt.commission_rate, vs.status, vs.end_date, sp.name_en, sp.price, vs.max_products, u.created_at
    `, [vendorId]);

    if (vendorData.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Get vendor's monthly performance
    const [monthlyPerformance] = await pool.execute(`
      SELECT 
        DATE_FORMAT(vp.created_at, '%Y-%m') as month,
        COUNT(DISTINCT vp.order_id) as orders,
        COALESCE(SUM(vp.amount), 0) as revenue,
        COALESCE(SUM(vp.commission_amount), 0) as commission
      FROM vendor_payments vp
      WHERE vp.vendor_id = ? AND vp.payment_status = 'paid'
      GROUP BY DATE_FORMAT(vp.created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, [vendorId]);

    // Get vendor's top products
    const [topProducts] = await pool.execute(`
      SELECT 
        p.product_id,
        p.name as product_name,
        p.price,
        COUNT(DISTINCT o.order_id) as times_ordered,
        COALESCE(SUM(oi.total_price), 0) as total_revenue
      FROM products p
      LEFT JOIN order_items oi ON p.product_id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status = 'delivered'
      WHERE p.vendor_id = ? AND p.deleted = 0
      GROUP BY p.product_id, p.name, p.price
      HAVING times_ordered > 0
      ORDER BY times_ordered DESC
      LIMIT 10
    `, [vendorId]);

    res.json({
      success: true,
      data: {
        vendor: vendorData[0],
        monthlyPerformance,
        topProducts
      }
    });
  } catch (error) {
    console.error('Error fetching vendor analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching vendor analytics' });
  }
};

module.exports = {
  getDashboardStats: exports.getDashboardStats,
  getSalesByMonth: exports.getSalesByMonth,
  getSalesBySeller: exports.getSalesBySeller,
  getTopSellingProducts: exports.getTopSellingProducts,
  getRevenueAnalytics: exports.getRevenueAnalytics,
  getCustomerAnalytics: exports.getCustomerAnalytics,
  getCustomerRetentionRate: exports.getCustomerRetentionRate,
  getCategoryAnalytics: exports.getCategoryAnalytics,
  getProductPerformanceAnalytics: exports.getProductPerformanceAnalytics,
  getVendorMonitoringStats: exports.getVendorMonitoringStats,
  getVendorAnalytics,
  getVendorAnalyticsById,
  getDashboardSummary: exports.getDashboardSummary,
  getRealTimeStats: exports.getRealTimeStats,
  getVendorPerformanceComparison: exports.getVendorPerformanceComparison
}; 