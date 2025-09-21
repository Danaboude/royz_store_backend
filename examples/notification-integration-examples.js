// Notification Integration Examples
// This file contains practical examples for integrating the notification system

// ============================================================================
// WEB FRONTEND INTEGRATION (React/Next.js)
// ============================================================================

// 1. Firebase Configuration
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

// 2. Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// 3. Request Permission and Get Token
export const initializeNotifications = async (userToken) => {
  try {
    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Get FCM token
      const fcmToken = await getToken(messaging, {
        vapidKey: 'your-vapid-key' // Get this from Firebase Console
      });
      
      // Store token in backend
      const response = await fetch('/api/notifications/store-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          fcmToken: fcmToken,
          deviceType: 'web'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('FCM token stored successfully');
        return fcmToken;
      } else {
        console.error('Failed to store FCM token:', result.error);
      }
    } else {
      console.log('Notification permission denied');
    }
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
};

// 4. Handle Incoming Messages
export const setupMessageListener = () => {
  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    
    // Show browser notification
    if (Notification.permission === 'granted') {
      new Notification(payload.notification.title, {
        body: payload.notification.body,
        icon: '/icon.png',
        badge: '/badge.png',
        tag: payload.data?.type || 'default'
      });
    }
    
    // Update UI state (e.g., increment notification count)
    // This depends on your state management solution
    updateNotificationCount();
  });
};

// 5. Notification Service Hook (React)
import { useState, useEffect } from 'react';

