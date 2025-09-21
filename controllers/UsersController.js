// Users Controller 

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const UserVendorType = require('../models/UserVendorType');
const VendorSubscription = require('../models/VendorSubscription');
const SubscriptionPackage = require('../models/SubscriptionPackage');
const VendorPayment = require('../models/VendorPayment');
const { pool } = require('../db/db');

async function getAllUsers(req, res) {
  try {
    const userRole = req.user.roleId;

    // Only admins can view all users
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Pagination and search
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const search = req.query.search || '';

    const { users, total } = await User.findPaginated({ page, limit, search });
    res.json({ users, total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const userRole = req.user.roleId;

    // Users can only view their own profile, admins can view any
    if (userRole !== 1 && currentUserId != id) {
      return res.status(403).json({ error: 'Access denied - You can only view your own profile' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const userRole = req.user.roleId;

    // Debug: Log the request details
    // Users can only update their own profile, admins can update any
    if (userRole !== 1 && currentUserId != id) {
      return res.status(403).json({ error: 'Access denied - You can only update your own profile' });
    }

    // Handle both JSON and FormData requests
    let updateData = {};

    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      // Handle FormData (file upload)
      updateData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address,
        password: req.body.password
      };

      // If there's a file uploaded, use the file path/URL
      if (req.file) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
        // Create the URL for the uploaded file
        const fileUrl = `http://${baseUrl}/uploads/profile-images/${req.file.filename}`;
        updateData.profile_image = fileUrl;
      } else if (req.body.profile_image === 'null' || req.body.profile_image === '') {
        // Handle profile image removal
        updateData.profile_image = null;
      }
    } else {
      const { name, email, phone, address, password, profile_image, is_active, is_verified, role_id } = req.body || {};
      updateData = { name, email, phone, address, password, profile_image };
      // Only admins can update is_active, is_verified, role_id
      if (userRole === 1) {
        if (is_active !== undefined) updateData.is_active = is_active;
        if (is_verified !== undefined) updateData.is_verified = is_verified;
        if (role_id !== undefined) updateData.role_id = role_id;
      }
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const result = await User.update(id, updateData);

    // If a file was uploaded, return the file URL in the response
    if (req.file) {
      res.json({
        message: result.message,
        profile_image_url: updateData.profile_image
      });
    } else {
      res.json({ message: result.message });
    }
  } catch (error) {
    console.error('updateUser error:', error);
    if (error.code === 'PHONE_ALREADY_USED') {
      res.status(400).json({ error: 'PHONE_ALREADY_USED' });
    } else if (error.message.includes('Email already exists')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Server Error', details: error.message });
    }
  }
}

async function changePassword(req, res) {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const currentUserId = req.user.id;
    const userRole = req.user.roleId;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Users can only change their own password, admins can change any
    if (userRole !== 1 && currentUserId != id) {
      return res.status(403).json({ error: 'Access denied - You can only change your own password' });
    }

    // Get the user to verify current password
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await User.verifyPassword(user, currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password
    const result = await User.update(id, { password: newPassword });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('changePassword error:', error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user.roleId;
    const currentUserId = req.user.id;

    // Only admins can delete users
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }
    // Prevent self-deletion
    if (parseInt(id) === currentUserId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const result = await User.delete(id);
    res.json({ message: result.message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

// New admin-only methods

async function getVendorStatistics(req, res) {
  try {
    const userRole = req.user.roleId;
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }
    const vendors = await User.findVendors();
    const vendorStats = [];
    for (const vendor of vendors) {
      // Get vendor's products
      const products = await Product.findByVendor(vendor.user_id);
      // Get vendor type
      const vendorType = await UserVendorType.findByUserId(vendor.user_id);
      // Get subscription
      const subscription = await VendorSubscription.findActiveByUserId(vendor.user_id);
      let packageInfo = null;
      if (subscription) {
        packageInfo = await SubscriptionPackage.findById(subscription.package_id);
      }
      // Get payments
      const payments = await VendorPayment.findByVendorId(vendor.user_id);
      const pendingPayments = payments.filter(p => p.payment_status === 'pending');
      // Calculate total sales for vendor's products
      let totalSales = 0;
      let totalOrders = 0;
      for (const product of products) {
        const productOrders = await Order.findByProduct(product.product_id);
        const productSales = productOrders.reduce((sum, order) => sum + order.total_amount, 0);
        totalSales += productSales;
        totalOrders += productOrders.length;
      }
      vendorStats.push({
        vendor_id: vendor.user_id,
        vendor_name: vendor.name,
        vendor_email: vendor.email,
        is_active: vendor.is_active,
        is_verified: vendor.is_verified,
        vendor_type: vendorType,
        subscription: subscription,
        package: packageInfo,
        products_count: products.length,
        total_sales: totalSales,
        total_orders: totalOrders,
        payments: payments,
        pending_payments: pendingPayments,
        commission_rate: packageInfo ? packageInfo.commission_rate : null,
        products: products.map(p => ({
          product_id: p.product_id,
          name: p.name,
          price: p.price,
          stock: p.stock
        }))
      });
    }
    res.json(vendorStats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

async function getVendorStatisticsById(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user.roleId;
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }
    const vendor = await User.findById(id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    if (![3, 4, 5].includes(vendor.role_id)) {
      return res.status(400).json({ error: 'User is not a vendor' });
    }
    const products = await Product.findByVendor(id);
    const vendorType = await UserVendorType.findByUserId(vendor.user_id);
    const subscription = await VendorSubscription.findActiveByUserId(vendor.user_id);
    let packageInfo = null;
    if (subscription) {
      packageInfo = await SubscriptionPackage.findById(subscription.package_id);
    }
    const payments = await VendorPayment.findByVendorId(vendor.user_id);
    const pendingPayments = payments.filter(p => p.payment_status === 'pending');
    let totalSales = 0;
    let totalOrders = 0;
    let productStats = [];
    for (const product of products) {
      const productOrders = await Order.findByProduct(product.product_id);
      const productSales = productOrders.reduce((sum, order) => sum + order.total_amount, 0);
      totalSales += productSales;
      totalOrders += productOrders.length;
      productStats.push({
        product_id: product.product_id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        total_sales: productSales,
        orders_count: productOrders.length
      });
    }
    const vendorStats = {
      vendor_id: vendor.user_id,
      vendor_name: vendor.name,
      vendor_email: vendor.email,
      is_active: vendor.is_active,
      is_verified: vendor.is_verified,
      vendor_type: vendorType,
      subscription: subscription,
      package: packageInfo,
      products_count: products.length,
      total_sales: totalSales,
      total_orders: totalOrders,
      payments: payments,
      pending_payments: pendingPayments,
      commission_rate: packageInfo ? packageInfo.commission_rate : null,
      products: productStats
    };
    res.json(vendorStats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

async function changeUserRole(req, res) {
  try {
    const { id } = req.params;
    const { roleId } = req.body;
    const userRole = req.user.roleId;

    // Only admins can change user roles
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Validate role ID
    if (![1, 2, 3, 4, 5].includes(roleId)) {
      return res.status(400).json({ error: 'Invalid role ID. Must be 1 (Admin), 2 (Customer), 3 (Factory Owner), 4 (Real Estate Agent), or 5 (Support Agent)' });
    }

    // Prevent admin from changing their own role
    if (id == req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const result = await User.changeRole(id, roleId);
    res.json({ message: result.message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

async function getUsersByRole(req, res) {
  try {
    const { roleId } = req.params;
    const userRole = req.user.roleId;

    // Only admins can view users by role
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Validate role ID
    if (![1, 2, 3, 4, 5].includes(parseInt(roleId))) {
      return res.status(400).json({ error: 'Invalid role ID. Must be 1 (Admin), 2 (Customer), 3 (Factory Owner), 4 (Real Estate Agent), or 5 (Support Agent)' });
    }

    const users = await User.findByRole(parseInt(roleId));
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

// Stub for sending notification to vendor
async function sendVendorNotification(req, res) {
  // TODO: Implement notification logic
  res.json({ message: 'Notification sent (stub)' });
}

// Update vendor type
async function updateVendorType(req, res) {
  try {
    const userRole = req.user.roleId;
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }
    const { id } = req.params;
    const { vendor_type_id, business_name, business_license, business_address, business_phone, business_email, business_website, is_verified, verification_documents } = req.body;
    const vendorType = await UserVendorType.findByUserId(id);
    if (!vendorType || vendorType.length === 0) {
      // Create new vendor type
      await UserVendorType.create({ user_id: id, vendor_type_id, business_name, business_license, business_address, business_phone, business_email, business_website });
    } else {
      // Update existing vendor type
      await UserVendorType.update(vendorType[0].id, { business_name, business_license, business_address, business_phone, business_email, business_website, is_verified, verification_documents });
    }
    res.json({ message: 'Vendor type updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

// Update vendor subscription
async function updateVendorSubscription(req, res) {
  try {
    const userRole = req.user.roleId;
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }
    const { id } = req.params;
    const { package_id, vendor_type_id, start_date, end_date, amount_paid, is_first_month_free, auto_renew, status, payment_status } = req.body;
    const subscription = await VendorSubscription.findActiveByUserId(id);
    if (!subscription) {
      // Create new subscription
      await VendorSubscription.create({ user_id: id, package_id, vendor_type_id, start_date, end_date, amount_paid, is_first_month_free, auto_renew });
    } else {
      // Update existing subscription
      await VendorSubscription.update(subscription.subscription_id, { status, payment_status, amount_paid, auto_renew, end_date });
    }
    res.json({ message: 'Vendor subscription updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

// Update vendor payment status
async function updateVendorPaymentStatus(req, res) {
  try {
    const userRole = req.user.roleId;
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }
    const { payment_id } = req.params;
    const { status, payment_date, payment_method } = req.body;
    await VendorPayment.updateStatus(payment_id, status, payment_date, payment_method);
    res.json({ message: 'Vendor payment status updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

async function getAllVendorTypes(req, res) {
  try {
    const userRole = req.user.roleId;
    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    const vendors = await User.findAllVendorTypes();

    // Process vendors to add additional information
    const processedVendors = vendors.map(vendor => {
      const daysRemaining = vendor.days_remaining;
      let subscriptionStatus = 'No Subscription';
      let statusColor = 'gray';

      if (vendor.subscription_id) {
        if (daysRemaining > 30) {
          subscriptionStatus = 'Active';
          statusColor = 'green';
        } else if (daysRemaining > 7) {
          subscriptionStatus = 'Expiring Soon';
          statusColor = 'yellow';
        } else if (daysRemaining > 0) {
          subscriptionStatus = 'Expiring Very Soon';
          statusColor = 'orange';
        } else {
          subscriptionStatus = 'Expired';
          statusColor = 'red';
        }
      }

      return {
        ...vendor,
        subscriptionStatus,
        statusColor,
        daysRemaining: daysRemaining || 0
      };
    });

    res.json(processedVendors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

// Get vendor by ID with detailed information
const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.roleId;

    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    const [vendors] = await pool.query(`
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.phone,
        u.address,
        u.profile_image,
        u.is_active,
        u.is_verified,
        u.created_at,
        u.role_id,
        r.role_name,
        uvt.business_name,
        uvt.business_license,
        uvt.business_address,
        uvt.business_phone,
        uvt.business_email,
        uvt.business_website,
        uvt.vendor_type_id,
        vt.name_en as type_name,
        vt.commission_rate,
        vs.subscription_id,
        vs.start_date,
        vs.end_date,
        vs.status as subscription_status,
        vs.payment_status,
        vs.amount_paid,
        vs.auto_renew,
        vs.package_id,
        sp.name_en as package_name,
        sp.price as package_price,
        sp.duration_months,
        DATEDIFF(vs.end_date, CURDATE()) as days_remaining,
        CASE 
          WHEN vs.status = 'active' AND DATEDIFF(vs.end_date, CURDATE()) > 30 THEN 'Active'
          WHEN vs.status = 'active' AND DATEDIFF(vs.end_date, CURDATE()) BETWEEN 8 AND 30 THEN 'Expiring Soon'
          WHEN vs.status = 'active' AND DATEDIFF(vs.end_date, CURDATE()) BETWEEN 1 AND 7 THEN 'Expiring Very Soon'
          WHEN vs.status = 'active' AND DATEDIFF(vs.end_date, CURDATE()) <= 0 THEN 'Expired'
          WHEN vs.status = 'expired' THEN 'Expired'
          ELSE 'No Subscription'
        END as subscriptionStatus
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN user_vendor_types uvt ON u.user_id = uvt.user_id
      LEFT JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
      LEFT JOIN vendor_subscriptions vs ON u.user_id = vs.user_id AND vs.status = 'active'
      LEFT JOIN subscription_packages sp ON vs.package_id = sp.package_id
      WHERE u.user_id = ? AND u.role_id IN (3, 4, 5)
    `, [id]);

    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json(vendors[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error', details: err?.message });
  }
};

// Update vendor information
const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.roleId;
    const updateData = req.body;

    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // Update user basic information
      if (updateData.name || updateData.email || updateData.phone || updateData.address) {
        const userUpdates = [];
        const userValues = [];

        if (updateData.name) {
          userUpdates.push('name = ?');
          userValues.push(updateData.name);
        }
        if (updateData.email) {
          userUpdates.push('email = ?');
          userValues.push(updateData.email);
        }
        if (updateData.phone) {
          userUpdates.push('phone = ?');
          userValues.push(updateData.phone);
        }
        if (updateData.address) {
          userUpdates.push('address = ?');
          userValues.push(updateData.address);
        }

        if (userUpdates.length > 0) {
          userValues.push(id);
          await pool.query(
            `UPDATE users SET ${userUpdates.join(', ')} WHERE user_id = ?`,
            userValues
          );
        }
      }

      // Update vendor business information
      if (updateData.business_name || updateData.business_license || updateData.business_address ||
        updateData.business_phone || updateData.business_email || updateData.business_website) {

        const vendorUpdates = [];
        const vendorValues = [];

        if (updateData.business_name) {
          vendorUpdates.push('business_name = ?');
          vendorValues.push(updateData.business_name);
        }
        if (updateData.business_license) {
          vendorUpdates.push('business_license = ?');
          vendorValues.push(updateData.business_license);
        }
        if (updateData.business_address) {
          vendorUpdates.push('business_address = ?');
          vendorValues.push(updateData.business_address);
        }
        if (updateData.business_phone) {
          vendorUpdates.push('business_phone = ?');
          vendorValues.push(updateData.business_phone);
        }
        if (updateData.business_email) {
          vendorUpdates.push('business_email = ?');
          vendorValues.push(updateData.business_email);
        }
        if (updateData.business_website) {
          vendorUpdates.push('business_website = ?');
          vendorValues.push(updateData.business_website);
        }

        if (vendorUpdates.length > 0) {
          vendorValues.push(id);
          await pool.query(
            `UPDATE user_vendor_types SET ${vendorUpdates.join(', ')} WHERE user_id = ?`,
            vendorValues
          );
        }
      }

      await pool.query('COMMIT');
      res.json({ message: 'Vendor updated successfully' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error', details: err?.message });
  }
};

// Delete vendor
const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.roleId;

    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Check if vendor exists and is actually a vendor
    const [vendors] = await pool.query(
      'SELECT user_id, name FROM users WHERE user_id = ? AND role_id IN (3, 4, 5)',
      [id]
    );

    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // Delete vendor-related data in order (respecting foreign key constraints)

      // 1. Delete order items for products from this vendor
      await pool.query(`
        DELETE oi FROM order_items oi 
        INNER JOIN products p ON oi.product_id = p.product_id 
        WHERE p.vendor_id = ?
      `, [id]);

      // 2. Delete orders from this vendor
      await pool.query('DELETE FROM orders WHERE vendor_id = ?', [id]);

      // 3. Delete vendor payments
      await pool.query('DELETE FROM vendor_payments WHERE vendor_id = ?', [id]);

      // 4. Delete subscription payments (if any)
      await pool.query('DELETE FROM subscription_payments WHERE user_id = ?', [id]);

      // 5. Delete delivery assignments where this user was assigned by
      await pool.query('DELETE FROM delivery_assignments WHERE assigned_by = ?', [id]);

      // 6. Delete vendor subscriptions
      await pool.query('DELETE FROM vendor_subscriptions WHERE user_id = ?', [id]);

      // 7. Delete user vendor types
      await pool.query('DELETE FROM user_vendor_types WHERE user_id = ?', [id]);

      // 8. Delete products from this vendor
      await pool.query('DELETE FROM products WHERE vendor_id = ?', [id]);

      // 9. Finally delete the user (this will cascade delete: carts, delivery_addresses, delivery_personnel, favorites, notifications, reviews)
      await pool.query('DELETE FROM users WHERE user_id = ?', [id]);

      await pool.query('COMMIT');
      res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error during vendor deletion:', error);
      throw error;
    }
  } catch (err) {
    console.error('deleteVendor error:', err);
    res.status(500).json({ error: 'Server Error', details: err?.message });
  }
};

// Toggle vendor status (active/inactive)
const toggleVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.roleId;

    if (userRole !== 1) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Check if vendor exists
    const [vendors] = await pool.query(
      'SELECT user_id, name, is_active FROM users WHERE user_id = ? AND role_id IN (3, 4, 5)',
      [id]
    );

    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const currentStatus = vendors[0].is_active;
    const newStatus = currentStatus ? 0 : 1;

    await pool.query(
      'UPDATE users SET is_active = ? WHERE user_id = ?',
      [newStatus, id]
    );

    res.json({
      message: `Vendor ${newStatus ? 'activated' : 'deactivated'} successfully`,
      is_active: newStatus
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error', details: err?.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getVendorStatistics,
  getVendorStatisticsById,
  changeUserRole,
  getUsersByRole,
  changePassword,
  sendVendorNotification,
  updateVendorType,
  updateVendorSubscription,
  updateVendorPaymentStatus,
  getAllVendorTypes,
  getVendorById,
  updateVendor,
  deleteVendor,
  toggleVendorStatus
}; 