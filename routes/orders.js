// Orders routes 

const express = require('express');
const { 
    getOrders, 
    getOrderById, 
    createOrder, 
    updateOrderStatus, 
    cancelOrder,
    getOrderDeliveryInfo,
    confirmOrder,
    rejectOrder,
    assignDelivery,
    vendorAssignDelivery,
    getAvailableDeliveryForVendor,
    exportOrdersToExcel
} = require('../controllers/OrdersController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All order operations require authentication
router.use(authenticateJWT);

// Get orders - customers see their own, admins/vendors see all
router.get("/", getOrders);
router.get("/:id", getOrderById);

// Get delivery information for an order
router.get("/:order_id/delivery", getOrderDeliveryInfo);

// Create order - only customers
router.post("/", authorizeRoles([2, 3]), createOrder);

// Update order status - only admins and vendors
router.put("/:id/status", authorizeRoles([1, 3, 4, 5]), updateOrderStatus);

// Cancel order - only customers
router.patch("/:id/cancel", cancelOrder);

// Vendor confirms an order
router.put('/:id/confirm', authorizeRoles([3]), confirmOrder);
// Vendor rejects an order
router.put('/:id/reject', authorizeRoles([3]), rejectOrder);
// Assign delivery to a confirmed order (admin/support only)
router.post('/assign-delivery', authorizeRoles([1, 7]), assignDelivery);

// Vendor delivery assignment routes
router.get('/:order_id/available-delivery', authorizeRoles([3, 4, 5]), getAvailableDeliveryForVendor);
router.post('/vendor-assign-delivery', authorizeRoles([3, 4, 5]), vendorAssignDelivery);

// Vendor updates order status (dedicated endpoint)
router.post('/vendor-update-status', authorizeRoles([3, 4, 5]), require('../controllers/OrdersController').vendorUpdateOrderStatus);

// Vendor bulk status update endpoint
router.post('/vendor-bulk-update-status', authorizeRoles([3, 4, 5]), require('../controllers/OrdersController').vendorBulkUpdateOrderStatus);

// Export orders to Excel - available for all authenticated users (with role-based filtering)
router.get('/export/excel', exportOrdersToExcel);

module.exports = router; 