export const useNotifications = (userToken) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Get user notifications
  const fetchNotifications = async (limit = 50, offset = 0) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications/user-notifications?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setNotifications(result.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setUnreadCount(result.data.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`/api/notifications/mark-read/${notificationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => 
            n.notification_id === notificationId 
              ? { ...n, is_read: 1 } 
              : n
          )
        );
        fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  useEffect(() => {
    if (userToken) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [userToken]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead
  };
};

// ============================================================================
// MOBILE APP INTEGRATION (React Native)
// ============================================================================

// 1. React Native Firebase Setup
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 2. Request Permission
export const requestUserPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Authorization status:', authStatus);
    return true;
  }
  
  return false;
};

// 3. Get FCM Token
export const getFCMToken = async (userToken) => {
  try {
    const fcmToken = await messaging().getToken();
    
    // Store token in backend
    const response = await fetch('/api/notifications/store-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        fcmToken: fcmToken,
        deviceType: 'android' // or 'ios'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('FCM token stored successfully');
      return fcmToken;
    } else {
      console.error('Failed to store FCM token:', result.error);
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
  }
};

// 4. Handle Foreground Messages
export const setupForegroundHandler = () => {
  return messaging().onMessage(async remoteMessage => {
    console.log('Foreground message received:', remoteMessage);
    
    // Show local notification
    // You can use react-native-push-notification or similar library
    showLocalNotification(remoteMessage);
  });
};

// 5. Handle Background Messages
export const setupBackgroundHandler = () => {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background message received:', remoteMessage);
    
    // Handle background message
    // You can navigate to specific screen or show notification
    return Promise.resolve();
  });
};

// 6. Handle Token Refresh
export const setupTokenRefresh = () => {
  messaging().onTokenRefresh(token => {
    console.log('FCM token refreshed:', token);
    // Update token in backend
    updateFCMToken(token);
  });
};

// ============================================================================
// ADMIN PANEL INTEGRATION
// ============================================================================

// 1. Send Notification to Specific User
export const sendNotificationToUser = async (userId, title, body, data = {}) => {
  try {
    const response = await fetch('/api/notifications/send-to-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        userId,
        title,
        body,
        data
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

// 2. Send Notification to Role
export const sendNotificationToRole = async (roleId, title, body, data = {}) => {
  try {
    const response = await fetch('/api/notifications/send-to-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        roleId,
        title,
        body,
        data
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending notification to role:', error);
    return { success: false, error: error.message };
  }
};

// 3. Send Notification to Vendors
export const sendNotificationToVendors = async (title, body, data = {}) => {
  try {
    const response = await fetch('/api/notifications/send-to-vendors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title,
        body,
        data
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending notification to vendors:', error);
    return { success: false, error: error.message };
  }
};

// 4. Send Notification to Customers
export const sendNotificationToCustomers = async (title, body, data = {}) => {
  try {
    const response = await fetch('/api/notifications/send-to-customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title,
        body,
        data
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending notification to customers:', error);
    return { success: false, error: error.message };
  }
};

// 5. Get Notification Statistics
export const getNotificationStats = async () => {
  try {
    const response = await fetch('/api/notifications/stats', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// AUTOMATIC NOTIFICATION INTEGRATION
// ============================================================================

// 1. Order Status Change Notification
export const sendOrderStatusNotification = async (orderId, newStatus, userId) => {
  try {
    const response = await fetch('/api/notifications/send-to-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        userId,
        title: getOrderStatusTitle(newStatus),
        body: getOrderStatusBody(newStatus),
        data: {
          type: 'order',
          relatedId: orderId,
          action: 'view_order'
        }
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending order status notification:', error);
    return { success: false, error: error.message };
  }
};

// Helper functions for order notifications
const getOrderStatusTitle = (status) => {
  const titles = {
    'pending': 'Order Placed Successfully',
    'confirmed': 'Order Confirmed',
    'processing': 'Order Processing',
    'shipped': 'Order Shipped',
    'delivered': 'Order Delivered',
    'cancelled': 'Order Cancelled'
  };
  return titles[status] || 'Order Update';
};

const getOrderStatusBody = (status) => {
  const bodies = {
    'pending': 'Your order has been placed and is being processed.',
    'confirmed': 'Your order has been confirmed and is being prepared.',
    'processing': 'Your order is now being processed and prepared for delivery.',
    'shipped': 'Your order has been shipped and is on its way to you.',
    'delivered': 'Your order has been delivered successfully. Enjoy your purchase!',
    'cancelled': 'Your order has been cancelled. If you have any questions, please contact support.'
  };
  return bodies[status] || 'Your order status has been updated.';
};

// 2. Low Stock Alert
export const sendLowStockAlert = async (productId, vendorId, productName) => {
  try {
    const response = await fetch('/api/notifications/send-to-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        userId: vendorId,
        title: 'Low Stock Alert',
        body: `${productName} is running low on stock. Please update inventory.`,
        data: {
          type: 'inventory',
          relatedId: productId,
          action: 'view_product'
        }
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending low stock alert:', error);
    return { success: false, error: error.message };
  }
};

// 3. New Review Notification
export const sendNewReviewNotification = async (productId, vendorId, reviewId, productName) => {
  try {
    const response = await fetch('/api/notifications/send-to-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        userId: vendorId,
        title: 'New Product Review',
        body: `${productName} has received a new review. Check it out!`,
        data: {
          type: 'review',
          relatedId: reviewId,
          action: 'view_review'
        }
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending new review notification:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Update FCM token in backend
export const updateFCMToken = async (newToken, userToken) => {
  try {
    const response = await fetch('/api/notifications/store-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        fcmToken: newToken,
        deviceType: 'android' // or 'ios'
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error updating FCM token:', error);
    return { success: false, error: error.message };
  }
};

// Show local notification (React Native)
export const showLocalNotification = (remoteMessage) => {
  // Implementation depends on your notification library
  // Example with react-native-push-notification:
  /*
  PushNotification.localNotification({
    title: remoteMessage.notification.title,
    message: remoteMessage.notification.body,
    playSound: true,
    soundName: 'default',
    importance: 'high',
    priority: 'high',
  });
  */
};

// Update notification count in UI
export const updateNotificationCount = () => {
  // Implementation depends on your state management
  // Example with Redux:
  /*
  store.dispatch(incrementNotificationCount());
  */
};

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

// Test notification system
export const testNotificationSystem = async (userToken, adminToken) => {
  console.log('Testing notification system...');
  
  // 1. Store FCM token
  const tokenResult = await initializeNotifications(userToken);
  console.log('Token storage result:', tokenResult);
  
  // 2. Send test notification (admin only)
  const notificationResult = await sendNotificationToUser(
    1, // userId
    'Test Notification',
    'This is a test notification from the system.',
    { type: 'test', action: 'view_test' }
  );
  console.log('Test notification result:', notificationResult);
  
  // 3. Get user notifications
  const notificationsResponse = await fetch('/api/notifications/user-notifications?limit=5', {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  const notificationsResult = await notificationsResponse.json();
  console.log('User notifications:', notificationsResult);
  
  // 4. Get statistics (admin only)
  const statsResult = await getNotificationStats();
  console.log('Notification stats:', statsResult);
  
  console.log('Notification system test completed!');
};

// Export all functions
export default {
  // Web functions
  initializeNotifications,
  setupMessageListener,
  useNotifications,
  
  // Mobile functions
  requestUserPermission,
  getFCMToken,
  setupForegroundHandler,
  setupBackgroundHandler,
  setupTokenRefresh,
  
  // Admin functions
  sendNotificationToUser,
  sendNotificationToRole,
  sendNotificationToVendors,
  sendNotificationToCustomers,
  getNotificationStats,
  
  // Automatic functions
  sendOrderStatusNotification,
  sendLowStockAlert,
  sendNewReviewNotification,
  
  // Utility functions
  updateFCMToken,
  showLocalNotification,
  updateNotificationCount,
  
  // Testing
  testNotificationSystem
}; 