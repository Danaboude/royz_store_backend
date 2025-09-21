const admin = require('firebase-admin');
const path = require('path');

// Load service account key
const serviceAccount = require('../config/firebase-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const messaging = admin.messaging();

module.exports = {
  admin,
  messaging,

  // Send to a single token
  sendNotification: async (token, notification, data = {}) => {
    try {
      const message = {
        token,
        notification,
        data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'ecommerce_channel'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await messaging.send(message);
      console.log('Successfully sent notification:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Send to multiple tokens
  sendNotificationToMultipleTokens: async (tokens, notification, data = {}) => {
    try {
      const multicastMessage = {
        tokens,
        notification,
        data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'ecommerce_channel'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await messaging.sendEachForMulticast(multicastMessage);
      console.log(`Successfully sent notifications: ${response.successCount} of ${tokens.length}`);

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses
      };
    } catch (error) {
      console.error('Error sending notifications:', error);
      return { success: false, error: error.message };
    }
  },

  // Send to a topic
  sendNotificationToTopic: async (topic, notification, data = {}) => {
    try {
      const message = {
        topic,
        notification,
        data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'ecommerce_channel'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await messaging.send(message);
      console.log('Successfully sent notification to topic:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending notification to topic:', error);
      return { success: false, error: error.message };
    }
  }
};
