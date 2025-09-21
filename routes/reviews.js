// Reviews routes 

const express = require('express');
const { 
    getProductReviews, 
    getReviewById, 
    createReview, 
    updateReview, 
    deleteReview,
    getAllUserReviews
} = require('../controllers/ReviewsController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Public routes - anyone can view product reviews
router.get("/product/:product_id", getProductReviews);

// Protected routes - authentication required for individual review operations
router.get("/:id", authenticateJWT, getReviewById);

// Create review - only customers
router.post("/", authenticateJWT, authorizeRoles([3]), createReview);

// Update review - only customers and admins can update
router.put("/:id", authenticateJWT, authorizeRoles([1, 3]), updateReview);

// Delete review - customers can delete their own, vendors can delete reviews for their products, admins can delete any
router.delete("/:id", authenticateJWT, authorizeRoles([1, 3, 4, 5]), deleteReview);

// Public route to get all user reviews
router.get('/', getAllUserReviews);

module.exports = router; 