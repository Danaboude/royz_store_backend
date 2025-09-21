const { pool } = require('../db/db');

class VendorSubscription {
    constructor(data) {
        this.subscription_id = data.subscription_id;
        this.user_id = data.user_id;
        this.package_id = data.package_id;
        this.vendor_type_id = data.vendor_type_id;
        this.start_date = data.start_date;
        this.end_date = data.end_date;
        this.status = data.status;
        this.payment_status = data.payment_status;
        this.amount_paid = data.amount_paid;
        this.is_first_month_free = data.is_first_month_free;
        this.auto_renew = data.auto_renew;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    static async findByUserId(userId) {
        try {
            const [rows] = await pool.query(`
                SELECT vs.*, sp.name_en as package_name_en, sp.name_ar as package_name_ar, 
                       vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       u.name as user_name, u.email as user_email
                FROM vendor_subscriptions vs
                JOIN subscription_packages sp ON vs.package_id = sp.package_id
                JOIN vendor_types vt ON vs.vendor_type_id = vt.vendor_type_id
                JOIN users u ON vs.user_id = u.user_id
                WHERE vs.user_id = ?
                ORDER BY vs.created_at DESC
            `, [userId]);

            // For each subscription, add products_used and days_left
            for (const sub of rows) {
                // Count products for this vendor (userId)
                const [productCount] = await pool.query(
                    'SELECT COUNT(*) as count FROM products WHERE vendor_id = ? AND deleted = 0',
                    [userId]
                );
                sub.products_used = productCount[0].count;
                // Use max_products from subscription if available
                sub.max_products = sub.max_products || null;
                // Calculate days_left
                if (sub.end_date) {
                    const endDate = new Date(sub.end_date);
                    const now = new Date();
                    const diff = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                    sub.days_left = diff > 0 ? diff : 0;
                } else {
                    sub.days_left = '-';
                }
            }
            return rows;
        } catch (error) {
            throw new Error(`Error fetching vendor subscriptions: ${error.message}`);
        }
    }

    static async findActiveByUserId(userId) {
        try {
            const [rows] = await pool.query(`
                SELECT vs.*, sp.name_en as package_name_en, sp.name_ar as package_name_ar, 
                       vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       u.name as user_name, u.email as user_email,
                       vs.max_products, sp.commission_rate
                FROM vendor_subscriptions vs
                JOIN subscription_packages sp ON vs.package_id = sp.package_id
                JOIN vendor_types vt ON vs.vendor_type_id = vt.vendor_type_id
                JOIN users u ON vs.user_id = u.user_id
                WHERE vs.user_id = ? AND vs.status = 'active' AND vs.end_date > NOW()
                ORDER BY vs.end_date ASC
                LIMIT 1
            `, [userId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching active subscription: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT vs.*, sp.name_en as package_name_en, sp.name_ar as package_name_ar, 
                       vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       u.name as user_name, u.email as user_email
                FROM vendor_subscriptions vs
                JOIN subscription_packages sp ON vs.package_id = sp.package_id
                JOIN vendor_types vt ON vs.vendor_type_id = vt.vendor_type_id
                JOIN users u ON vs.user_id = u.user_id
                WHERE vs.subscription_id = ?
            `, [id]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching vendor subscription: ${error.message}`);
        }
    }

    static async findAll() {
        try {
            const [rows] = await pool.query(`
                SELECT vs.*, sp.name_en as package_name_en, sp.name_ar as package_name_ar, 
                       vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       u.name as user_name, u.email as user_email
                FROM vendor_subscriptions vs
                JOIN subscription_packages sp ON vs.package_id = sp.package_id
                JOIN vendor_types vt ON vs.vendor_type_id = vt.vendor_type_id
                JOIN users u ON vs.user_id = u.user_id
                ORDER BY vs.created_at DESC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching vendor subscriptions: ${error.message}`);
        }
    }

    static async create(subscriptionData) {
        try {
            const { 
                user_id, package_id, vendor_type_id, start_date, end_date, 
                amount_paid, is_first_month_free, auto_renew, max_products 
            } = subscriptionData;
            
            if (!user_id || !package_id || !vendor_type_id || !start_date || !end_date) {
                throw new Error('User ID, package ID, vendor type ID, start date, and end date are required');
            }

            // Check if user already has an active subscription
            const activeSubscription = await this.findActiveByUserId(user_id);
            if (activeSubscription) {
                throw new Error('User already has an active subscription');
            }

            const [result] = await pool.query(
                'INSERT INTO vendor_subscriptions (user_id, package_id, vendor_type_id, start_date, end_date, amount_paid, is_first_month_free, auto_renew, max_products) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [user_id, package_id, vendor_type_id, start_date, end_date, amount_paid, is_first_month_free, auto_renew, max_products]
            );
            
            return { subscription_id: result.insertId, message: 'Vendor subscription created successfully' };
        } catch (error) {
            throw new Error(`Error creating vendor subscription: ${error.message}`);
        }
    }

    static async update(id, updateData) {
        try {
            const { 
                status, payment_status, amount_paid, auto_renew, end_date 
            } = updateData;
            
            let updateFields = [];
            let params = [];

            if (status) {
                updateFields.push('status = ?');
                params.push(status);
            }
            if (payment_status) {
                updateFields.push('payment_status = ?');
                params.push(payment_status);
            }
            if (amount_paid !== undefined) {
                updateFields.push('amount_paid = ?');
                params.push(amount_paid);
            }
            if (auto_renew !== undefined) {
                updateFields.push('auto_renew = ?');
                params.push(auto_renew);
            }
            if (end_date) {
                updateFields.push('end_date = ?');
                params.push(end_date);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            params.push(id);

            const [result] = await pool.query(
                `UPDATE vendor_subscriptions SET ${updateFields.join(', ')} WHERE subscription_id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                throw new Error('Vendor subscription not found');
            }

            return { message: 'Vendor subscription updated successfully' };
        } catch (error) {
            throw new Error(`Error updating vendor subscription: ${error.message}`);
        }
    }

    static async cancel(id) {
        try {
            const [result] = await pool.query(
                'UPDATE vendor_subscriptions SET status = ?, auto_renew = ? WHERE subscription_id = ?',
                ['cancelled', 0, id]
            );

            if (result.affectedRows === 0) {
                throw new Error('Vendor subscription not found');
            }

            return { message: 'Vendor subscription cancelled successfully' };
        } catch (error) {
            throw new Error(`Error cancelling vendor subscription: ${error.message}`);
        }
    }

    static async renew(id) {
        try {
            const subscription = await this.findById(id);
            if (!subscription) {
                throw new Error('Vendor subscription not found');
            }

            // Calculate new end date based on package duration
            const packageInfo = await pool.query(
                'SELECT duration_months FROM subscription_packages WHERE package_id = ?',
                [subscription.package_id]
            );

            if (packageInfo[0].length === 0) {
                throw new Error('Package not found');
            }

            const durationMonths = packageInfo[0][0].duration_months;
            const newEndDate = new Date(subscription.end_date);
            newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

            const [result] = await pool.query(
                'UPDATE vendor_subscriptions SET end_date = ?, status = ?, updated_at = NOW() WHERE subscription_id = ?',
                [newEndDate, 'active', id]
            );

            if (result.affectedRows === 0) {
                throw new Error('Failed to renew subscription');
            }

            return { message: 'Vendor subscription renewed successfully', new_end_date: newEndDate };
        } catch (error) {
            throw new Error(`Error renewing vendor subscription: ${error.message}`);
        }
    }

    static async getExpiredSubscriptions() {
        try {
            const [rows] = await pool.query(`
                SELECT vs.*, sp.name_en as package_name_en, sp.name_ar as package_name_ar, 
                       vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       u.name as user_name, u.email as user_email
                FROM vendor_subscriptions vs
                JOIN subscription_packages sp ON vs.package_id = sp.package_id
                JOIN vendor_types vt ON vs.vendor_type_id = vt.vendor_type_id
                JOIN users u ON vs.user_id = u.user_id
                WHERE vs.status = 'active' AND vs.end_date < NOW()
                ORDER BY vs.end_date ASC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching expired subscriptions: ${error.message}`);
        }
    }

    static async getSubscriptionStats() {
        try {
            const [rows] = await pool.query(`
                SELECT 
                    COUNT(*) as total_subscriptions,
                    COUNT(CASE WHEN status = 'active' AND end_date > NOW() THEN 1 END) as active_subscriptions,
                    COUNT(CASE WHEN status = 'expired' OR (status = 'active' AND end_date < NOW()) THEN 1 END) as expired_subscriptions,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_subscriptions,
                    SUM(amount_paid) as total_revenue,
                    COUNT(CASE WHEN is_first_month_free = 1 THEN 1 END) as free_trials_given
                FROM vendor_subscriptions
            `);
            return rows[0];
        } catch (error) {
            throw new Error(`Error fetching subscription stats: ${error.message}`);
        }
    }

    static async checkUserSubscriptionStatus(userId) {
        try {
            const activeSubscription = await this.findActiveByUserId(userId);
            
            if (!activeSubscription) {
                return {
                    has_active_subscription: false,
                    subscription: null,
                    can_add_products: false,
                    message: 'No active subscription found'
                };
            }

            // Get package features to determine product limits
            const packageInfo = await pool.query(
                'SELECT features_en FROM subscription_packages WHERE package_id = ?',
                [activeSubscription.package_id]
            );

            let productLimit = 0;
            if (packageInfo[0].length > 0) {
                const features = JSON.parse(packageInfo[0][0].features_en);
                const productFeature = features.find(f => f.includes('products'));
                if (productFeature) {
                    const match = productFeature.match(/(\d+)/);
                    if (match) {
                        productLimit = parseInt(match[1]);
                    }
                }
            }

            // Count current products
            const [productCount] = await pool.query(
                'SELECT COUNT(*) as count FROM products WHERE vendor_id = ? AND deleted = 0',
                [userId]
            );

            const currentProductCount = productCount[0].count;
            const canAddProducts = productLimit === 0 || currentProductCount < productLimit;

            return {
                has_active_subscription: true,
                subscription: activeSubscription,
                can_add_products: canAddProducts,
                product_limit: productLimit,
                current_products: currentProductCount,
                remaining_products: productLimit === 0 ? 'Unlimited' : Math.max(0, productLimit - currentProductCount),
                message: canAddProducts ? 'Subscription active' : 'Product limit reached'
            };
        } catch (error) {
            throw new Error(`Error checking subscription status: ${error.message}`);
        }
    }

    static async findActive() {
        try {
            const [rows] = await pool.query(`
                SELECT vs.*, sp.name_en as package_name_en, sp.name_ar as package_name_ar, 
                       vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       u.name as user_name, u.email as user_email,
                       sp.max_products, sp.commission_rate
                FROM vendor_subscriptions vs
                JOIN subscription_packages sp ON vs.package_id = sp.package_id
                JOIN vendor_types vt ON vs.vendor_type_id = vt.vendor_type_id
                JOIN users u ON vs.user_id = u.user_id
                WHERE vs.status = 'active' AND vs.end_date > NOW()
                ORDER BY vs.end_date ASC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching active subscriptions: ${error.message}`);
        }
    }

    static async findExpired() {
        try {
            const [rows] = await pool.query(`
                SELECT vs.*, sp.name_en as package_name_en, sp.name_ar as package_name_ar, 
                       vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       u.name as user_name, u.email as user_email
                FROM vendor_subscriptions vs
                JOIN subscription_packages sp ON vs.package_id = sp.package_id
                JOIN vendor_types vt ON vs.vendor_type_id = vt.vendor_type_id
                JOIN users u ON vs.user_id = u.user_id
                WHERE vs.status = 'active' AND vs.end_date <= NOW()
                ORDER BY vs.end_date DESC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching expired subscriptions: ${error.message}`);
        }
    }
}

module.exports = VendorSubscription; 