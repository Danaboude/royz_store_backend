const express = require('express');
const router = express.Router();
const favoritesController = require('../controllers/favoritesController');
const { authenticateJWT } = require('../middleware/auth');

// Get all favorite product IDs for the current user
router.get('/', authenticateJWT, favoritesController.getFavorites);
// Get favorited products with full details
router.get('/products', authenticateJWT, favoritesController.getFavoritedProducts);
// Add a product to favorites
router.post('/', authenticateJWT, favoritesController.addFavorite);
// Remove a product from favorites
router.delete('/:product_id', authenticateJWT, favoritesController.removeFavorite);

module.exports = router; 