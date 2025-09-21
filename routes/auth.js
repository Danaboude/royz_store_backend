// routes/auth.js
const express = require('express');
const { signup, signin, checkEmailExists,signupVendor,signindelivery, vendordetiles } = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

const vendorDocsUpload = upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'commercial_registration_doc', maxCount: 1 },
    { name: 'tax_registration_doc', maxCount: 1 },
    { name: 'identity_doc', maxCount: 1 },
    { name: 'signature_authorization_doc', maxCount: 1 },
    { name: 'lease_or_ownership_doc', maxCount: 1 },
    { name: 'special_license_doc', maxCount: 1 },
]);

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/check-email', checkEmailExists);
router.post('/signupVendor', vendorDocsUpload, signupVendor);
router.post('/signindelivery', signindelivery);
router.post('/vendor-details', vendorDocsUpload, vendordetiles);

// Add /me endpoint
router.get('/me', authenticateJWT, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Unauthorized' 
    });
  }
  
  try {
    // If user is delivery personnel, fetch their delivery_id
    if (req.user.roleId === 6) {
      const { pool } = require('../db/db');
      const [deliveryResult] = await pool.execute(
        'SELECT delivery_id FROM delivery_personnel WHERE user_id = ?',
        [req.user.id]
      );
      
      if (deliveryResult.length > 0) {
        req.user.delivery_id = deliveryResult[0].delivery_id;
      }
    }
    
    res.json({ 
      success: true,
      data: { user: req.user }
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error', 
      details: error.message 
    });
  }
});

module.exports = router;
