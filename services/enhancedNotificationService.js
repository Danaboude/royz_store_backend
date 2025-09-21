const notificationService = require('./notificationService');
const automaticNotifications = require('./automaticNotifications');
const { pool } = require('../db/db');

class EnhancedNotificationService {
  // Send Firebase notification when order status changes
  async sendOrderStatusChangeNotification(orderId, newStatus, userId) {
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

      // Send Firebase notification
      const result = await automaticNotifications.sendOrderStatusNotification(orderId, newStatus, userId);



      return result;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending order status notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to vendor when order status changes
  async sendVendorOrderStatusNotification(orderId, newStatus) {
    try {

      // Get vendor ID for this order
      const [vendorRows] = await pool.execute(`
        SELECT DISTINCT p.vendor_id, u.name as vendor_name, u.email as vendor_email
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        JOIN users u ON p.vendor_id = u.user_id
        WHERE oi.order_id = ?
        LIMIT 1
      `, [orderId]);

      if (vendorRows.length === 0) {
        return { success: false, error: 'No vendor found for this order' };
      }

      const vendor = vendorRows[0];

      // Send Firebase notification to vendor
      const result = await notificationService.sendNotificationToUser(
        vendor.vendor_id,
        `تحديث حالة الطلب رقم #${orderId}`,
        `تم تحديث حالة الطلب رقم #${orderId} إلى: ${newStatus}`,
        { type: 'order', relatedId: orderId, action: 'view_order' }
      );


      if (result.success) {
      } else {
      }

      return result;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending vendor notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to delivery personnel when order status changes
  async sendDeliveryOrderStatusNotification(orderId, newStatus) {
    try {

      // Get delivery personnel ID
      const [orderRows] = await pool.execute(`
        SELECT delivery_id FROM orders WHERE order_id = ?
      `, [orderId]);

      if (orderRows.length === 0 || !orderRows[0].delivery_id) {
        return { success: false, error: 'No delivery personnel assigned' };
      }

      const deliveryId = orderRows[0].delivery_id;

      // إرسال إشعار Firebase لشخص التوصيل
      const result = await notificationService.sendNotificationToUser(
        deliveryId,
        `تحديث حالة الطلب رقم #${orderId}`,
        `تم تحديث حالة الطلب رقم #${orderId} إلى: ${newStatus}`,
        { type: 'delivery', relatedId: orderId, action: 'view_delivery' }
      );


      if (result.success) {
      } else {
      }

      return result;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending delivery notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for new orders
  async sendNewOrderNotification(orderId) {
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

      // إرسال إشعار إلى العميل
      const customerResult = await notificationService.sendNotificationToUser(
        order.customer_id,
        'تم تقديم الطلب بنجاح',
        `تم تقديم طلبك رقم #${orderId} وهو قيد المعالجة.`,
        { type: 'order', relatedId: orderId, action: 'view_order' }
      );


      // Send notification to vendor
      const vendorResult = await this.sendVendorNewOrderNotification(orderId);

      return {
        success: customerResult.success && vendorResult.success,
        customerResult,
        vendorResult
      };
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending new order notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to vendor for new order
  async sendVendorNewOrderNotification(orderId) {
    try {
      // Get vendor ID for this order
      const [vendorRows] = await pool.execute(`
        SELECT DISTINCT p.vendor_id, u.name as vendor_name, u.email as vendor_email
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        JOIN users u ON p.vendor_id = u.user_id
        WHERE oi.order_id = ?
        LIMIT 1
      `, [orderId]);

      if (vendorRows.length === 0) {
        return { success: false, error: 'No vendor found for this order' };
      }

      const vendor = vendorRows[0];

      // Send Firebase notification to vendor
      const result = await automaticNotifications.sendNewOrderNotificationToVendor(orderId, vendor.vendor_id);

      return result;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending vendor new order notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for delivery assignment
  async sendDeliveryAssignmentNotification(orderId, deliveryId) {
    try {

      // Send notification to delivery personnel
      const deliveryResult = await automaticNotifications.sendDeliveryAssignedNotification(orderId, deliveryId);

      // Send notification to customer
      const [orderRows] = await pool.execute(`
        SELECT customer_id FROM orders WHERE order_id = ?
      `, [orderId]);

      if (orderRows.length > 0) {
        const customerResult = await notificationService.sendNotificationToUser(
          orderRows[0].customer_id,
          'تم تعيين التوصيل',
          `تم تعيين طلبك رقم #${orderId} لمندوب التوصيل.`,
          { type: 'delivery', relatedId: orderId, action: 'view_order' }
        );

        return {
          success: deliveryResult.success && customerResult.success,
          deliveryResult,
          customerResult
        };
      }

      return deliveryResult;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending delivery assignment notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for payment confirmation
  async sendPaymentConfirmationNotification(orderId) {
    try {

      const result = await automaticNotifications.sendPaymentConfirmedNotification(orderId, null);
      return result;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending payment confirmation notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for low stock
  async sendLowStockNotification(productId, vendorId) {
    try {

      const result = await automaticNotifications.sendLowStockNotification(productId, vendorId);
      return result;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending low stock notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for new review
  async sendNewReviewNotification(productId, vendorId, reviewId) {
    try {

      const result = await automaticNotifications.sendNewReviewNotification(productId, vendorId, reviewId);
      return result;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending new review notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for abandoned cart
  async sendAbandonedCartNotification(userId) {
    try {

      const result = await automaticNotifications.sendAbandonedCartNotification(userId);
      return result;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending abandoned cart notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for order reminder
  async sendOrderReminderNotification(orderId, userId) {
    try {

      const result = await automaticNotifications.sendOrderReminderNotification(orderId, userId);
      return result;
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error sending order reminder notification:`, error);
      return { success: false, error: error.message };
    }
  }

  // Process all pending notifications from database
  async processPendingNotifications() {
    try {

      // Get unprocessed notifications (not sent to Firebase yet)
      const [notifications] = await pool.execute(`
        SELECT n.*, u.name as user_name, u.email as user_email
        FROM notifications n
        JOIN users u ON n.user_id = u.user_id
        WHERE n.is_sent_to_firebase = 0 OR n.is_sent_to_firebase IS NULL
        ORDER BY n.created_at ASC
        LIMIT 50
      `);

      let processedCount = 0;
      let successCount = 0;

      for (const notification of notifications) {
        try {
          // Send Firebase notification
          const result = await notificationService.sendNotificationToUser(
            notification.user_id,
            'تحديث الطلب',
            notification.message,
            { type: notification.type, relatedId: notification.related_id }
          );

          // Mark as sent to Firebase
          await pool.execute(`
            UPDATE notifications 
            SET is_sent_to_firebase = 1, firebase_sent_at = NOW()
            WHERE notification_id = ?
          `, [notification.notification_id]);

          processedCount++;
          if (result.success) {
            successCount++;
          }

        } catch (error) {
          console.error(`❌ [EnhancedNotificationService] Error processing notification ${notification.notification_id}:`, error);
        }
      }


      return {
        success: true,
        processed: processedCount,
        successful: successCount
      };
    } catch (error) {
      console.error(`❌ [EnhancedNotificationService] Error processing pending notifications:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EnhancedNotificationService(); 