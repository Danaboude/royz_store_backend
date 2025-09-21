const { pool } = require('../db/db');

class ProductMedia {
    constructor(data) {
        this.media_id = data.media_id;
        this.product_id = data.product_id;
        this.media_url = data.media_url;
        this.media_type = data.media_type;
        this.created_at = data.created_at;
    }

    static async findByProductId(productId) {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM product_media 
                WHERE product_id = ? 
                ORDER BY media_id ASC
            `, [productId]);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching product media: ${error.message}`);
        }
    }

    static async findByProductIdAndType(productId, mediaType) {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM product_media 
                WHERE product_id = ? AND media_type = ?
                ORDER BY media_id ASC
            `, [productId, mediaType]);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching product media: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM product_media WHERE media_id = ?
            `, [id]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching product media: ${error.message}`);
        }
    }

    static async create(mediaData) {
        try {
            const { product_id, media_url, media_type } = mediaData;
            
            if (!product_id || !media_url || !media_type) {
                throw new Error('Product ID, media URL, and media type are required');
            }

            // Validate media type
            const validTypes = ['image', 'video'];
            if (!validTypes.includes(media_type)) {
                throw new Error('Media type must be either "image" or "video"');
            }

            const [result] = await pool.query(
                'INSERT INTO product_media (product_id, media_url, media_type) VALUES (?, ?, ?)',
                [product_id, media_url, media_type]
            );
            
            return { media_id: result.insertId, message: 'Product media created successfully' };
        } catch (error) {
            throw new Error(`Error creating product media: ${error.message}`);
        }
    }

    static async update(id, updateData) {
        try {
            const { media_url, media_type } = updateData;
            
            let updateFields = [];
            let params = [];

            if (media_url) {
                updateFields.push('media_url = ?');
                params.push(media_url);
            }
            if (media_type) {
                // Validate media type
                const validTypes = ['image', 'video'];
                if (!validTypes.includes(media_type)) {
                    throw new Error('Media type must be either "image" or "video"');
                }
                updateFields.push('media_type = ?');
                params.push(media_type);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            params.push(id);

            const [result] = await pool.query(
                `UPDATE product_media SET ${updateFields.join(', ')} WHERE media_id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                throw new Error('Product media not found');
            }

            return { message: 'Product media updated successfully' };
        } catch (error) {
            throw new Error(`Error updating product media: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            const [result] = await pool.query(
                'DELETE FROM product_media WHERE media_id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                // Instead of throwing, just return a message
                return { message: 'Product media not found or already deleted' };
            }

            return { message: 'Product media deleted successfully' };
        } catch (error) {
            throw new Error(`Error deleting product media: ${error.message}`);
        }
    }

    static async deleteByProductId(productId) {
        try {
            const [result] = await pool.query(
                'DELETE FROM product_media WHERE product_id = ?',
                [productId]
            );

            return { message: `${result.affectedRows} product media items deleted successfully` };
        } catch (error) {
            throw new Error(`Error deleting product media: ${error.message}`);
        }
    }

    static async bulkCreate(productId, mediaItems) {
                try {
            if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
                throw new Error('Media items array is required');
            }

            // Filter out media that already exists for this product
            const filteredItems = [];
            for (const item of mediaItems) {
                const [rows] = await pool.query(
                    'SELECT 1 FROM product_media WHERE product_id = ? AND media_url = ? AND media_type = ? LIMIT 1',
                    [productId, item.media_url, item.media_type]
                );
                if (rows.length === 0) {
                    filteredItems.push(item);
                } else {
                                    }
            }
            if (filteredItems.length === 0) {
                return { message: 'No new product media to insert (all were duplicates)' };
            }

            const values = filteredItems.map(item => [
                productId,
                item.media_url,
                item.media_type
            ]);

            const [result] = await pool.query(
                'INSERT INTO product_media (product_id, media_url, media_type) VALUES ?',
                [values]
            );
            
            return { 
                message: `${filteredItems.length} product media items created successfully`,
                inserted_count: result.affectedRows
            };
        } catch (error) {
            throw new Error(`Error creating product media: ${error.message}`);
        }
    }

    static async getProductImages(productId) {
        try {
            return await this.findByProductIdAndType(productId, 'image');
        } catch (error) {
            throw new Error(`Error fetching product images: ${error.message}`);
        }
    }

    static async getProductVideos(productId) {
        try {
            return await this.findByProductIdAndType(productId, 'video');
        } catch (error) {
            throw new Error(`Error fetching product videos: ${error.message}`);
        }
    }

    static async getMainImage(productId) {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM product_media 
                WHERE product_id = ? AND media_type = 'image'
                ORDER BY media_id ASC
                LIMIT 1
            `, [productId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error fetching main product image: ${error.message}`);
        }
    }
}

module.exports = ProductMedia; 