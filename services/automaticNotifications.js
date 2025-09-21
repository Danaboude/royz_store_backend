const notificationService = require('./notificationService');
const db = require('../db/db');

class AutomaticNotifications {
  // Send notification when order status changes
  async sendOrderStatusNotification(orderId, newStatus, userId) {
    try {
      let title, body, data = {};

      switch (newStatus) {
        case 'pending':
          title = 'تم تقديم الطلب بنجاح';
          body = 'تم تقديم طلبك وهو قيد المعالجة.';
          data = { type: 'order', relatedId: orderId, action: 'view_order' };
          break;
        case 'confirmed':
          title = 'تم تأكيد الطلب';
          body = 'تم تأكيد طلبك وهو قيد التحضير.';
          data = { type: 'order', relatedId: orderId, action: 'view_order' };
          break;
        case 'processing':
          title = 'جارٍ معالجة الطلب';
          body = 'يتم الآن معالجة طلبك وتجهيزه للتوصيل.';
          data = { type: 'order', relatedId: orderId, action: 'view_order' };
          break;
        case 'shipped':
          title = 'تم شحن الطلب';
          body = 'تم شحن طلبك وهو في طريقه إليك.';
          data = { type: 'order', relatedId: orderId, action: 'view_order' };
          break;
        case 'delivered':
          title = 'تم تسليم الطلب';
          body = 'تم تسليم طلبك بنجاح. استمتع بمشترياتك!';
          data = { type: 'order', relatedId: orderId, action: 'view_order' };
          break;
        case 'cancelled':
          title = 'تم إلغاء الطلب';
          body = 'تم إلغاء طلبك. إذا كان لديك أي استفسارات، يرجى التواصل مع الدعم.';
          data = { type: 'order', relatedId: orderId, action: 'view_order' };
          break;
        default:
          return { success: false, error: 'حالة طلب غير صحيحة' };
      }


      const result = await notificationService.sendNotificationToUser(userId, title, body, data);
      return result;
    } catch (error) {
      console.error('Error sending order status notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to vendor when new order is placed
  async sendNewOrderNotificationToVendor(orderId, vendorId) {
    try {
      const title = 'تم استلام طلب جديد';
      const body = 'لقد استلمت طلبًا جديدًا. يرجى التحقق من لوحة التحكم الخاصة بك.';
      const data = { type: 'order', relatedId: orderId, action: 'view_order' };


      const result = await notificationService.sendNotificationToUser(vendorId, title, body, data);
      return result;
    } catch (error) {
      console.error('Error sending new order notification to vendor:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification when payment is confirmed
  async sendPaymentConfirmedNotification(orderId, userId) {
    try {
      const title = 'تم تأكيد الدفع';
      const body = 'تم تأكيد الدفع الخاص بك. طلبك قيد المعالجة.';
      const data = { type: 'payment', relatedId: orderId, action: 'view_order' };


      const result = await notificationService.sendNotificationToUser(userId, title, body, data);
      return result;
    } catch (error) {
      console.error('Error sending payment confirmed notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification when delivery is assigned
  async sendDeliveryAssignedNotification(orderId, deliveryPersonId) {
    try {
      const title = 'تم تعيين توصيل جديد';
      const body = 'تم تعيين توصيل جديد لك. يرجى التحقق من لوحة التحكم الخاصة بك.';
      const data = { type: 'delivery', relatedId: orderId, action: 'view_delivery' };


      const result = await notificationService.sendNotificationToUser(deliveryPersonId, title, body, data);
      return result;
    } catch (error) {
      console.error('Error sending delivery assigned notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification when delivery status changes
  async sendDeliveryStatusNotification(orderId, userId, status) {
    try {
      let title, body, data = {};

      switch (status) {
        case 'picked_up':
          title = 'تم استلام الطلب';
          body = 'تم استلام طلبك وهو في طريقه إليك.';
          break;
        case 'in_transit':
          title = 'الطلب في الطريق';
          body = 'طلبك في الطريق وسيتم توصيله قريبًا.';
          break;
        case 'out_for_delivery':
          title = 'في طريقه للتوصيل';
          body = 'طلبك خرج للتوصيل وسيصل قريبًا.';
          break;
        case 'delivered':
          title = 'تم تسليم الطلب';
          body = 'تم تسليم طلبك بنجاح. شكرًا لشرائك!';
          break;
        default:
          return { success: false, error: 'حالة توصيل غير صحيحة' };
      }


      data = { type: 'delivery', relatedId: orderId, action: 'view_order' };
      const result = await notificationService.sendNotificationToUser(userId, title, body, data);
      return result;
    } catch (error) {
      console.error('Error sending delivery status notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for low stock products
  async sendLowStockNotification(productId, vendorId) {
    try {
      const title = 'تنبيه انخفاض المخزون';
      const body = 'أحد منتجاتك ينفد من المخزون. يرجى تحديث المخزون.';
      const data = { type: 'inventory', relatedId: productId, action: 'view_product' };

      const result = await notificationService.sendNotificationToUser(vendorId, title, body, data);
      return result;
    } catch (error) {
      console.error('Error sending low stock notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for new reviews
  async sendNewReviewNotification(productId, vendorId, reviewId) {
    try {
      const title = 'تقييم جديد للمنتج';
      const body = 'حصل منتجك على تقييم جديد. تحقق منه!';
      const data = { type: 'review', relatedId: reviewId, action: 'view_review' };


      const result = await notificationService.sendNotificationToUser(vendorId, title, body, data);
      return result;
    } catch (error) {
      console.error('Error sending new review notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for promotional offers
  async sendPromotionalNotification(title, body, targetRole = null) {
    try {
      let result;

      if (targetRole) {
        result = await notificationService.sendNotificationToRole(targetRole, title, body, {
          type: 'promotion',
          action: 'view_promotions'
        });
      } else {
        result = await notificationService.sendNotificationToAllUsers(title, body, {
          type: 'promotion',
          action: 'view_promotions'
        });
      }

      return result;
    } catch (error) {
      console.error('Error sending promotional notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for system maintenance
  async sendMaintenanceNotification(title, body, targetRole = null) {
    try {
      let result;

      if (targetRole) {
        result = await notificationService.sendNotificationToRole(targetRole, title, body, {
          type: 'system',
          action: 'view_maintenance'
        });
      } else {
        result = await notificationService.sendNotificationToAllUsers(title, body, {
          type: 'system',
          action: 'view_maintenance'
        });
      }

      return result;
    } catch (error) {
      console.error('Error sending maintenance notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for order reminders
  async sendOrderReminderNotification(orderId, userId) {
    try {
      const title = 'تذكير بالطلب';
      const body = 'لا تنس مراجعة طلبك الأخير وترك ملاحظات إذا لم تفعل ذلك بعد.';
      const data = { type: 'reminder', relatedId: orderId, action: 'view_order' };

      const result = await notificationService.sendNotificationToUser(userId, title, body, data);
      return result;
    } catch (error) {
      console.error('Error sending order reminder notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification for abandoned cart
  async sendAbandonedCartNotification(userId) {
    try {
      const title = 'أكمل عملية الشراء';
      const body = 'لديك عناصر في سلة التسوق تنتظر الشراء. لا تفوت الفرصة!';
      const data = { type: 'reminder', action: 'view_cart' };


      const result = await notificationService.sendNotificationToUser(userId, title, body, data);
      return result;
    } catch (error) {
      console.error('Error sending abandoned cart notification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AutomaticNotifications(); 