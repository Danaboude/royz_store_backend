const express = require('express');
const vendorProductsController = require('../controllers/vendorProductsController');
const { authenticateJWT, authorizeRoles, checkVendorSubscriptionAndProductLimit } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// List products for the authenticated vendor (with pagination/search)
router.get('/', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 20, search = '' } = req.query;
    const isAdmin = req.user.roleId === 1 || req.user.role === 1 || req.user.role_id === 1;
    const products = await vendorProductsController.getVendorProducts({ vendorId, page, limit, search, isAdmin });
    const total = products.length; // For now, use the length of the returned array
    res.json({ success: true, data: { products, total } });
  } catch (err) {
    next(err);
  }
});

// Add a new product for the authenticated vendor
router.post(
  '/',
  authenticateJWT,
  authorizeRoles([1, 11, 3, 4, 5]),
  checkVendorSubscriptionAndProductLimit,
  async (req, res, next) => {
    try {
      const vendorId = req.user.id;
      const product = await vendorProductsController.createProductForVendor({ vendorId, ...req.body });
      res.json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  }
);

// Edit a product (must belong to the authenticated vendor)
router.put('/:id', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const product = await vendorProductsController.updateProductForVendor({ vendorId, productId: req.params.id, ...req.body });
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// Delete a product (must belong to the authenticated vendor)
router.delete('/:id', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    await vendorProductsController.deleteProductForVendor({ vendorId, productId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Import products from Excel for the authenticated vendor
router.post('/import', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), upload.single('file'), async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const file = req.file;
    const result = await vendorProductsController.importProductsFromExcelForVendor(file, vendorId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Export products to Excel for the authenticated vendor
router.get('/export', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), async (req, res, next) => {
    try {
        const vendorId = req.user.id;
        const fileBuffer = await vendorProductsController.exportProductsToExcelForVendor(vendorId);
        res.setHeader('Content-Disposition', 'attachment; filename=vendor-products.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(fileBuffer);
    } catch (err) {
        next(err);
    }
});


router.post('/:id/media', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), upload.array('media'), async (req, res, next) => {
  try {
        const vendorId = req.user.id;
    const productId = req.params.id;
    const files = req.files; // Note: this is an array now
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    
    // Pass the files array to the controller
    const results = await vendorProductsController.uploadProductMediaForVendor({
      vendorId,
      productId,
      files,
      req
    });
    
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});


module.exports = router; 