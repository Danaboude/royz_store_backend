const { pool } = require('../db/db');

class ProductFeature {
    constructor(data) {
        this.feature_id = data.feature_id;
        this.product_id = data.product_id;
        this.feature_name_en = data.feature_name_en;
        this.feature_name_ar = data.feature_name_ar;
        this.feature_value_en = data.feature_value_en;
        this.feature_value_ar = data.feature_value_ar;
        this.feature_type = data.feature_type;
        this.display_order = data.display_order;
        this.created_at = data.created_at;
    }

    static async findByProductId(productId) {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM product_features 
                WHERE product_id = ? 
                ORDER BY display_order ASC, feature_id ASC
            `, [productId]);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching product features: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM product_features WHERE feature_id = ?
            `, [id]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching product feature: ${error.message}`);
        }
    }

    static async create(featureData) {
        try {
            const { 
                product_id, feature_name_en, feature_name_ar, 
                feature_value_en, feature_value_ar, feature_type, display_order 
            } = featureData;
            
            if (!product_id || !feature_name_en || !feature_name_ar) {
                throw new Error('Product ID and feature names are required');
            }

            const [result] = await pool.query(
                'INSERT INTO product_features (product_id, feature_name_en, feature_name_ar, feature_value_en, feature_value_ar, feature_type, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [product_id, feature_name_en, feature_name_ar, feature_value_en, feature_value_ar, feature_type || 'text', display_order || 0]
            );
            
            return { feature_id: result.insertId, message: 'Product feature created successfully' };
        } catch (error) {
            throw new Error(`Error creating product feature: ${error.message}`);
        }
    }

    static async update(id, updateData) {
        try {
            const { 
                feature_name_en, feature_name_ar, feature_value_en, 
                feature_value_ar, feature_type, display_order 
            } = updateData;
            
            let updateFields = [];
            let params = [];

            if (feature_name_en) {
                updateFields.push('feature_name_en = ?');
                params.push(feature_name_en);
            }
            if (feature_name_ar) {
                updateFields.push('feature_name_ar = ?');
                params.push(feature_name_ar);
            }
            if (feature_value_en !== undefined) {
                updateFields.push('feature_value_en = ?');
                params.push(feature_value_en);
            }
            if (feature_value_ar !== undefined) {
                updateFields.push('feature_value_ar = ?');
                params.push(feature_value_ar);
            }
            if (feature_type) {
                updateFields.push('feature_type = ?');
                params.push(feature_type);
            }
            if (display_order !== undefined) {
                updateFields.push('display_order = ?');
                params.push(display_order);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            params.push(id);

            const [result] = await pool.query(
                `UPDATE product_features SET ${updateFields.join(', ')} WHERE feature_id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                throw new Error('Product feature not found');
            }

            return { message: 'Product feature updated successfully' };
        } catch (error) {
            throw new Error(`Error updating product feature: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            const [result] = await pool.query(
                'DELETE FROM product_features WHERE feature_id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                throw new Error('Product feature not found');
            }

            return { message: 'Product feature deleted successfully' };
        } catch (error) {
            throw new Error(`Error deleting product feature: ${error.message}`);
        }
    }

    static async deleteByProductId(productId) {
        try {
            const [result] = await pool.query(
                'DELETE FROM product_features WHERE product_id = ?',
                [productId]
            );

            return { message: `${result.affectedRows} product features deleted successfully` };
        } catch (error) {
            throw new Error(`Error deleting product features: ${error.message}`);
        }
    }

    static async bulkCreate(productId, features) {
        try {
            if (!Array.isArray(features) || features.length === 0) {
                throw new Error('Features array is required');
            }

            const values = features.map(feature => [
                productId,
                feature.feature_name_en,
                feature.feature_name_ar,
                feature.feature_value_en,
                feature.feature_value_ar,
                feature.feature_type || 'text',
                feature.display_order || 0
            ]);

            const [result] = await pool.query(
                'INSERT INTO product_features (product_id, feature_name_en, feature_name_ar, feature_value_en, feature_value_ar, feature_type, display_order) VALUES ?',
                [values]
            );

            return { 
                message: `${features.length} product features created successfully`,
                inserted_count: result.affectedRows
            };
        } catch (error) {
            throw new Error(`Error creating product features: ${error.message}`);
        }
    }
}

module.exports = ProductFeature; 