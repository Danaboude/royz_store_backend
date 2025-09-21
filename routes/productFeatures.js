const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const {
    getProductFeatures,
    getFeatureById,
    createFeature,
    createBulkFeatures,
    updateFeature,
    deleteFeature,
    deleteProductFeatures
} = require('../controllers/ProductFeaturesController');

// Get all features for a product (public)
router.get('/products/:productId/features', getProductFeatures);

// Get a specific feature (public)
router.get('/features/:featureId', getFeatureById);

// Create a new feature (vendor/admin only)
router.post('/products/:productId/features', authenticateJWT, createFeature);

// Create multiple features at once (vendor/admin only)
router.post('/products/:productId/features/bulk', authenticateJWT, createBulkFeatures);

// Update a feature (vendor/admin only)
router.put('/features/:featureId', authenticateJWT, updateFeature);

// Delete a feature (vendor/admin only)
router.delete('/features/:featureId', authenticateJWT, deleteFeature);

// Delete all features for a product (vendor/admin only)
router.delete('/products/:productId/features', authenticateJWT, deleteProductFeatures);

module.exports = router; 