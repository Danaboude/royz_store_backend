const { pool } = require('../db/db');

class UserVendorType {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.vendor_type_id = data.vendor_type_id;
        this.business_name = data.business_name;
        this.business_license = data.business_license;
        this.business_address = data.business_address;
        this.business_phone = data.business_phone;
        this.business_email = data.business_email;
        this.business_website = data.business_website;
        this.is_verified = data.is_verified;
        this.verified_at = data.verified_at;
        this.verification_documents = data.verification_documents;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    static async findByUserId(userId) {
        try {
            const [rows] = await pool.query(`
                SELECT uvt.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       vt.commission_rate, u.name as user_name, u.email as user_email
                FROM user_vendor_types uvt
                JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
                JOIN users u ON uvt.user_id = u.user_id
                WHERE uvt.user_id = ?
            `, [userId]);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching user vendor types: ${error.message}`);
        }
    }

    static async findByVendorTypeId(vendorTypeId) {
        try {
            const [rows] = await pool.query(`
                SELECT uvt.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       vt.commission_rate, u.name as user_name, u.email as user_email
                FROM user_vendor_types uvt
                JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
                JOIN users u ON uvt.user_id = u.user_id
                WHERE uvt.vendor_type_id = ?
            `, [vendorTypeId]);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching vendor types: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT uvt.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       vt.commission_rate, u.name as user_name, u.email as user_email
                FROM user_vendor_types uvt
                JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
                JOIN users u ON uvt.user_id = u.user_id
                WHERE uvt.id = ?
            `, [id]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching user vendor type: ${error.message}`);
        }
    }

    static async findByUserAndVendorType(userId, vendorTypeId) {
        try {
            const [rows] = await pool.query(`
                SELECT uvt.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       vt.commission_rate, u.name as user_name, u.email as user_email
                FROM user_vendor_types uvt
                JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
                JOIN users u ON uvt.user_id = u.user_id
                WHERE uvt.user_id = ? AND uvt.vendor_type_id = ?
            `, [userId, vendorTypeId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching user vendor type: ${error.message}`);
        }
    }

    static async findAll() {
        try {
            const [rows] = await pool.query(`
                SELECT uvt.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       vt.commission_rate, u.name as user_name, u.email as user_email
                FROM user_vendor_types uvt
                JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
                JOIN users u ON uvt.user_id = u.user_id
                ORDER BY uvt.created_at DESC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching user vendor types: ${error.message}`);
        }
    }

    static async create(vendorTypeData) {
        try {
            const { 
                user_id, vendor_type_id, business_name, business_license, 
                business_address, business_phone, business_email, business_website 
            } = vendorTypeData;
            
            if (!user_id || !vendor_type_id) {
                throw new Error('User ID and vendor type ID are required');
            }

            // Check if user already has this vendor type
            const existing = await this.findByUserAndVendorType(user_id, vendor_type_id);
            if (existing) {
                throw new Error('User already has this vendor type');
            }

            const [result] = await pool.query(
                'INSERT INTO user_vendor_types (user_id, vendor_type_id, business_name, business_license, business_address, business_phone, business_email, business_website) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [user_id, vendor_type_id, business_name, business_license, business_address, business_phone, business_email, business_website]
            );
            
            return { id: result.insertId, message: 'User vendor type created successfully' };
        } catch (error) {
            throw new Error(`Error creating user vendor type: ${error.message}`);
        }
    }

    static async update(id, updateData) {
        try {
            const { 
                business_name, business_license, business_address, 
                business_phone, business_email, business_website, 
                is_verified, verification_documents 
            } = updateData;
            
            let updateFields = [];
            let params = [];

            if (business_name !== undefined) {
                updateFields.push('business_name = ?');
                params.push(business_name);
            }
            if (business_license !== undefined) {
                updateFields.push('business_license = ?');
                params.push(business_license);
            }
            if (business_address !== undefined) {
                updateFields.push('business_address = ?');
                params.push(business_address);
            }
            if (business_phone !== undefined) {
                updateFields.push('business_phone = ?');
                params.push(business_phone);
            }
            if (business_email !== undefined) {
                updateFields.push('business_email = ?');
                params.push(business_email);
            }
            if (business_website !== undefined) {
                updateFields.push('business_website = ?');
                params.push(business_website);
            }
            if (is_verified !== undefined) {
                updateFields.push('is_verified = ?');
                params.push(is_verified);
                if (is_verified) {
                    updateFields.push('verified_at = NOW()');
                }
            }
            if (verification_documents !== undefined) {
                updateFields.push('verification_documents = ?');
                params.push(JSON.stringify(verification_documents));
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            params.push(id);

            const [result] = await pool.query(
                `UPDATE user_vendor_types SET ${updateFields.join(', ')} WHERE id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                throw new Error('User vendor type not found');
            }

            return { message: 'User vendor type updated successfully' };
        } catch (error) {
            throw new Error(`Error updating user vendor type: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            const [result] = await pool.query(
                'DELETE FROM user_vendor_types WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                throw new Error('User vendor type not found');
            }

            return { message: 'User vendor type deleted successfully' };
        } catch (error) {
            throw new Error(`Error deleting user vendor type: ${error.message}`);
        }
    }

    static async verify(id) {
        try {
            const [result] = await pool.query(
                'UPDATE user_vendor_types SET is_verified = 1, verified_at = NOW() WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                throw new Error('User vendor type not found');
            }

            return { message: 'User vendor type verified successfully' };
        } catch (error) {
            throw new Error(`Error verifying user vendor type: ${error.message}`);
        }
    }

    static async getUnverifiedVendors() {
        try {
            const [rows] = await pool.query(`
                SELECT uvt.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       vt.commission_rate, u.name as user_name, u.email as user_email
                FROM user_vendor_types uvt
                JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
                JOIN users u ON uvt.user_id = u.user_id
                WHERE uvt.is_verified = 0
                ORDER BY uvt.created_at ASC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching unverified vendors: ${error.message}`);
        }
    }

    static async getVerifiedVendors() {
        try {
            const [rows] = await pool.query(`
                SELECT uvt.*, vt.name_en as vendor_type_name_en, vt.name_ar as vendor_type_name_ar,
                       vt.commission_rate, u.name as user_name, u.email as user_email
                FROM user_vendor_types uvt
                JOIN vendor_types vt ON uvt.vendor_type_id = vt.vendor_type_id
                JOIN users u ON uvt.user_id = u.user_id
                WHERE uvt.is_verified = 1
                ORDER BY uvt.verified_at DESC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching verified vendors: ${error.message}`);
        }
    }
}

module.exports = UserVendorType; 