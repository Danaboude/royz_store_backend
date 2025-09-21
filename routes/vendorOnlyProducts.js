const express = require('express');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const vendorProductsController = require('../controllers/vendorProductsController');
const router = express.Router();

// List products for the authenticated vendor (with pagination/search)
router.get('/', authenticateJWT, authorizeRoles([3, 4, 5]), async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 20, search = '' } = req.query;
    const products = await vendorProductsController.getVendorProducts({ vendorId, page, limit, search, isAdmin: false });
    const total = products.length;
    res.json({ success: true, data: { products, total } });
  } catch (err) {
    next(err);
  }
});

module.exports = router; 