// Payments routes 

const express = require('express');
const { 
    getPayments, 
    getPaymentById, 
    createPayment, 
    updatePaymentStatus,
    getSubscriptionPayments,
    getVendorPayments,
    activateSubscriptionPayment
} = require('../controllers/PaymentsController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All payment operations require authentication
router.use(authenticateJWT);

// Admin and Order Manager: List all subscription payments
router.get('/subscription-payments', authorizeRoles([1, 10]), getSubscriptionPayments);
// Admin and Order Manager: List all vendor payments
router.get('/vendor-payments', authorizeRoles([1, 10]), getVendorPayments);
// Admin and Order Manager: Activate a subscription payment
router.put('/subscription-payments/:id/activate', authorizeRoles([1, 10]), activateSubscriptionPayment);

// Get payments - customers see their own, admins/vendors see all
router.get("/", getPayments);
router.get("/:id", getPaymentById);

// Create payment - only customers
router.post("/", authorizeRoles([3]), createPayment);

// Update payment status - only admins and vendors
router.put("/:id/status", authorizeRoles([1, 3, 4, 5]), updatePaymentStatus);

// Debug endpoint to confirm router is loaded
router.get('/debug', (req, res) => {
  res.json({ message: 'Payments router is active', time: new Date().toISOString() });
});

// Debug endpoint to check authentication and show user info
router.get('/debug-auth', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No token or invalid token', message: 'You must provide a valid Authorization token.' });
  }
  res.json({ message: 'Authenticated', user: req.user });
});

module.exports = router; 