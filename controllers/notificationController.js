const notificationService = require('../services/notificationService');
const { body, validationResult } = require('express-validator');

class NotificationController {
  // Store FCM token for a user
  async storeFCMToken(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { fcmToken, deviceType = 'web' } = req.body;
      // Support both user_id and id in JWT
      const userId = req.user.user_id || req.user.id;

      const result = await notificationService.storeFCMToken(userId, fcmToken, deviceType);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'FCM token stored successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error storing FCM token:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Remove FCM token
  async removeFCMToken(req, res) {
    try {
      const { fcmToken } = req.body;
      const userId = req.user.user_id;

      const result = await notificationService.removeFCMToken(userId, fcmToken);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'FCM token removed successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error removing FCM token:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Send notification to single user (Admin only)
  async sendNotificationToUser(req, res) {
    try {

      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { userId, title, body, data = {} } = req.body;


      const result = await notificationService.sendNotificationToUser(userId, title, body, data);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Notification sent successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Send notification to users by role (Admin only)
  async sendNotificationToRole(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { roleId, title, body, data = {} } = req.body;

      const result = await notificationService.sendNotificationToRole(roleId, title, body, data);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Notification sent successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error sending notification to role:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Send notification to all vendors (Admin only)
  async sendNotificationToVendors(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { title, body, data = {} } = req.body;

      const result = await notificationService.sendNotificationToVendors(title, body, data);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Notification sent to vendors successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error sending notification to vendors:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Send notification to all customers (Admin only)
  async sendNotificationToCustomers(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { title, body, data = {} } = req.body;

      const result = await notificationService.sendNotificationToCustomers(title, body, data);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Notification sent to customers successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error sending notification to customers:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Send notification to all users (Admin only)
  async sendNotificationToAllUsers(req, res) {
    try {

      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { title, body, data = {} } = req.body;
   

      const result = await notificationService.sendNotificationToAllUsers(title, body, data);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Notification sent to all users successfully',
          data: result
        });
      } else {
                res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('❌ [sendNotificationToAllUsers] Error:', error);
      console.error('❌ [sendNotificationToAllUsers] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get user notifications
  async getUserNotifications(req, res) {
    try {
      const userId = req.user.user_id;
      const { limit = 50, offset = 0 } = req.query;

      const notifications = await notificationService.getUserNotifications(userId, parseInt(limit), parseInt(offset));
      
      res.json({
        success: true,
        data: notifications
      });
    } catch (error) {
      console.error('Error getting user notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Mark notification as read
  async markNotificationAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.user_id;

      const result = await notificationService.markNotificationAsRead(notificationId, userId);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Notification marked as read'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(req, res) {
    try {
      const userId = req.user.user_id;

      const result = await notificationService.markAllNotificationsAsRead(userId);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'All notifications marked as read'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get unread notification count
  async getUnreadNotificationCount(req, res) {
    try {
      const userId = req.user.user_id;

      const count = await notificationService.getUnreadNotificationCount(userId);
      
      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get notification statistics (Admin only)
  async getNotificationStats(req, res) {
    try {
            const { pool } = require('../db/db');
      
      // Check if tables exist first
            const [tables] = await pool.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('notifications', 'user_fcm_tokens')
      `);
      
            const tableNames = tables.map(t => t.TABLE_NAME);
      
      let totalNotifications = 0;
      let unreadNotifications = 0;
      let notificationsByType = [];
      let recentNotifications = 0;
      let activeTokens = 0;
      
      // Get total notifications if table exists
      if (tableNames.includes('notifications')) {
                const [totalResult] = await pool.query('SELECT COUNT(*) as count FROM notifications');
        totalNotifications = totalResult[0].count;
                const [unreadResult] = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');
        unreadNotifications = unreadResult[0].count;
                const [typeResult] = await pool.query(`
          SELECT type, COUNT(*) as count 
          FROM notifications 
          GROUP BY type
        `);
        notificationsByType = typeResult;
                const [recentResult] = await pool.query(`
          SELECT COUNT(*) as count 
          FROM notifications 
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        recentNotifications = recentResult[0].count;
              } else {
              }
      
      // Get active FCM tokens if table exists
      if (tableNames.includes('user_fcm_tokens')) {
                const [tokensResult] = await pool.query('SELECT COUNT(*) as count FROM user_fcm_tokens WHERE is_active = 1');
        activeTokens = tokensResult[0].count;
              } else {
              }
      
      const responseData = {
        totalNotifications,
        unreadNotifications,
        notificationsByType,
        recentNotifications,
        activeTokens
      };
      
            res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('❌ [getNotificationStats] Error:', error);
      console.error('❌ [getNotificationStats] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  // Get FCM token statistics (Admin only)
  async getFCMTokenStats(req, res) {
    try {
            const { pool } = require('../db/db');
      
      // Check if user_fcm_tokens table exists
            const [tables] = await pool.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'user_fcm_tokens'
      `);
      
            let tokensByDevice = [];
      let tokensByRole = [];
      
      if (tables.length > 0) {
                // Get tokens by device type
        const [deviceResult] = await pool.query(`
          SELECT device_type, COUNT(*) as count 
          FROM user_fcm_tokens 
          WHERE is_active = 1 
          GROUP BY device_type
        `);
        tokensByDevice = deviceResult;
                        // Get tokens by role
        const [roleResult] = await pool.query(`
          SELECT u.role_id, COUNT(*) as count 
          FROM user_fcm_tokens uft
          JOIN users u ON uft.user_id = u.user_id
          WHERE uft.is_active = 1
          GROUP BY u.role_id
        `);
        tokensByRole = roleResult;
              } else {
              }
      
      const responseData = {
        tokensByDevice,
        tokensByRole
      };
      
            res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('❌ [getFCMTokenStats] Error:', error);
      console.error('❌ [getFCMTokenStats] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  // Vendor-specific notification methods
  async getVendorUnreadNotificationCount(req, res) {
    try {
      const userId = req.user.user_id;
      const result = await notificationService.getVendorUnreadNotificationCount(userId);
      
      if (result.success) {
        res.json({
          success: true,
          count: result.count
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error getting vendor unread notification count:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getVendorNotifications(req, res) {
    try {
      const userId = req.user.user_id;
      const { limit = 50, offset = 0 } = req.query;
      
      const result = await notificationService.getVendorNotifications(userId, parseInt(limit), parseInt(offset));
      
      if (result.success) {
        res.json({
          success: true,
          notifications: result.notifications
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error getting vendor notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async markVendorNotificationAsRead(req, res) {
    try {
      const userId = req.user.user_id;
      const { notificationId } = req.params;
      
      const result = await notificationService.markVendorNotificationAsRead(notificationId, userId);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Notification marked as read'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error marking vendor notification as read:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async markAllVendorNotificationsAsRead(req, res) {
    try {
      const userId = req.user.user_id;
      
      const result = await notificationService.markAllVendorNotificationsAsRead(userId);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'All notifications marked as read'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error marking all vendor notifications as read:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async saveVendorFCMToken(req, res) {
    try {
      const userId = req.user.user_id;
      const { fcm_token, device_type = 'android' } = req.body;
      
      if (!fcm_token) {
        return res.status(400).json({
          success: false,
          error: 'FCM token is required'
        });
      }
      
      const result = await notificationService.saveVendorFCMToken(userId, fcm_token, device_type);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'FCM token saved successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error saving vendor FCM token:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new NotificationController(); 