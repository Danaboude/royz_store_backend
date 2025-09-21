// User model 

const { pool } = require('../db/db');
const bcrypt = require('bcrypt');

// Add a custom error class at the top of the file
class PhoneAlreadyUsedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PhoneAlreadyUsedError';
    this.code = 'PHONE_ALREADY_USED';
  }
}

class User {
    constructor(data) {
        this.user_id = data.user_id;
        this.role_id = data.role_id;
        this.name = data.name;
        this.email = data.email;
        this.password_hash = data.password_hash;
        this.phone = data.phone;
        this.address = data.address;
        this.profile_image = data.profile_image;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // Static methods for database operations
    static async findAll() {
        try {
            const [rows] = await pool.query(`
                SELECT u.user_id, u.name, u.email, u.phone, u.address, u.profile_image, u.role_id, r.role_name,
                       u.is_active, u.is_verified
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                ORDER BY u.name
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching users: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT u.user_id, u.name, u.email, u.phone, u.address, u.profile_image, u.password_hash, r.role_name, u.role_id
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                WHERE u.user_id = ?
            `, [id]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching user: ${error.message}`);
        }
    }

    static async findByEmail(email) {
        try {
            const [rows] = await pool.query(`
                SELECT u.*, r.role_name
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                WHERE u.email = ?
            `, [email]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching user by email: ${error.message}`);
        }
    }

    static async findByPhone(phone) {
        try {
            const [rows] = await pool.query(
                `SELECT u.*, r.role_name FROM users u JOIN roles r ON u.role_id = r.role_id WHERE u.phone = ?`,
                [phone]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching user by phone: ${error.message}`);
        }
    }

    static async findByRole(roleId) {
        try {
            const [rows] = await pool.query(`
                SELECT u.user_id, u.name, u.email, u.phone, u.address, u.profile_image, r.role_name
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                WHERE u.role_id = ?
                ORDER BY u.name
            `, [roleId]);
            
            return rows;
        } catch (error) {
            throw new Error(`Error fetching users by role: ${error.message}`);
        }
    }

    static async findVendors() {
        try {
            const [rows] = await pool.query(`
                SELECT u.user_id, u.name, u.email, u.phone, u.address, u.profile_image, r.role_name
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                WHERE u.role_id IN (3, 4, 5)
                ORDER BY u.name
            `);
            
            return rows;
        } catch (error) {
            throw new Error(`Error fetching vendors: ${error.message}`);
        }
    }

    static async findAllVendorTypes() {
        try {
            const [rows] = await pool.query(`
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
                    r.role_id,
                    r.role_name,
                    uvt.business_name,
                    uvt.business_license,
                    uvt.business_address,
                    uvt.business_phone,
                    uvt.business_email,
                    uvt.business_website,
                    vt.vendor_type_id,
                    vt.name_en as type_name,
                    vt.commission_rate,
                    vs.subscription_id,
                    vs.start_date,
                    vs.end_date,
                    vs.status as subscription_status,
                    vs.payment_status,
                    vs.amount_paid,
                    vs.auto_renew,
                    sp.package_id,
                    sp.name_en as package_name,
                    sp.price as package_price,
                    sp.duration_months,
                    DATEDIFF(vs.end_date, CURDATE()) as days_remaining,
                    vd.owner_name,
                    vd.identity_number,
                    vd.tax_number,
                    vd.commercial_registration_number,
                    vd.commercial_registration_doc,
                    vd.tax_registration_doc,
                    vd.identity_doc,
                    vd.signature_authorization_doc,
                    vd.lease_or_ownership_doc,
                    vd.special_license_doc
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                LEFT JOIN user_vendor_types uvt ON u.user_id = uvt.user_id
                LEFT JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
                LEFT JOIN vendor_subscriptions vs ON u.user_id = vs.user_id AND vs.status = 'active'
                LEFT JOIN subscription_packages sp ON vs.package_id = sp.package_id
                LEFT JOIN vendor_details vd ON u.user_id = vd.user_id
                WHERE u.role_id IN (3, 4, 5)
                ORDER BY u.name
            `);
            
            return rows;
        } catch (error) {
            throw new Error(`Error fetching all vendor types: ${error.message}`);
        }
    }

    static async create(userData) {
        try {
            const { roleId, name, email, password, phone, address, profile_image } = userData;
            
            // Validate required fields
            if (!roleId || !name || !email || !password) {
                throw new Error('Role ID, name, email, and password are required');
            }

            // Hash password
            const password_hash = await bcrypt.hash(password, 10);
            
            const [result] = await pool.query(
                'INSERT INTO users (role_id, name, email, password_hash, phone, address, profile_image) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [roleId, name, email, password_hash, phone, address, profile_image]
            );
            
            return { user_id: result.insertId, message: 'User created successfully' };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Email already exists');
            }
            throw new Error(`Error creating user: ${error.message}`);
        }
    }

    static async update(id, updateData) {
        try {
            const { name, email, phone, address, password, profile_image, is_active, is_verified, role_id } = updateData;
            
            let updateFields = [];
            let params = [];

            // Phone uniqueness check
            if (phone) {
                const [rows] = await pool.query('SELECT user_id FROM users WHERE phone = ? AND user_id != ?', [phone, id]);
                if (rows.length > 0) {
                    throw new PhoneAlreadyUsedError('Phone number already used by another user');
                }
            }

            if (name) {
                updateFields.push('name = ?');
                params.push(name);
            }
            if (email) {
                updateFields.push('email = ?');
                params.push(email);
            }
            if (phone) {
                updateFields.push('phone = ?');
                params.push(phone);
            }
            if (address) {
                updateFields.push('address = ?');
                params.push(address);
            }
            if (profile_image !== undefined && profile_image !== null && profile_image !== '' && 
                typeof profile_image === 'string' && profile_image.trim() !== '') {
                updateFields.push('profile_image = ?');
                params.push(profile_image);
            } else if (profile_image === null || profile_image === '' || 
                      (typeof profile_image === 'object' && Object.keys(profile_image).length === 0)) {
                // Handle explicit null/empty string/empty object to clear the profile image
                updateFields.push('profile_image = ?');
                params.push(null);
            }
            if (password) {
                const password_hash = await bcrypt.hash(password, 10);
                updateFields.push('password_hash = ?');
                params.push(password_hash);
            }
            if (is_active !== undefined) {
                updateFields.push('is_active = ?');
                params.push(is_active);
            }
            if (is_verified !== undefined) {
                updateFields.push('is_verified = ?');
                params.push(is_verified);
            }
            if (role_id !== undefined) {
                updateFields.push('role_id = ?');
                params.push(role_id);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            params.push(id);

            const [result] = await pool.query(
                `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                throw new Error('User not found');
            }

            return { message: 'User updated successfully' };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Email already exists');
            }
            if (error.code === 'PHONE_ALREADY_USED' || error instanceof PhoneAlreadyUsedError) {
                throw error;
            }
            throw new Error(`Error updating user: ${error.message}`);
        }
    }

