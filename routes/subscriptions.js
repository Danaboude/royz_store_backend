const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/SubscriptionController');
const { authenticateJWT } = require('../middleware/auth');

// Public routes (no authentication required)
router.get('/packages', subscriptionController.getAllPackages);
router.get('/packages/popular', subscriptionController.getPopularPackages);
router.get('/packages/vendor-type/:vendorTypeId', subscriptionController.getPackagesByVendorType);
router.get('/packages/:id', subscriptionController.getPackageById);
router.get('/vendor-types', subscriptionController.getVendorTypes);

// Protected routes (authentication required)
router.use(authenticateJWT);

// User subscription management
router.get('/my-subscriptions', subscriptionController.getUserSubscriptions);
router.get('/my-subscriptions/active', subscriptionController.getActiveSubscription);
router.get('/my-subscriptions/status', subscriptionController.checkSubscriptionStatus);
router.post('/subscribe', subscriptionController.subscribeToPackage);
router.put('/subscriptions/:id/cancel', subscriptionController.cancelSubscription);
router.put('/subscriptions/:id/renew', subscriptionController.renewSubscription);

// Admin routes (admin authentication required)
router.post('/packages', subscriptionController.createPackage);
router.put('/packages/:id', subscriptionController.updatePackage);
router.delete('/packages/:id', subscriptionController.deletePackage);
router.get('/subscriptions', subscriptionController.getAllSubscriptions);
router.get('/subscriptions/expired', subscriptionController.getExpiredSubscriptions);
router.get('/subscriptions/stats', subscriptionController.getSubscriptionStats);
router.post('/assign-subscription', subscriptionController.assignSubscriptionToVendor);

// Get vendor subscription status and product limits
router.get('/vendor-status', subscriptionController.getVendorSubscriptionStatus);

// Get current subscription for a vendor by user id (admin)
router.get('/vendor/:id/current', subscriptionController.getCurrentVendorSubscription);

module.exports = router; 