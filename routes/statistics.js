const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

// Admin-only routes
router.get('/dashboard', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getDashboardStats);
router.get('/sales-by-month', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getSalesByMonth);
router.get('/sales-by-seller', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getSalesBySeller);
router.get('/top-selling-products', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getTopSellingProducts);
router.get('/revenue-analytics', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getRevenueAnalytics);
router.get('/customer-analytics', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getCustomerAnalytics);
router.get('/customer-retention', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getCustomerRetentionRate);
router.get('/product-performance', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getProductPerformanceAnalytics);
router.get('/category-analytics', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getCategoryAnalytics);
router.get('/dashboard-summary', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getDashboardSummary);
router.get('/real-time-stats', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getRealTimeStats);
router.get('/vendor-performance', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getVendorPerformanceComparison);
router.get('/product-performance-analytics', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getProductPerformanceAnalytics);
router.get('/vendor-monitoring', authenticateJWT, authorizeRoles([1, 10]), statisticsController.getVendorMonitoringStats);

// Vendor Analytics Routes (admin + vendors)
router.get('/vendor-analytics', authenticateJWT, authorizeRoles([1, 3, 4, 5]), statisticsController.getVendorAnalytics);
router.get('/vendor-analytics/:vendorId', authenticateJWT, authorizeRoles([1, 3, 4, 5]), statisticsController.getVendorAnalyticsById);

module.exports = router; 