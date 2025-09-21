// Authentication middleware 
// middleware/auth.js
const jwt = require('jsonwebtoken');
const VendorSubscription = require('../models/VendorSubscription');
const Product = require('../models/Product');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        // Debug logging
        console.log('🔍 JWT Debug Info:');
        console.log('  - JWT_SECRET exists:', !!process.env.JWT_SECRET);
        console.log('  - Token length:', token.length);
        console.log('  - Token preview:', token.substring(0, 20) + '...');
        
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('❌ JWT Verification failed:', err.message);
                return res.status(403).json({error:'Invalid or expired token'})
            }
            console.log('✅ JWT Verification successful for user:', user.id);
            console.log('Decoded JWT payload:', user);
            req.user = user;
            next();
        })
    } else {
        console.log('❌ Authorization header missing or invalid');
        res.status(401).json({error:'Authorization header missing'})
    }
}

function authorizeRoles(allowedRoles) {
  return (req, res, next) => {
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!req.user) {
      console.log('authorizeRoles: No user found in request');
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Check for roleId, role, or role_id for compatibility
    const userRole = req.user.roleId || req.user.role || req.user.role_id;
    console.log('authorizeRoles: userRole =', userRole, 'allowedRoles =', rolesArray);
    console.log('authorizeRoles: Full user object =', JSON.stringify(req.user, null, 2));
    
    // Convert userRole to number if it's a string
    const userRoleNum = typeof userRole === 'string' ? parseInt(userRole, 10) : userRole;
    console.log('authorizeRoles: userRoleNum =', userRoleNum);
    
    if (!rolesArray.includes(userRoleNum)) {
      console.log('authorizeRoles: userRoleNum', userRoleNum, 'not in', rolesArray);
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }
    console.log('authorizeRoles: Access granted for role', userRole);
    next();
  };
}

// Middleware to check vendor subscription and product limit
async function checkVendorSubscriptionAndProductLimit(req, res, next) {
    try {
        const user = req.user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Allow admins, product managers, and order managers to bypass vendor checks
        if (user.roleId === 1 || user.roleId === 11 || user.roleId === 10|| user.roleId === 12) {
            return next();
        }
        // Only apply to vendors (role_id 3, 4, 5)
        if (![3, 4, 5].includes(user.roleId)) {
            return res.status(403).json({ error: 'Only vendors can add products' });
        }
        // Get active subscription
        const subscription = await VendorSubscription.findActiveByUserId(user.id);
        if (!subscription) {
            console.log(`[Product Limit Debug] Vendor ID: ${user.id} - No active subscription found`);
            return res.status(403).json({ 
                error: 'No active subscription found. Please subscribe to a package to add products.',
                details: 'You need an active, paid subscription to add products to the platform.'
            });
        }
        console.log(`[Product Limit Debug] Vendor ID: ${user.id} - Found subscription: ${subscription.package_name_en}, Max Products: ${subscription.max_products}`);
        // Check subscription status
        if (subscription.status !== 'active') {
            console.log(`[Product Limit Debug] Vendor ID: ${user.id} - Subscription status is not active: ${subscription.status}`);
            return res.status(403).json({ error: 'Subscription is not active.' });
        }
        // Check expiry
        const now = new Date();
        const endDate = new Date(subscription.end_date);
        if (endDate < now) {
            console.log(`[Product Limit Debug] Vendor ID: ${user.id} - Subscription expired on: ${subscription.end_date}`);
            return res.status(403).json({ error: 'Subscription has expired.' });
        }
        // First month free logic
        if (subscription.is_first_month_free) {
            const startDate = new Date(subscription.start_date);
            const firstMonthEnd = new Date(startDate);
            firstMonthEnd.setMonth(firstMonthEnd.getMonth() + 1);
            if (now > firstMonthEnd) {
                // First month is over, require payment
                if (subscription.payment_status !== 'paid') {
                    console.log(`[Product Limit Debug] Vendor ID: ${user.id} - First month free period ended, payment required`);
                    return res.status(403).json({ error: 'First month free period ended. Please pay to continue.' });
                }
            }
        } else {
            // Not first month, require payment
            if (subscription.payment_status !== 'paid') {
                console.log(`[Product Limit Debug] Vendor ID: ${user.id} - Payment required, status: ${subscription.payment_status}`);
                return res.status(403).json({ error: 'Subscription payment required.' });
            }
        }
        // Check product limit
        const maxProducts = subscription.max_products;
        if (typeof maxProducts === 'number' && maxProducts > 0) {
            const productCount = await Product.countByVendorId(user.id);
            console.log(`[Product Limit Debug] Vendor ID: ${user.id}, Max Products: ${maxProducts}, Current Products: ${productCount}`);
            if (productCount >= maxProducts) {
                console.log(`[Product Limit Debug] Vendor ID: ${user.id} - Product limit reached! Max: ${maxProducts}, Current: ${productCount}`);
                return res.status(403).json({ 
                    error: `Product limit reached (${maxProducts}). Upgrade your package to add more products.`,
                    details: `You have reached your maximum allowed products (${maxProducts}). Please upgrade your subscription to add more products.`
                });
            }
            console.log(`[Product Limit Debug] Vendor ID: ${user.id} - Product limit check passed. Can add ${maxProducts - productCount} more products.`);
        }
        console.log(`[Product Limit Debug] Vendor ID: ${user.id} - All checks passed, allowing product creation`);
        // All checks passed
        next();
    } catch (error) {
        console.error('Vendor subscription/product limit check error:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

module.exports = {
  authenticateJWT,
  authorizeRoles,
  checkVendorSubscriptionAndProductLimit,
};

