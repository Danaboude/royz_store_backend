const { pool } = require('../db/db');
const { messaging, sendNotification, sendNotificationToMultipleTokens, sendNotificationToTopic } = require('../config/firebase');

class NotificationService {
  // Store FCM token for a user
  async storeFCMToken(userId, fcmToken, deviceType = 'web') {
    try {
      console.log('🔍 [storeFCMToken] Storing token for user:', userId);
      console.log('🔍 [storeFCMToken] Device type:', deviceType);
      
      const query = `
        INSERT INTO user_fcm_tokens (user_id, fcm_token, device_type, created_at) 
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        fcm_token = VALUES(fcm_token), 
        device_type = VALUES(device_type), 
        updated_at = NOW()
      `;
      
      await pool.execute(query, [userId, fcmToken, deviceType]);
      console.log('✅ [storeFCMToken] Token stored successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ [storeFCMToken] Error storing FCM token:', error);
      return { success: false, error: error.message };
    }
  }

  // Get FCM tokens for a user
  async getUserFCMTokens(userId) {
    try {
      const query = 'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ? AND is_active = 1';
      const [rows] = await pool.execute(query, [userId]);
      return rows.map(row => row.fcm_token);
    } catch (error) {
      console.error('Error getting user FCM tokens:', error);
      return [];
    }
  }

  // Get FCM tokens for users by role
  async getFCMTokensByRole(roleId) {
    try {
      const query = `
        SELECT DISTINCT uft.fcm_token 
        FROM user_fcm_tokens uft
        JOIN users u ON uft.user_id = u.user_id
        WHERE u.role_id = ? AND uft.is_active = 1
      `;
      const [rows] = await pool.execute(query, [roleId]);
      return rows.map(row => row.fcm_token);
    } catch (error) {
      console.error('Error getting FCM tokens by role:', error);
      return [];
    }
  }

  // Get FCM tokens for vendors (role_id 3, 4, 5)
  async getVendorFCMTokens() {
    try {
      const query = `
        SELECT DISTINCT uft.fcm_token 
        FROM user_fcm_tokens uft
        JOIN users u ON uft.user_id = u.user_id
        WHERE u.role_id IN (3, 4, 5) AND uft.is_active = 1
      `;
      const [rows] = await pool.execute(query);
      return rows.map(row => row.fcm_token);
    } catch (error) {
      console.error('Error getting vendor FCM tokens:', error);
      return [];
    }
  }

  // Get FCM tokens for customers (role_id 2)
  async getCustomerFCMTokens() {
    try {
      const query = `
        SELECT DISTINCT uft.fcm_token 
        FROM user_fcm_tokens uft
        JOIN users u ON uft.user_id = u.user_id
        WHERE u.role_id = 2 AND uft.is_active = 1
      `;
      const [rows] = await pool.execute(query);
      return rows.map(row => row.fcm_token);
    } catch (error) {
      console.error('Error getting customer FCM tokens:', error);
      return [];
    }
  }

  // Save notification to database
  async saveNotification(userId, message, type, relatedId = null) {
    try {
      console.log('🔍 [saveNotification] Saving notification for user:', userId);
      console.log('🔍 [saveNotification] Message:', message);
      console.log('🔍 [saveNotification] Type:', type);
      
      const query = `
        INSERT INTO notifications (user_id, message, type, related_id, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `;
      
      const [result] = await pool.execute(query, [userId, message, type, relatedId]);
      console.log('✅ [saveNotification] Notification saved with ID:', result.insertId);
      return { success: true, notificationId: result.insertId };
    } catch (error) {
      console.error('❌ [saveNotification] Error saving notification:', error);
      console.error('❌ [saveNotification] Error stack:', error.stack);
      return { success: false, error: error.message };
    }
  }

