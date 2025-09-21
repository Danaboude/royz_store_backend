const enhancedNotificationService = require('./enhancedNotificationService');
const { pool } = require('../db/db');

class NotificationProcessor {
  // Process all pending notifications
  async processAllPendingNotifications() {
    try {
      
      const result = await enhancedNotificationService.processPendingNotifications();
      
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Process notifications for specific order
  async processOrderNotifications(orderId) {
    try {
      
      // Get order details
      const [orderRows] = await pool.execute(`
        SELECT o.*, u.name as customer_name, u.email as customer_email
        FROM orders o
        JOIN users u ON o.customer_id = u.user_id
        WHERE o.order_id = ?
      `, [orderId]);
      
      if (orderRows.length === 0) {
        return { success: false, error: 'Order not found' };
      }
      
      const order = orderRows[0];
      
      // Send notifications for this order
      const results = {
        customer: await enhancedNotificationService.sendOrderStatusChangeNotification(
          orderId, 
          order.status, 
          order.customer_id
        ),
        vendor: await enhancedNotificationService.sendVendorOrderStatusNotification(
          orderId, 
          order.status
        )
      };
      
      // Add delivery notification if delivery personnel is assigned
      if (order.delivery_id) {
        results.delivery = await enhancedNotificationService.sendDeliveryOrderStatusNotification(
          orderId, 
          order.status
        );
      }
      
      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Process low stock notifications
  async processLowStockNotifications() {
    try {
      
      // Find products with low stock
      const [lowStockProducts] = await pool.execute(`
        SELECT p.*, u.name as vendor_name, u.email as vendor_email
        FROM products p
        JOIN users u ON p.vendor_id = u.user_id
        WHERE p.stock <= 5 AND p.stock > 0 AND p.is_active = 1
      `);
      
      let processedCount = 0;
      let successCount = 0;
      
      for (const product of lowStockProducts) {
        try {
          const result = await enhancedNotificationService.sendLowStockNotification(
            product.product_id, 
            product.vendor_id
          );
          
          processedCount++;
          if (result.success) {
            successCount++;
          }
          
        } catch (error) {
        }
      }
      
      
      return {
        success: true,
        processed: processedCount,
        successful: successCount
      };
    } catch (error) {
      console.error('❌ [NotificationProcessor] Error processing low stock notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Process abandoned cart notifications
  async processAbandonedCartNotifications() {
    try {
      
      // Find users with abandoned carts (older than 24 hours)
      const [abandonedCarts] = await pool.execute(`
        SELECT DISTINCT c.user_id, u.name as user_name, u.email as user_email,
               COUNT(ci.cart_item_id) as item_count
        FROM carts c
        JOIN cart_items ci ON c.cart_id = ci.cart_id
        JOIN users u ON c.user_id = u.user_id
        WHERE c.updated_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND c.is_active = 1
        GROUP BY c.user_id
        HAVING item_count > 0
      `);
      
      let processedCount = 0;
      let successCount = 0;
      
      for (const cart of abandonedCarts) {
        try {
          const result = await enhancedNotificationService.sendAbandonedCartNotification(cart.user_id);
          
          processedCount++;
          if (result.success) {
            successCount++;
          }
          
        } catch (error) {
          console.error(`❌ [NotificationProcessor] Error sending abandoned cart notification for user ${cart.user_id}:`, error);
        }
      }
      
      
      return {
        success: true,
        processed: processedCount,
        successful: successCount
      };
    } catch (error) {
      console.error('❌ [NotificationProcessor] Error processing abandoned cart notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Process order reminder notifications
  async processOrderReminderNotifications() {
    try {
      
      // Find delivered orders from 7 days ago that haven't been reviewed
      const [deliveredOrders] = await pool.execute(`
        SELECT o.order_id, o.customer_id, u.name as customer_name, u.email as customer_email
        FROM orders o
        JOIN users u ON o.customer_id = u.user_id
        WHERE o.status = 'delivered'
        AND o.actual_delivery_time < DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND o.actual_delivery_time > DATE_SUB(NOW(), INTERVAL 8 DAY)
        AND NOT EXISTS (
          SELECT 1 FROM reviews r 
          WHERE r.order_id = o.order_id
        )
      `);
      
      let processedCount = 0;
      let successCount = 0;
      
      for (const order of deliveredOrders) {
        try {
          const result = await enhancedNotificationService.sendOrderReminderNotification(
            order.order_id, 
            order.customer_id
          );
          
          processedCount++;
          if (result.success) {
            successCount++;
          }
          
        } catch (error) {
          console.error(`❌ [NotificationProcessor] Error sending order reminder notification for order ${order.order_id}:`, error);
        }
      }
      
      
      return {
        success: true,
        processed: processedCount,
        successful: successCount
      };
    } catch (error) {
      console.error('❌ [NotificationProcessor] Error processing order reminder notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Get notification statistics
  async getNotificationStats() {
    try {
      
      const [stats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_notifications,
          SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as read_notifications,
          SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_notifications,
          SUM(CASE WHEN is_sent_to_firebase = 1 THEN 1 ELSE 0 END) as firebase_sent,
          SUM(CASE WHEN is_sent_to_firebase = 0 OR is_sent_to_firebase IS NULL THEN 1 ELSE 0 END) as firebase_pending,
          type,
          DATE(created_at) as date
        FROM notifications
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY type, DATE(created_at)
        ORDER BY date DESC, type
      `);
      
      const [typeStats] = await pool.execute(`
        SELECT 
          type,
          COUNT(*) as count
        FROM notifications
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY type
        ORDER BY count DESC
      `);
      
      
      return {
        success: true,
        dailyStats: stats,
        typeStats: typeStats
      };
    } catch (error) {
      console.error('❌ [NotificationProcessor] Error getting notification statistics:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationProcessor(); 