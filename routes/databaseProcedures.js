const express = require('express');
const router = express.Router();
const DatabaseProceduresController = require('../controllers/DatabaseProceduresController');
const auth = require('../middleware/auth');

// Routes for database procedures and functions
// All routes require authentication

// Update delivery status using procedure
router.post('/delivery/update-status', auth.authenticateJWT, DatabaseProceduresController.updateDeliveryStatusWithProcedure);

// Get order total using function
router.get('/orders/:order_id/total', auth.authenticateJWT, DatabaseProceduresController.getOrderTotalWithFunction);

// Get vendor commission rate using function
router.get('/vendors/:user_id/commission-rate', auth.authenticateJWT, DatabaseProceduresController.getVendorCommissionRateWithFunction);

// Check if vendor is active using function
router.get('/vendors/:user_id/active-status', auth.authenticateJWT, DatabaseProceduresController.checkVendorActiveStatus);

// Get delivery zone fee using function
router.get('/delivery-zones/:zone_id/fee', auth.authenticateJWT, DatabaseProceduresController.getDeliveryZoneFeeWithFunction);

module.exports = router; 