const express = require('express');
const { 
    getAllProducts, 
    getProductById, 
    createProduct, 
    updateProduct, 
    deleteProduct, 
    searchProducts,
    getNewProducts,
    getBestSellingProducts,
    getDealOfferProducts,
    getDiscountedProducts,
    updateProductSpecialCategories,
    updateProductDiscount,
    removeProductDiscount,
    getProductsByCategory,
    getGiftProducts,
    getProductDetails,
    updateProductWithMedia,
    exportProductsToExcel,
    downloadExcelTemplate,
    importProductsFromExcel,
    upload,
    createProductWithMedia,
    patchProduct
} = require('../controllers/productsController');
const { authenticateJWT, authorizeRoles, checkVendorSubscriptionAndProductLimit } = require('../middleware/auth');

const router = express.Router();

// Public routes - anyone can view products
router.get("/", getAllProducts);
router.get("/search", searchProducts);
router.get("/new", getNewProducts);
router.get("/best-selling", getBestSellingProducts);
router.get("/deals", getDealOfferProducts);
router.get("/discounted", getDiscountedProducts);
router.get("/category/:categoryId", getProductsByCategory);
router.get("/gift", getGiftProducts);
router.get("/:id", getProductById);
router.get("/:id/details", getProductDetails);
router.patch('/:id', patchProduct);

// Protected routes - only vendors, admins and product managers can manage products
router.post('/', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), checkVendorSubscriptionAndProductLimit, createProduct);
router.post('/with-media', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), checkVendorSubscriptionAndProductLimit, createProductWithMedia);
router.put('/:id', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), updateProduct);
router.put('/:id/with-media', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), updateProductWithMedia);
router.delete('/:id', authenticateJWT, authorizeRoles([1, 11, 3, 4, 5]), deleteProduct);

// Admin and Product Manager routes - manage special categories and discounts
router.put('/:id/special-categories', authenticateJWT, authorizeRoles([1, 11]), updateProductSpecialCategories);
router.put('/:id/discount', authenticateJWT, authorizeRoles([1, 11]), updateProductDiscount);
router.delete('/:id/discount', authenticateJWT, authorizeRoles([1, 11]), removeProductDiscount);

// Export/Import routes - admin and product manager only
router.get('/export/excel', authenticateJWT, authorizeRoles([1,4,3,5, 11]), exportProductsToExcel);
router.get('/import/template', authenticateJWT, authorizeRoles([1,4,3,5, 11]), downloadExcelTemplate);
router.post('/import/excel', authenticateJWT, authorizeRoles([1,4,3,5, 11]), upload.single('file'), importProductsFromExcel);

module.exports = router;