    static async changeRole(id, roleId) {
        try {
                    // Validate role ID
        if (![1, 2, 3, 4, 5].includes(roleId)) {
            throw new Error('Invalid role ID. Must be 1 (Admin), 2 (Customer), 3 (Factory Owner), 4 (Real Estate Agent), or 5 (Support Agent)');
        }

            const [result] = await pool.query(
                'UPDATE users SET role_id = ? WHERE user_id = ?',
                [roleId, id]
            );

            if (result.affectedRows === 0) {
                throw new Error('User not found');
            }

            return { message: 'User role updated successfully' };
        } catch (error) {
            throw new Error(`Error changing user role: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            // Soft delete: set is_active = 0
            const [result] = await pool.query('UPDATE users SET is_active = 0 WHERE user_id = ?', [id]);
            if (result.affectedRows === 0) {
                throw new Error('User not found');
            }
            return { message: 'User deactivated successfully' };
        } catch (error) {
            throw new Error(`Error deactivating user: ${error.message}`);
        }
    }

    static async verifyPassword(user, password) {
        if (!user || !user.password_hash || !password) {
            return false;
        }
        return await bcrypt.compare(password, user.password_hash);
    }

    static async findPaginated({ page = 1, limit = 20, search = '' }) {
        try {
            const offset = (page - 1) * limit;
            let whereClause = '';
            let params = [];
            if (search) {
                whereClause = `WHERE u.name LIKE ? OR u.email LIKE ?`;
                params.push(`%${search}%`, `%${search}%`);
            }
            // Get total count
            const [countRows] = await pool.query(`
                SELECT COUNT(*) as total
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                ${whereClause}
            `, params);
            const total = countRows[0]?.total || 0;
            // Get paginated users
            const [rows] = await pool.query(`
                SELECT u.user_id, u.name, u.email, u.phone, u.address, u.profile_image, u.role_id, r.role_name,
                       u.is_active, u.is_verified
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                ${whereClause}
                ORDER BY u.name
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);
            return { users: rows, total };
        } catch (error) {
            throw new Error(`Error fetching paginated users: ${error.message}`);
        }
    }

    // Instance methods
    toJSON() {
        const { password_hash, ...userWithoutPassword } = this;
        return userWithoutPassword;
    }
}

module.exports = User; 