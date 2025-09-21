// Users routes 

const express = require('express');
const { upload } = require('../middleware/upload');
const { 
    getAllUsers, 
    getUserById, 
    updateUser, 
    deleteUser,
    getVendorStatistics,
    getVendorStatisticsById,
    changeUserRole,
    getUsersByRole,
    changePassword,
    updateVendorPaymentStatus,
    getAllVendorTypes,
    getVendorById,
    updateVendor,
    deleteVendor,
    toggleVendorStatus
} = require('../controllers/UsersController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All user operations require authentication
router.use(authenticateJWT);

// Get all users - only admins
router.get("/", authorizeRoles([1]), getAllUsers);

// Get users by role - only admins
router.get("/role/:roleId", authorizeRoles([1]), getUsersByRole);

// Get vendor statistics - only admins
router.get("/vendors/stats", authorizeRoles([1]), getVendorStatistics);

// Get vendor statistics by ID - only admins
router.get("/vendors/:id/stats", authorizeRoles([1]), getVendorStatisticsById);

// Get all vendor types with subscription info - only admins
router.get("/vendors/all-types", authorizeRoles([1]), getAllVendorTypes);

// Vendor-specific routes - only admins
router.get("/vendors/:id", authorizeRoles([1]), getVendorById);
router.put("/vendors/:id", authorizeRoles([1]), updateVendor);
router.delete("/vendors/:id", authorizeRoles([1]), deleteVendor);
router.put("/vendors/:id/toggle-status", authorizeRoles([1]), toggleVendorStatus);

// Change password - users can change their own, admins can change any (must come before /:id)
router.put("/:id/password", changePassword);

// Change user role - only admins (must come before /:id)
router.put("/:id/role", authorizeRoles([1]), changeUserRole);

// Update vendor payment status - only admins
router.put("/vendor-payments/:payment_id/status", authorizeRoles([1]), updateVendorPaymentStatus);

// Get user by ID - users can view their own, admins can view any
router.get("/:id", getUserById);

// Update user - users can update their own, admins can update any
// Support both JSON and file uploads
router.put("/:id", upload.single('profile_image'), updateUser);

// Delete user - only admins
router.delete("/:id", authorizeRoles([1]), deleteUser);

module.exports = router; 