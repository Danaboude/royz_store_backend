const express = require('express');
const { 
    getAllRoles, 
    getRoleById, 
    createRole, 
    updateRole, 
    deleteRole 
} = require('../controllers/RolesController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Public routes - anyone can view roles
router.get("/", getAllRoles);
router.get("/:id", getRoleById);

// Protected routes - only admins can manage roles
router.post('/', authenticateJWT, authorizeRoles([1]), createRole);
router.put('/:id', authenticateJWT, authorizeRoles([1]), updateRole);
router.delete('/:id', authenticateJWT, authorizeRoles([1]), deleteRole);

module.exports = router; 