  // Send notification to single user
  async sendNotificationToUser(userId, title, body, data = {}) {
    try {
      const tokens = await this.getUserFCMTokens(userId);
      if (tokens.length === 0) {
        return { success: false, error: 'No FCM tokens found for user' };
      }

      const notification = { title, body };
      const result = await sendNotificationToMultipleTokens(tokens, notification, data);
      
      // Save to database
      await this.saveNotification(userId, body, data.type || 'message', data.relatedId);
      
      return result;
    } catch (error) {
      console.error('Error sending notification to user:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to users by role
  async sendNotificationToRole(roleId, title, body, data = {}) {
    try {
      const tokens = await this.getFCMTokensByRole(roleId);
      if (tokens.length === 0) {
        return { success: false, error: 'No FCM tokens found for role' };
      }

      const notification = { title, body };
      const result = await sendNotificationToMultipleTokens(tokens, notification, data);
      
      // Save to database for all users with this role
      const users = await this.getUsersByRole(roleId);
      for (const user of users) {
        await this.saveNotification(user.user_id, body, data.type || 'message', data.relatedId);
      }
      
      return result;
    } catch (error) {
      console.error('Error sending notification to role:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to all vendors
  async sendNotificationToVendors(title, body, data = {}) {
    try {
      const tokens = await this.getVendorFCMTokens();
      if (tokens.length === 0) {
        return { success: false, error: 'No vendor FCM tokens found' };
      }

      const notification = { title, body };
      const result = await sendNotificationToMultipleTokens(tokens, notification, data);
      
      // Save to database for all vendors
      const vendors = await this.getVendors();
      for (const vendor of vendors) {
        await this.saveNotification(vendor.user_id, body, data.type || 'message', data.relatedId);
      }
      
      return result;
    } catch (error) {
      console.error('Error sending notification to vendors:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to all customers
  async sendNotificationToCustomers(title, body, data = {}) {
    try {
      const tokens = await this.getCustomerFCMTokens();
      if (tokens.length === 0) {
        return { success: false, error: 'No customer FCM tokens found' };
      }

      const notification = { title, body };
      const result = await sendNotificationToMultipleTokens(tokens, notification, data);
      
      // Save to database for all customers
      const customers = await this.getCustomers();
      for (const customer of customers) {
        await this.saveNotification(customer.user_id, body, data.type || 'message', data.relatedId);
      }
      
      return result;
    } catch (error) {
      console.error('Error sending notification to customers:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to all users
  async sendNotificationToAllUsers(title, body, data = {}) {
    try {

      
      const query = 'SELECT DISTINCT fcm_token FROM user_fcm_tokens WHERE is_active = 1';
      
      const [rows] = await pool.execute(query);
      const tokens = rows.map(row => row.fcm_token);
      
      if (tokens.length === 0) {
        return { success: false, error: 'No FCM tokens found' };
      }

      const notification = { title, body };
      const result = await sendNotificationToMultipleTokens(tokens, notification, data);
      
      // Save to database for all users
      const users = await this.getAllUsers();
      
      for (const user of users) {
        await this.saveNotification(user.user_id, body, data.type || 'message', data.relatedId);
      }
      
      return result;
    } catch (error) {
 
      return { success: false, error: error.message };
    }
  }

  // Helper methods for getting users
  async getUsersByRole(roleId) {
    try {
      const query = 'SELECT user_id FROM users WHERE role_id = ?';
      const [rows] = await pool.execute(query, [roleId]);
      return rows;
    } catch (error) {
      console.error('Error getting users by role:', error);
      return [];
    }
  }

  async getVendors() {
    try {
      const query = 'SELECT user_id FROM users WHERE role_id IN (3, 4, 5)';
      const [rows] = await pool.execute(query);
      return rows;
    } catch (error) {
      console.error('Error getting vendors:', error);
      return [];
    }
  }

  async getCustomers() {
    try {
      const query = 'SELECT user_id FROM users WHERE role_id = 2';
      const [rows] = await pool.execute(query);
      return rows;
    } catch (error) {
      console.error('Error getting customers:', error);
      return [];
    }
  }

  async getAllUsers() {
    try {
      const query = 'SELECT user_id FROM users';
      const [rows] = await pool.execute(query);
      return rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  // Get user notifications
  async getUserNotifications(userId, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      const [rows] = await pool.execute(query, [userId, limit, offset]);
      return rows;
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId, userId) {
    try {
      const query = 'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?';
      await pool.execute(query, [notificationId, userId]);
      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  }

  // Mark all notifications as read for user
  async markAllNotificationsAsRead(userId) {
    try {
      const query = 'UPDATE notifications SET is_read = 1 WHERE user_id = ?';
      await pool.execute(query, [userId]);
      return { success: true };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error: error.message };
    }
  }

  // Get unread notification count
  async getUnreadNotificationCount(userId) {
    try {
      const query = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0';
      const [rows] = await pool.execute(query, [userId]);
      return rows[0].count;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  // Remove FCM token
  async removeFCMToken(userId, fcmToken) {
    try {
      const query = 'UPDATE user_fcm_tokens SET is_active = 0 WHERE user_id = ? AND fcm_token = ?';
      await pool.execute(query, [userId, fcmToken]);
      return { success: true };
    } catch (error) {
      console.error('Error removing FCM token:', error);
      return { success: false, error: error.message };
    }
  }

  // Vendor-specific notification methods
  async getVendorUnreadNotificationCount(userId) {
    try {
      
      const query = `
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE (user_id = ? OR related_id IN (
          SELECT product_id FROM products WHERE vendor_id = ? AND deleted = 0
        )) 
        AND is_read = 0
      `;
      
      const [rows] = await pool.execute(query, [userId, userId]);
      const count = rows[0].count;
      
      return { success: true, count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getVendorNotifications(userId, limit = 50, offset = 0) {
    try {
      
      const query = `
        SELECT n.*, p.product_name as related_product_name
        FROM notifications n
        LEFT JOIN products p ON n.related_id = p.product_id
        WHERE (n.user_id = ? OR n.related_id IN (
          SELECT product_id FROM products WHERE vendor_id = ? AND deleted = 0
        ))
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const [rows] = await pool.execute(query, [userId, userId, limit, offset]);
      
      return { success: true, notifications: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async markVendorNotificationAsRead(notificationId, userId) {
    try {
      
      const query = `
        UPDATE notifications 
        SET is_read = 1, updated_at = NOW() 
        WHERE notification_id = ? AND (user_id = ? OR related_id IN (
          SELECT product_id FROM products WHERE vendor_id = ? AND deleted = 0
        ))
      `;
      
      const [result] = await pool.execute(query, [notificationId, userId, userId]);
      
      if (result.affectedRows > 0) {
        return { success: true };
      } else {
        return { success: false, error: 'Notification not found or unauthorized' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async markAllVendorNotificationsAsRead(userId) {
    try {
      
      const query = `
        UPDATE notifications 
        SET is_read = 1, updated_at = NOW() 
        WHERE (user_id = ? OR related_id IN (
          SELECT product_id FROM products WHERE vendor_id = ? AND deleted = 0
        )) AND is_read = 0
      `;
      
      const [result] = await pool.execute(query, [userId, userId]);
      
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveVendorFCMToken(userId, fcmToken, deviceType = 'android') {
    try {
      
      // Check if token already exists for this user
      const checkQuery = `
        SELECT fcm_token_id FROM fcm_tokens 
        WHERE user_id = ? AND device_type = ?
      `;
      
      const [existingTokens] = await pool.execute(checkQuery, [userId, deviceType]);
      
      if (existingTokens.length > 0) {
        // Update existing token
        const updateQuery = `
          UPDATE fcm_tokens 
          SET fcm_token = ?, updated_at = NOW() 
          WHERE user_id = ? AND device_type = ?
        `;
        
        await pool.execute(updateQuery, [fcmToken, userId, deviceType]);
      } else {
        // Insert new token
        const insertQuery = `
          INSERT INTO fcm_tokens (user_id, fcm_token, device_type, created_at, updated_at) 
          VALUES (?, ?, ?, NOW(), NOW())
        `;
        
        await pool.execute(insertQuery, [userId, fcmToken, deviceType]);
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ [saveVendorFCMToken] Error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService(); 