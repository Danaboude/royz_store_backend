// Notifications routes 

const express = require('express');
const { body } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateFCMToken = [
  body('fcmToken').notEmpty().withMessage('FCM token is required'),
  body('deviceType').optional().isIn(['web', 'android', 'ios']).withMessage('Invalid device type')
];

const validateNotification = [
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 100 }).withMessage('Title too long'),
  body('body').notEmpty().withMessage('Body is required').isLength({ max: 500 }).withMessage('Body too long'),
  body('data').optional().isObject().withMessage('Data must be an object')
];

const validateUserNotification = [
  body('userId').isInt().withMessage('User ID must be an integer'),
  ...validateNotification
];

const validateRoleNotification = [
  body('roleId').isInt().withMessage('Role ID must be an integer'),
  ...validateNotification
];

// Public routes (require authentication)
router.post('/store-token', authenticateJWT, validateFCMToken, notificationController.storeFCMToken);
router.delete('/remove-token', authenticateJWT, validateFCMToken, notificationController.removeFCMToken);
router.get('/user-notifications', authenticateJWT, notificationController.getUserNotifications);
router.put('/mark-read/:notificationId', authenticateJWT, notificationController.markNotificationAsRead);
router.put('/mark-all-read', authenticateJWT, notificationController.markAllNotificationsAsRead);
router.get('/unread-count', authenticateJWT, notificationController.getUnreadNotificationCount);

// Admin only routes
router.post('/send-to-user', 
  authenticateJWT, 
  authorizeRoles([1]), // Admin only
  validateUserNotification, 
  notificationController.sendNotificationToUser
);

router.post('/send-to-role', 
  authenticateJWT, 
  authorizeRoles([1]), // Admin only
  validateRoleNotification, 
  notificationController.sendNotificationToRole
);

router.post('/send-to-vendors', 
  authenticateJWT, 
  authorizeRoles([1]), // Admin only
  validateNotification, 
  notificationController.sendNotificationToVendors
);

router.post('/send-to-customers', 
  authenticateJWT, 
  authorizeRoles([1]), // Admin only
  validateNotification, 
  notificationController.sendNotificationToCustomers
);

router.post('/send-to-all', 
  authenticateJWT, 
  authorizeRoles([1]), // Admin only
  validateNotification, 
  notificationController.sendNotificationToAllUsers
);

// Admin statistics routes
router.get('/stats', 
  authenticateJWT, 
  authorizeRoles([1]), // Admin only
  notificationController.getNotificationStats
);

router.get('/fcm-stats', 
  authenticateJWT, 
  authorizeRoles([1]), // Admin only
  notificationController.getFCMTokenStats
);

// Vendor-specific notification routes
router.get('/vendor/unread-count', 
  authenticateJWT, 
  authorizeRoles([3, 4, 5]), // Vendor roles only
  notificationController.getVendorUnreadNotificationCount
);

router.get('/vendor/notifications', 
  authenticateJWT, 
  authorizeRoles([3, 4, 5]), // Vendor roles only
  notificationController.getVendorNotifications
);

router.put('/vendor/mark-read/:notificationId', 
  authenticateJWT, 
  authorizeRoles([3, 4, 5]), // Vendor roles only
  notificationController.markVendorNotificationAsRead
);

router.put('/vendor/mark-all-read', 
  authenticateJWT, 
  authorizeRoles([3, 4, 5]), // Vendor roles only
  notificationController.markAllVendorNotificationsAsRead
);

// FCM token management for vendors
router.post('/vendor/fcm-token', 
  authenticateJWT, 
  authorizeRoles([3, 4, 5]), // Vendor roles only
  notificationController.saveVendorFCMToken
);

module.exports = router; 