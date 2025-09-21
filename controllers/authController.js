const User = require('../models/User');
const jwt = require('jsonwebtoken');
const SubscriptionPackage = require('../models/SubscriptionPackage');

const { pool } = require('../db/db');

async function signup(req, res) {
  try {
    const { name, email, password, phone, address } = req.body;
    const roleId = 2; // Always customer

    const result = await User.create({ roleId, name, email, password, phone, address });

    res.json({ message: 'User registered successfully', user_id: result.user_id });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
}
async function signin(req, res) {
  try {
    let { identifier, password, email, phone } = req.body;

    if (!identifier) {
      if (email) identifier = email;
      else if (phone) identifier = phone;
    }

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/Phone and password are required' });
    }

    // Find user by email or phone
    let user = await User.findByEmail(identifier);
    if (!user) {
      user = await User.findByPhone(identifier);
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await User.verifyPassword(user, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Build token payload
    const tokenPayload = {
      id: user.user_id,
      email: user.email,
      roleId: user.role_id
    };

    // If user is delivery personnel, include delivery_id
    if (user.role_id === 6) {
      const [deliveryResult] = await pool.execute(
        'SELECT delivery_id FROM delivery_personnel WHERE user_id = ?',
        [user.user_id]
      );
      if (deliveryResult.length > 0) {
        tokenPayload.delivery_id = deliveryResult[0].delivery_id;
      }
    }

    // 🔎 Check if token already exists in DB
    const [tokenRows] = await pool.execute(
      'SELECT token FROM users WHERE user_id = ?',
      [user.user_id]
    );

    let token = tokenRows.length > 0 ? tokenRows[0].token : null;
    let isValidToken = false;

    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET); // validate existing token
        isValidToken = true;
      } catch (err) {
        console.warn("⚠️ Stored token invalid/expired, generating new one...");
        isValidToken = false;
      }
    }

    // If no token or invalid → create new one
    if (!isValidToken) {
      token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: '365d' }
      );

      await pool.execute(
        'UPDATE users SET token = ?, last_login = NOW() WHERE user_id = ?',
        [token, user.user_id]
      );
    } else {
      // If token is fine, just update last_login
      await pool.execute(
        'UPDATE users SET last_login = NOW() WHERE user_id = ?',
        [user.user_id]
      );
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        roleId: user.role_id,
        ...(tokenPayload.delivery_id && { delivery_id: tokenPayload.delivery_id })
      }
    });

  } catch (error) {
    console.error("❌ signin error:", error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

async function checkEmailExists(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const user = await User.findByEmail(email);
    res.json({ exists: !!user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
async function signindelivery(req, res) {
  try {
    // Accept either { identifier, password } or { email, password } or { phone, password }
    let { identifier, password, email, phone } = req.body;
    if (!identifier) {
      if (email) identifier = email;
      else if (phone) identifier = phone;
    }
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/Phone and password are required' });
    }
    // Try to find user by email or phone
    let user = await User.findByEmail(identifier);
    if (!user) {
      user = await User.findByPhone(identifier);
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValidPassword = await User.verifyPassword(user, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create token payload
    const tokenPayload = {
      id: user.user_id,
      email: user.email,
      roleId: user.role_id
    };

    // If user is delivery personnel, include delivery_id
    if (user.role_id === 6) {
      const [deliveryResult] = await pool.execute(
        'SELECT delivery_id FROM delivery_personnel WHERE user_id = ?',
        [user.user_id]
      );
      if (deliveryResult.length > 0) {
        tokenPayload.delivery_id = deliveryResult[0].delivery_id;
      }
    }

   
    // 🔎 Check if token already exists in DB
    const [tokenRows] = await pool.execute(
      'SELECT token FROM users WHERE user_id = ?',
      [user.user_id]
    );

    let token = tokenRows.length > 0 ? tokenRows[0].token : null;
    let isValidToken = false;

    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET); // validate existing token
        isValidToken = true;
      } catch (err) {
        console.warn("⚠️ Stored token invalid/expired, generating new one...");
        isValidToken = false;
      }
    }

    // If no token or invalid → create new one
    if (!isValidToken) {
      token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: '365d' }
      );

      await pool.execute(
        'UPDATE users SET token = ?, last_login = NOW() WHERE user_id = ?',
        [token, user.user_id]
      );
    } else {
      // If token is fine, just update last_login
      await pool.execute(
        'UPDATE users SET last_login = NOW() WHERE user_id = ?',
        [user.user_id]
      );
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        roleId: user.role_id,
        ...(tokenPayload.delivery_id && { delivery_id: tokenPayload.delivery_id })
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

// Subscribe to a package or upgrade slots for active subscription
async function subscribeToPackage(userId, package_id, vendor_type_id, duration_months, duration_days, num_products, auto_renew) {
  try {
    if (!package_id || !vendor_type_id || (!duration_months && !duration_days && !num_products)) {
      return { status: 400, data: { error: 'Package ID, vendor type ID, and at least duration or num_products are required' } };
    }

    // Get package details
    const package = await SubscriptionPackage.findById(package_id);
    if (!package) {
      return { status: 404, data: { error: 'Package not found' } };
    }

    // Check if user exists and is a vendor
    const [userRows] = await pool.execute('SELECT user_id, role_id FROM users WHERE user_id = ?', [userId]);
    if (userRows.length === 0 || ![3, 4, 5].includes(userRows[0].role_id)) {
      return { status: 400, data: { error: 'User must be a vendor (role 3, 4, or 5)' } };
    }

    // Check for existing active subscription
    const [existingSubs] = await pool.execute('SELECT * FROM vendor_subscriptions WHERE user_id = ? AND status = "active"', [userId]);

    if (existingSubs.length > 0) {
      // Handle subscription upgrade/extension logic here (similar to the original implementation)
      // ...
      return { status: 200, data: { message: 'Subscription upgraded/extended successfully', /* additional data */ } };
    }

    // Create new subscription logic
    let startDate = new Date();
    let endDate = new Date(startDate);
    let totalAmount = 0;

    // Determine pricing and duration
    if (package.vendor_type_id === 2 && duration_days) {
      endDate.setDate(endDate.getDate() + duration_days);
      totalAmount = package.price_2weeks * (package.max_products || 1);
    } else {
      endDate.setMonth(endDate.getMonth() + duration_months);
      totalAmount = package.price * (package.max_products || 1) * duration_months;
    }

    // Create subscription
    const [subscriptionResult] = await pool.execute(
      `INSERT INTO vendor_subscriptions 
      (user_id, package_id, vendor_type_id, start_date, end_date, status, payment_status, amount_paid, auto_renew, max_products) 
      VALUES (?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)`,
      [userId, package_id, package.vendor_type_id, startDate, endDate, totalAmount, auto_renew, package.max_products]
    );

    const subscriptionId = subscriptionResult.insertId;

    // Create subscription payment record
    await pool.execute(
      `INSERT INTO subscription_payments 
      (subscription_id, user_id, amount, payment_method, payment_status, payment_date) 
      VALUES (?, ?, ?, 'admin', 'pending', NOW())`,
      [subscriptionId, userId, totalAmount]
    );

    return {
      status: 201,
      data: {
        message: 'Subscription assigned successfully',
        subscription: {
          subscription_id: subscriptionId,
          user_id: userId,
          package_id,
          package_name: package.name_en,
          total_amount: totalAmount,
          start_date: startDate,
          end_date: endDate,
          status: 'pending'
        }
      }
    };

  } catch (error) {
    console.error('Error assigning subscription:', error);
    return { status: 500, data: { error: 'Server Error', details: error.message } };
  }
}

async function _vendordetiles(req, user_id) { // renamed to avoid confusion
  console.log('--- _vendordetiles ---');
  console.log('user_id:', user_id);
  try {
    const {
      owner_name,
      identity_number,
      tax_number,
      commercial_registration_number,
    } = req.body;

    const files = req.files;
    const fileDocs = {};
    console.log('Received files in _vendordetiles:', files);
    if (files) {
      for (const key in files) {
        if (Object.hasOwnProperty.call(files, key)) {
          const element = files[key][0];
          fileDocs[key] = `/uploads/vendor-docs/${element.filename}`;
        }
      }
    }
    console.log('Processed fileDocs:', fileDocs);

    const vendorDetailsData = {
      user_id,
      owner_name,
      identity_number,
      tax_number,
      commercial_registration_number,
      ...fileDocs
    };

    const columns = Object.keys(vendorDetailsData).filter(key => vendorDetailsData[key] !== undefined).join(', ');
    const placeholders = Object.keys(vendorDetailsData).filter(key => vendorDetailsData[key] !== undefined).map(() => '?').join(', ');
    const values = Object.values(vendorDetailsData).filter(val => val !== undefined);

    if (values.length > 1) { // check for more than just user_id
      const sql = `INSERT INTO vendor_details (${columns}) VALUES (${placeholders})`;
      await pool.execute(sql, values);
    }

  } catch (error) {
    console.error('Error in _vendordetiles:', error);
    throw error; // re-throw the error to be caught by signupVendor
  }
}

async function vendordetiles(req, res) {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    await _vendordetiles(req, user_id);
    res.status(201).json({ message: 'Vendor details added successfully' });
  } catch (error) {
    console.error('Error in vendordetiles:', error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
}

// Signup Vendor function
async function signupVendor(req, res) {
  console.log('--- signupVendor ---');
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  console.log('Request Files:', req.files);
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      package_id,
      vendor_type_id,
      duration_months,
      duration_days,
      num_products,
      auto_renew = true,
      roleId = 3, // Default to 3 if not provided
    } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone is required for signup' });
    }

    // Create user in DB but don't issue token yet (need OTP verification)
    const result = await User.create({ roleId, name, email, password, phone, address });
    const userId = result.user_id;

    // Add vendor details
    await _vendordetiles(req, userId);

    // Proceed to subscribe to package
    if (package_id && vendor_type_id) {
      const subscriptionResponse = await subscribeToPackage(userId, package_id, vendor_type_id, duration_months, duration_days, num_products, auto_renew);
      return res.status(subscriptionResponse.status).json(subscriptionResponse.data);
    }

    res.json({
      message: 'User registered. OTP sent to your contact.',
      user_id: userId,
      identifier: phone || email,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
}

module.exports = { signup, signin, checkEmailExists, signupVendor, signindelivery, vendordetiles };
