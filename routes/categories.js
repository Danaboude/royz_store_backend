// Categories routes 

const express = require('express');
const { 
    getAllCategories, 
    getCategoryById, 
    createCategory, 
    updateCategory, 
    deleteCategory, 
    reorderCategories 
} = require('../controllers/CategoriesController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Public routes - anyone can view categories (now returns both English and Arabic names/descriptions)
router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

// Protected routes - only admins can manage categories (must provide both English and Arabic names)
router.post('/', authenticateJWT, authorizeRoles([1]), createCategory);
// Reorder categories (admin only) - must be before :id route
router.put('/order', authenticateJWT, authorizeRoles([1]), reorderCategories);
router.put('/:id', authenticateJWT, authorizeRoles([1]), updateCategory);
router.delete('/:id', authenticateJWT, authorizeRoles([1]), deleteCategory);

module.exports = router; 