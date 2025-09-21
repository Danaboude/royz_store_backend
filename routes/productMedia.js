const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
    getProductMedia,
    getProductImages,
    getProductVideos,
    getMainProductImage,
    getMediaById,
    createMedia,
    createBulkMedia,
    updateMedia,
    deleteMedia,
    deleteProductMedia,
    uploadProductMedia,
    uploadMediaWithoutProduct
} = require('../controllers/ProductMediaController');

// Get all media for a product (public)
router.get('/products/:productId/media', getProductMedia);

// Get product images only (public)
router.get('/products/:productId/images', getProductImages);

// Get product videos only (public)
router.get('/products/:productId/videos', getProductVideos);

// Get main product image (public)
router.get('/products/:productId/main-image', getMainProductImage);

// Get a specific media item (public)
router.get('/media/:mediaId', getMediaById);

// Upload product media files without product ID (for new products)
router.post('/upload', authenticateJWT, upload.array('media', 10), uploadMediaWithoutProduct);

// Upload product media files (vendor/admin only)
router.post('/products/:productId/upload', authenticateJWT, upload.array('media', 10), uploadProductMedia);

// Create a new media item (vendor/admin only)
router.post('/products/:productId/media', authenticateJWT, createMedia);

// Create multiple media items at once (vendor/admin only)
router.post('/products/:productId/media/bulk', authenticateJWT, createBulkMedia);

// Update a media item (vendor/admin only)
router.put('/media/:mediaId', authenticateJWT, updateMedia);

// Delete a media item (vendor/admin only)
router.delete('/media/:mediaId', authenticateJWT, deleteMedia);

// Delete all media for a product (vendor/admin only)
router.delete('/products/:productId/media', authenticateJWT, deleteProductMedia);

module.exports = router; 