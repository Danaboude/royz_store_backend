const SubscriptionPackage = require('../models/SubscriptionPackage');
const VendorSubscription = require('../models/VendorSubscription');
const VendorType = require('../models/VendorType');
const { pool } = require('../db/db');

// Get all subscription packages
async function getAllPackages(req, res) {
    try {
        const packages = await SubscriptionPackage.findAll();
        res.json(packages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Get packages by vendor type
async function getPackagesByVendorType(req, res) {
    try {
        const { vendorTypeId } = req.params;
        const packages = await SubscriptionPackage.findByVendorType(vendorTypeId);
        res.json(packages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Get popular packages
async function getPopularPackages(req, res) {
    try {
        const packages = await SubscriptionPackage.getPopularPackages();
        res.json(packages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Get package by ID
async function getPackageById(req, res) {
    try {
        const { id } = req.params;
        const package = await SubscriptionPackage.findById(id);
        
        if (!package) {
            return res.status(404).json({ error: 'Package not found' });
        }

        res.json(package);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Create subscription package (Admin only)
async function createPackage(req, res) {
    try {
        const userRole = req.user.roleId;

        // Only admins can create packages
        if (userRole !== 1) {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const result = await SubscriptionPackage.create(req.body);
        res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Update subscription package (Admin only)
async function updatePackage(req, res) {
    try {
        const { id } = req.params;
        const userRole = req.user.roleId;

        // Only admins can update packages
        if (userRole !== 1) {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const result = await SubscriptionPackage.update(id, req.body);
        res.json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Delete subscription package (Admin only)
async function deletePackage(req, res) {
    try {
        const { id } = req.params;
        const userRole = req.user.roleId;

        // Only admins can delete packages
        if (userRole !== 1) {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const result = await SubscriptionPackage.delete(id);
        res.json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Get user subscriptions
async function getUserSubscriptions(req, res) {
    try {
        const userId = req.user.id;
        const userRole = req.user.roleId;

        // Users can only view their own subscriptions, admins can view any
        const targetUserId = userRole === 1 ? req.params.userId || userId : userId;

        const subscriptions = await VendorSubscription.findByUserId(targetUserId);
        res.json(subscriptions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Get active subscription for user
async function getActiveSubscription(req, res) {
    try {
        const userId = req.user.id;
        const userRole = req.user.roleId;

        // Users can only view their own subscription, admins can view any
        const targetUserId = userRole === 1 ? req.params.userId || userId : userId;

        const subscription = await VendorSubscription.findActiveByUserId(targetUserId);
        
        if (!subscription) {
            return res.status(404).json({ error: 'No active subscription found' });
        }

        res.json(subscription);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Check subscription status for product limits
async function checkSubscriptionStatus(req, res) {
    try {
        const userId = req.user.id;
        const userRole = req.user.roleId;

        // Users can only check their own status, admins can check any
        const targetUserId = userRole === 1 ? req.params.userId || userId : userId;

        const status = await VendorSubscription.checkUserSubscriptionStatus(targetUserId);
        res.json(status);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Subscribe to a package or upgrade slots for active subscription
async function subscribeToPackage(req, res) {
    try {
                        const { package_id, vendor_type_id, duration_months, duration_days, num_products, auto_renew = true, payment_method, force_upgrade } = req.body;
        const userId = req.user.id;
        
                                                                                // Accept requests with only num_products (no duration) for slot-only upgrades
        if (!package_id || !vendor_type_id || (!duration_months && !duration_days && !num_products)) {
            return res.status(400).json({ error: 'Package ID, vendor type ID, and at least duration or num_products are required' });
        }

        // Get package details
        const package = await SubscriptionPackage.findById(package_id);
                if (!package) {
            return res.status(404).json({ error: 'Package not found' });
        }

        // Check if user exists and is a vendor
        const [userRows] = await pool.execute(
            'SELECT user_id, role_id, name FROM users WHERE user_id = ?',
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userRows[0];
        if (![3, 4, 5].includes(user.role_id)) {
            return res.status(400).json({ error: 'User must be a vendor (role 3, 4, or 5)' });
        }

        // Check if user already has an active subscription
        const [existingSubs] = await pool.execute(
            'SELECT * FROM vendor_subscriptions WHERE user_id = ? AND status = "active"',
            [userId]
        );

        if (existingSubs.length > 0) {
            const existing = existingSubs[0];
            if (force_upgrade) {
                // Cancel the current subscription
                await pool.execute(
                    'UPDATE vendor_subscriptions SET status = ? WHERE subscription_id = ?',
                    ['cancelled', existing.subscription_id]
                );
                // Proceed to create a new subscription below
            } else {
                // Prevent changing to a different package while active
                if (package_id !== existing.package_id) {
                    return res.status(400).json({ error: 'You cannot change your package until your current subscription expires, or you will be charged the full amount.' });
                }
                // Calculate added products and duration
                const addedProducts = num_products ? parseInt(num_products) : 0;
                const currentMaxProducts = existing.max_products || 1;
                let newMaxProducts = currentMaxProducts;
                let addDays = duration_days ? parseInt(duration_days) : 0;
                let addMonths = duration_months ? parseInt(duration_months) : 0;
                let newEndDate = new Date(existing.end_date);
                let priceForAddedProducts = 0;
                let priceForAddedDuration = 0;
                let usedPrice = package.price;
                if (package.vendor_type_id === 2 && duration_days) {
                    usedPrice = package.price_2weeks;
                }
                // Rule 1: Adding Slots Only (No Extension)
                if (addedProducts > 0 && addDays === 0 && addMonths === 0) {
                    newMaxProducts = currentMaxProducts + addedProducts;
                    // Charge for new slots for remaining days only
                    const now = new Date();
                    const remainingMs = new Date(existing.end_date) - now;
                    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
                    const chargeDays = remainingDays > 0 ? remainingDays : 1;
                    // Use correct daily pricing for 2-week or monthly
                    if (package.vendor_type_id === 2 && (existing.duration_days === 14 || existing.duration_days === '14')) {
                        // 2-week package pricing
                        priceForAddedProducts = (package.price_2weeks / 14) * chargeDays * addedProducts;
                    } else {
                        // Monthly package pricing
                        priceForAddedProducts = (package.price / 30) * chargeDays * addedProducts;
                    }
                    // Do NOT extend end_date
                    newEndDate = new Date(existing.end_date);
                }
                // Rule 2: Extending Duration Only (No New Slots)
                else if (addedProducts === 0 && (addDays > 0 || addMonths > 0)) {
                    // Extend end_date for all slots
                    if (addDays > 0) {
                        newEndDate.setDate(newEndDate.getDate() + addDays);
                        priceForAddedDuration = usedPrice * currentMaxProducts * (addDays / 14);
                    }
                    if (addMonths > 0) {
                        newEndDate.setMonth(newEndDate.getMonth() + addMonths);
                        priceForAddedDuration = usedPrice * currentMaxProducts * addMonths;
                    }
                    // Do NOT change max_products
                    newMaxProducts = currentMaxProducts;
                }
                // Rule 3: Both Adding Slots & Extending Duration
                else if (addedProducts > 0 && (addDays > 0 || addMonths > 0)) {
                    // Step 1: Charge for new slots for remaining days
                    const now = new Date();
                    const remainingMs = new Date(existing.end_date) - now;
                    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
                    const chargeDays = remainingDays > 0 ? remainingDays : 1;
                    if (package.vendor_type_id === 2) {
                        priceForAddedProducts = (usedPrice / 14) * chargeDays * addedProducts;
                    } else {
                        priceForAddedProducts = (usedPrice / 30) * chargeDays * addedProducts;
                    }
                    // Step 2: Charge for all slots (including new ones) for extension period
                    const totalSlotsAfterUpgrade = currentMaxProducts + addedProducts;
                    if (addDays > 0) {
                        newEndDate.setDate(newEndDate.getDate() + addDays);
                        priceForAddedDuration = usedPrice * totalSlotsAfterUpgrade * (addDays / 14);
                    }
                    if (addMonths > 0) {
                        newEndDate.setMonth(newEndDate.getMonth() + addMonths);
                        priceForAddedDuration = usedPrice * totalSlotsAfterUpgrade * addMonths;
                    }
                    newMaxProducts = totalSlotsAfterUpgrade;
                }
                // Total upgrade price
                const totalAmount = Math.round((priceForAddedProducts + priceForAddedDuration) * 100) / 100;
                // Update the existing subscription
                await pool.execute(
                    'UPDATE vendor_subscriptions SET package_id = ?, max_products = ?, end_date = ?, amount_paid = amount_paid + ? WHERE subscription_id = ?',
                    [package_id, newMaxProducts, newEndDate, totalAmount, existing.subscription_id]
                );
                // Add a payment record for the upgrade
                // For slot-only upgrades, only charge for new slots (not duration)
                if (addedProducts > 0 && addDays === 0 && addMonths === 0 && priceForAddedProducts > 0) {
                    await pool.execute(
                        `INSERT INTO subscription_payments 
                        (subscription_id, user_id, amount, payment_method, payment_status, payment_date) 
                        VALUES (?, ?, ?, 'admin', 'pending', NOW())`,
                        [existing.subscription_id, userId, Math.round(priceForAddedProducts * 100) / 100]
                    );
                } else if (totalAmount > 0) {
                    await pool.execute(
                        `INSERT INTO subscription_payments 
                        (subscription_id, user_id, amount, payment_method, payment_status, payment_date) 
                        VALUES (?, ?, ?, 'admin', 'pending', NOW())`,
                        [existing.subscription_id, userId, totalAmount]
                    );
                }
                return res.status(200).json({
                    message: 'Subscription upgraded/extended successfully',
                    total_amount: totalAmount,
                    subscription: {
                        subscription_id: existing.subscription_id,
                        user_id: userId,
                        package_id,
                        package_name: package.name_en,
                        duration_months,
                        duration_days,
                        num_products: newMaxProducts,
                        total_amount: totalAmount,
                        end_date: newEndDate,
                        status: 'pending',
                        upgraded: true
                    }
                });
            }
        }

        // No active subscription: create a new one
                let startDate = new Date();
        let endDate = new Date(startDate);
        let totalAmount = 0;
        let usedNumProducts = 1; // This can be set to 0 or 1 as default for new subscription
        let usedDurationMonths = duration_months;
        let usedDurationDays = duration_days;
        let usedPrice = package.price;
        let usedMaxProducts = package.max_products || 1;
        
                                                        if (package.vendor_type_id === 2 && duration_days) {
            // Real estate, 2 weeks
                        usedPrice = package.price_2weeks;
            endDate.setDate(endDate.getDate() + duration_days);
            usedDurationMonths = undefined;
            usedDurationDays = duration_days;
            // Always use package.max_products for new subscription
            usedMaxProducts = package.max_products || 1;
            totalAmount = usedPrice * usedMaxProducts;
        } else {
            // Default: use months
                        endDate.setMonth(endDate.getMonth() + duration_months);
            // Always use package.max_products for new subscription
            usedMaxProducts = package.max_products || 1;
            totalAmount = package.price * usedMaxProducts * duration_months;
        }
        
                                                                // Create subscription
                                                                                const [subscriptionResult] = await pool.execute(
            `INSERT INTO vendor_subscriptions 
            (user_id, package_id, vendor_type_id, start_date, end_date, status, payment_status, amount_paid, auto_renew, max_products) 
            VALUES (?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)`,
            [userId, package_id, package.vendor_type_id, startDate, endDate, totalAmount, auto_renew, usedMaxProducts]
        );

        const subscriptionId = subscriptionResult.insertId;

        // Create subscription payment record
        await pool.execute(
            `INSERT INTO subscription_payments 
            (subscription_id, user_id, amount, payment_method, payment_status, payment_date) 
            VALUES (?, ?, ?, 'admin', 'pending', NOW())`,
            [subscriptionId, userId, totalAmount]
        );

        // Update user_vendor_types if not exists
        const [existingVendorType] = await pool.execute(
            'SELECT id FROM user_vendor_types WHERE user_id = ?',
            [userId]
        );

        if (existingVendorType.length === 0) {
            await pool.execute(
                'INSERT INTO user_vendor_types (user_id, vendor_type_id, is_verified) VALUES (?, ?, 1)',
                [userId, package.vendor_type_id]
            );
        }

        const responseData = {
            message: 'Subscription assigned successfully',
            subscription: {
                subscription_id: subscriptionId,
                user_id: userId,
                package_id,
                package_name: package.name_en,
                duration_months: usedDurationMonths,
                duration_days: usedDurationDays,
                num_products: usedNumProducts,
                total_amount: totalAmount,
                start_date: startDate,
                end_date: endDate,
                status: 'pending'
            }
        };
        
                res.status(201).json(responseData);

    } catch (error) {
        console.error('🔍 [SUBSCRIPTION DEBUG] Error assigning subscription:', error);
        console.error('🔍 [SUBSCRIPTION DEBUG] Error stack:', error.stack);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Cancel subscription
async function cancelSubscription(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.roleId;

        // Get subscription
        const subscription = await VendorSubscription.findById(id);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        // Users can only cancel their own subscriptions, admins can cancel any
        if (userRole !== 1 && subscription.user_id != userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await VendorSubscription.cancel(id);
        res.json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Renew subscription
async function renewSubscription(req, res) {
    try {
        const { id } = req.params;
        const { payment_method } = req.body;
        const userId = req.user.id;
        const userRole = req.user.roleId;

        // Get subscription
        const subscription = await VendorSubscription.findById(id);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        // Users can only renew their own subscriptions, admins can renew any
        if (userRole !== 1 && subscription.user_id != userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get package details for payment
        const package = await SubscriptionPackage.findById(subscription.package_id);
        if (!package) {
            return res.status(404).json({ error: 'Package not found' });
        }

        // Renew subscription
        const result = await VendorSubscription.renew(id);

        // Create payment record if payment method provided
        if (payment_method) {
            await pool.query(
                'INSERT INTO subscription_payments (subscription_id, user_id, amount, payment_method, payment_status) VALUES (?, ?, ?, ?, ?)',
                [id, subscription.user_id, package.price, payment_method, 'pending']
            );
        }

        res.json({
            message: result.message,
            new_end_date: result.new_end_date,
            amount: package.price
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Get all subscriptions (Admin only)
async function getAllSubscriptions(req, res) {
    try {
        const userRole = req.user.roleId;

        // Only admins can view all subscriptions
        if (userRole !== 1) {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const subscriptions = await VendorSubscription.findAll();
        res.json(subscriptions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Get expired subscriptions (Admin only)
async function getExpiredSubscriptions(req, res) {
    try {
        const userRole = req.user.roleId;

        // Only admins can view expired subscriptions
        if (userRole !== 1) {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const subscriptions = await VendorSubscription.getExpiredSubscriptions();
        res.json(subscriptions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Get subscription statistics (Admin only)
async function getSubscriptionStats(req, res) {
    try {
        const userRole = req.user.roleId;

        // Only admins can view subscription statistics
        if (userRole !== 1) {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const stats = await VendorSubscription.getSubscriptionStats();
        res.json(stats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Get vendor types
async function getVendorTypes(req, res) {
    try {
        const vendorTypes = await VendorType.findAll();
        res.json(vendorTypes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

// Admin function to assign subscription to vendor
async function assignSubscriptionToVendor(req, res) {
    try {
        const userRole = req.user.roleId;

        // Only admins can assign subscriptions
        if (userRole !== 1) {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const { user_id, package_id, duration_months, duration_days, num_products, auto_renew = true } = req.body;

        // Accept requests with only num_products (no duration) for slot-only upgrades
        if (!user_id || !package_id || (!duration_months && !duration_days && !num_products)) {
            return res.status(400).json({ error: 'User ID, package ID, and at least duration or num_products are required' });
        }

        // Get package details
        const package = await SubscriptionPackage.findById(package_id);
        if (!package) {
            return res.status(404).json({ error: 'Package not found' });
        }

        // Check if user exists and is a vendor
        const [userRows] = await pool.execute(
            'SELECT user_id, role_id, name FROM users WHERE user_id = ?',
            [user_id]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userRows[0];
        if (![3, 4, 5].includes(user.role_id)) {
            return res.status(400).json({ error: 'User must be a vendor (role 3, 4, or 5)' });
        }

        // Check if user already has an active subscription
        const [existingSubs] = await pool.execute(
            'SELECT * FROM vendor_subscriptions WHERE user_id = ? AND status = "active"',
            [user_id]
        );

        if (existingSubs.length > 0) {
            const existing = existingSubs[0];
            console.log('[DEBUG] Existing active subscription found:', {
                user_id,
                requested_package_id: package_id,
                existing_package_id: existing.package_id,
                existing_subscription: existing
            });

            if (package_id !== existing.package_id) {
                                // End the old subscription immediately
                await pool.execute(
                    'UPDATE vendor_subscriptions SET status = "cancelled", end_date = NOW() WHERE subscription_id = ?',
                    [existing.subscription_id]
                );

                // Proceed to create the new subscription below (skip upgrade logic)
            } else {
                // ---- ORIGINAL UPGRADE LOGIC (unchanged) ----
                const addedProducts = num_products ? parseInt(num_products) : 0;
                const currentMaxProducts = existing.max_products || 1;
                let newMaxProducts = currentMaxProducts;
                let addDays = duration_days ? parseInt(duration_days) : 0;
                let addMonths = duration_months ? parseInt(duration_months) : 0;
                let newEndDate = new Date(existing.end_date);
                let priceForAddedProducts = 0;
                let priceForAddedDuration = 0;
                let usedPrice = package.price;
                if (package.vendor_type_id === 2 && duration_days) {
                    usedPrice = package.price_2weeks;
                }

                if (addedProducts > 0 && addDays === 0 && addMonths === 0) {
                                        newMaxProducts = currentMaxProducts + addedProducts;
                    const now = new Date();
                    const remainingMs = new Date(existing.end_date) - now;
                    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
                    const chargeDays = remainingDays > 0 ? remainingDays : 1;

                    if (package.vendor_type_id === 2 && (existing.duration_days === 14 || existing.duration_days === '14')) {
                        priceForAddedProducts = (package.price_2weeks / 14) * chargeDays * addedProducts;
                    } else {
                        priceForAddedProducts = (package.price / 30) * chargeDays * addedProducts;
                    }
                    newEndDate = new Date(existing.end_date);
                }
                else if (addedProducts === 0 && (addDays > 0 || addMonths > 0)) {
                                        if (addDays > 0) {
                        newEndDate.setDate(newEndDate.getDate() + addDays);
                        priceForAddedDuration = usedPrice * currentMaxProducts * (addDays / 14);
                    }
                    if (addMonths > 0) {
                        newEndDate.setMonth(newEndDate.getMonth() + addMonths);
                        priceForAddedDuration = usedPrice * currentMaxProducts * addMonths;
                    }
                    newMaxProducts = currentMaxProducts;
                }
                else if (addedProducts > 0 && (addDays > 0 || addMonths > 0)) {
                                        const now = new Date();
                    const remainingMs = new Date(existing.end_date) - now;
                    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
                    const chargeDays = remainingDays > 0 ? remainingDays : 1;
                    if (package.vendor_type_id === 2) {
                        priceForAddedProducts = (usedPrice / 14) * chargeDays * addedProducts;
                    } else {
                        priceForAddedProducts = (usedPrice / 30) * chargeDays * addedProducts;
                    }
                    const totalSlotsAfterUpgrade = currentMaxProducts + addedProducts;
                    if (addDays > 0) {
                        newEndDate.setDate(newEndDate.getDate() + addDays);
                        priceForAddedDuration = usedPrice * totalSlotsAfterUpgrade * (addDays / 14);
                    }
                    if (addMonths > 0) {
                        newEndDate.setMonth(newEndDate.getMonth() + addMonths);
                        priceForAddedDuration = usedPrice * totalSlotsAfterUpgrade * addMonths;
                    }
                    newMaxProducts = totalSlotsAfterUpgrade;
                }

                const totalAmount = Math.round((priceForAddedProducts + priceForAddedDuration) * 100) / 100;
                                await pool.execute(
                    'UPDATE vendor_subscriptions SET package_id = ?, max_products = ?, end_date = ?, amount_paid = amount_paid + ? WHERE subscription_id = ?',
                    [package_id, newMaxProducts, newEndDate, totalAmount, existing.subscription_id]
                );

                if (addedProducts > 0 && addDays === 0 && addMonths === 0 && priceForAddedProducts > 0) {
                                        await pool.execute(
                        `INSERT INTO subscription_payments 
                        (subscription_id, user_id, amount, payment_method, payment_status, payment_date) 
                        VALUES (?, ?, ?, 'admin', 'completed', NOW())`,
                        [existing.subscription_id, user_id, Math.round(priceForAddedProducts * 100) / 100]
                    );
                } else if (totalAmount > 0) {
                                        await pool.execute(
                        `INSERT INTO subscription_payments 
                        (subscription_id, user_id, amount, payment_method, payment_status, payment_date) 
                        VALUES (?, ?, ?, 'admin', 'completed', NOW())`,
                        [existing.subscription_id, user_id, totalAmount]
                    );
                }

                return res.status(200).json({
                    message: 'Subscription upgraded/extended successfully',
                    total_amount: totalAmount,
                    subscription: {
                        subscription_id: existing.subscription_id,
                        user_id,
                        package_id,
                        package_name: package.name_en,
                        duration_months: duration_months,
                        duration_days: duration_days,
                        num_products: newMaxProducts,
                        total_amount: totalAmount,
                        end_date: newEndDate,
                        status: 'active',
                        upgraded: true
                    }
                });
            }
        }

        // --- CREATE NEW SUBSCRIPTION (for replacements or no existing active subscription) ---
        let startDate = new Date();
        let endDate = new Date(startDate);
        let totalAmount = 0;
        let usedNumProducts = 1;
        let usedDurationMonths = duration_months;
        let usedDurationDays = duration_days;
        let usedPrice = package.price;
        let usedMaxProducts = package.max_products || 1;

        if (package.vendor_type_id === 2 && duration_days) {
            usedPrice = package.price_2weeks;
            endDate.setDate(endDate.getDate() + duration_days);
            usedDurationMonths = undefined;
            usedDurationDays = duration_days;
            usedNumProducts = parseInt(num_products) || 1;
            usedMaxProducts = usedNumProducts;
            totalAmount = usedPrice * usedNumProducts;
        } else {
            endDate.setMonth(endDate.getMonth() + duration_months);
            usedNumProducts = parseInt(num_products) || package.max_products || 1;
            usedMaxProducts = usedNumProducts;
            totalAmount = package.price * usedNumProducts * duration_months;
        }

        const [subscriptionResult] = await pool.execute(
            `INSERT INTO vendor_subscriptions 
            (user_id, package_id, vendor_type_id, start_date, end_date, status, payment_status, amount_paid, auto_renew, max_products) 
            VALUES (?, ?, ?, ?, ?, 'active', 'paid', ?, ?, ?)`,
            [user_id, package_id, package.vendor_type_id, startDate, endDate, totalAmount, auto_renew, usedMaxProducts]
        );

        const subscriptionId = subscriptionResult.insertId;

        await pool.execute(
            `INSERT INTO subscription_payments 
            (subscription_id, user_id, amount, payment_method, payment_status, payment_date) 
            VALUES (?, ?, ?, 'admin', 'completed', NOW())`,
            [subscriptionId, user_id, totalAmount]
        );

        const [existingVendorType] = await pool.execute(
            'SELECT id FROM user_vendor_types WHERE user_id = ?',
            [user_id]
        );

        if (existingVendorType.length === 0) {
            await pool.execute(
                'INSERT INTO user_vendor_types (user_id, vendor_type_id, is_verified) VALUES (?, ?, 1)',
                [user_id, package.vendor_type_id]
            );
        }

        res.status(201).json({
            message: 'Subscription assigned successfully',
            subscription: {
                subscription_id: subscriptionId,
                user_id,
                package_id,
                package_name: package.name_en,
                duration_months: usedDurationMonths,
                duration_days: usedDurationDays,
                num_products: usedNumProducts,
                total_amount: totalAmount,
                start_date: startDate,
                end_date: endDate,
                status: 'active'
            }
        });

    } catch (error) {
        console.error('Error assigning subscription:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}


// Get vendor subscription status and product limits
async function getVendorSubscriptionStatus(req, res) {
    try {
        const userId = req.user.id;
        const userRole = req.user.roleId;

        // Only vendors can check their status
        if (![3, 4, 5].includes(userRole)) {
            return res.status(403).json({ success: false, error: 'Only vendors can check subscription status' });
        }

        // Get active subscription
        const subscription = await VendorSubscription.findActiveByUserId(userId);
        
        // Determine language for package name
        const acceptLanguage = req.headers['accept-language'] || '';
        const isArabic = acceptLanguage.toLowerCase().startsWith('ar');
        const package_name = isArabic ? subscription?.package_name_ar : subscription?.package_name_en;

        if (!subscription) {
            return res.json({
                success: true,
                data: {
                    hasSubscription: false,
                    status: 'no_subscription',
                    message: 'No active subscription found',
                    productLimit: 0,
                    currentProducts: 0,
                    remainingProducts: 0,
                    package_name: null,
                    package_name_en: null,
                    package_name_ar: null,
                    max_products: 0,
                    end_date: null,
                    subscriptionDetails: null
                }
            });
        }

        // Check if subscription is expired
        const now = new Date();
        const endDate = new Date(subscription.end_date);
        const isExpired = endDate < now;

        if (isExpired) {
            return res.json({
                success: true,
                data: {
                    hasSubscription: true,
                    status: 'expired',
                    message: 'Subscription has expired',
                    productLimit: subscription.max_products || 0,
                    currentProducts: 0,
                    remainingProducts: 0,
                    package_name,
                    package_name_en: subscription.package_name_en,
                    package_name_ar: subscription.package_name_ar,
                    max_products: subscription.max_products,
                    end_date: subscription.end_date,
                    subscriptionDetails: {
                        package_name,
                        package_name_en: subscription.package_name_en,
                        package_name_ar: subscription.package_name_ar,
                        end_date: subscription.end_date,
                        max_products: subscription.max_products
                    }
                }
            });
        }

        // Get current product count
        const [productCountResult] = await pool.query(
            'SELECT COUNT(*) as count FROM products WHERE vendor_id = ? AND deleted = 0',
            [userId]
        );
        const currentProducts = productCountResult[0].count;
        const productLimit = subscription.max_products || 0;
        const remainingProducts = Math.max(0, productLimit - currentProducts);

        // Debug logging
                // Determine warning level
        let warningLevel = 'none';
        if (remainingProducts <= 0) {
            warningLevel = 'limit_reached';
        } else if (remainingProducts <= Math.ceil(productLimit * 0.2)) { // 20% or less remaining
            warningLevel = 'critical';
        } else if (remainingProducts <= Math.ceil(productLimit * 0.5)) { // 50% or less remaining
            warningLevel = 'warning';
        }

                return res.json({
            success: true,
            data: {
                hasSubscription: true,
                status: 'active',
                message: 'Subscription is active',
                productLimit,
                currentProducts,
                remainingProducts,
                warningLevel,
                package_name,
                package_name_en: subscription.package_name_en,
                package_name_ar: subscription.package_name_ar,
                max_products: subscription.max_products,
                end_date: subscription.end_date,
                subscriptionDetails: {
                    package_name,
                    package_name_en: subscription.package_name_en,
                    package_name_ar: subscription.package_name_ar,
                    end_date: subscription.end_date,
                    max_products: subscription.max_products,
                    status: subscription.status,
                    payment_status: subscription.payment_status
                }
            }
        });

    } catch (error) {
        console.error('Error getting vendor subscription status:', error);
        res.status(500).json({ success: false, error: 'Server Error', details: error.message });
    }
}

// Get current (active) subscription for a vendor by user id (admin)
async function getCurrentVendorSubscription(req, res) {
    try {
        const userId = req.params.id;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const subscription = await VendorSubscription.findActiveByUserId(userId);
        if (!subscription) {
            return res.status(404).json({ error: 'No active subscription found' });
        }
        res.json(subscription);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
}

module.exports = {
    getAllPackages,
    getPackagesByVendorType,
    getPopularPackages,
    getPackageById,
    createPackage,
    updatePackage,
    deletePackage,
    getUserSubscriptions,
    getActiveSubscription,
    checkSubscriptionStatus,
    subscribeToPackage,
    cancelSubscription,
    renewSubscription,
    getAllSubscriptions,
    getExpiredSubscriptions,
    getSubscriptionStats,
    getVendorTypes,
    assignSubscriptionToVendor,
    getVendorSubscriptionStatus,
    getCurrentVendorSubscription
}; 