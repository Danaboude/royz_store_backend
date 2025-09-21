// Coupons routes 

const express = require('express');
const { 
    getAllCoupons, 
    getCouponById, 
    getCouponByCode,
    createCoupon, 
    updateCoupon, 
    deleteCoupon 
} = require('../controllers/CouponsController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Public routes - anyone can view coupons
router.get("/", getAllCoupons);
router.get("/code/:code", getCouponByCode);
router.get("/:id", getCouponById);

// Protected routes - only admins can manage coupons
router.post('/', authenticateJWT, authorizeRoles([1]), createCoupon);
router.put('/:id', authenticateJWT, authorizeRoles([1]), updateCoupon);
router.delete('/:id', authenticateJWT, authorizeRoles([1]), deleteCoupon);

module.exports = router; 