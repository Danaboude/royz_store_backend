const ProductMedia = require('../models/ProductMedia');
const Product = require('../models/Product');

// Utility to prepend base URL to media URLs
function withBaseUrl(url) {
    if (url && url.startsWith('/uploads/')) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

        return `http://${baseUrl}${url}`;
    }
    return url;
}

// Get all media for a product
async function getProductMedia(req, res) {
    try {
        const { productId } = req.params;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const media = await ProductMedia.findByProductId(productId);

        // Transform the data to match frontend expectations
        const transformedMedia = media.map(item => ({
            id: item.media_id,
            product_id: item.product_id,
            url: withBaseUrl(item.media_url),
            type: item.media_type,
            created_at: item.created_at,
            updated_at: item.created_at // Use created_at as updated_at if not available
        }));

        res.json({
            success: true,
            data: transformedMedia,
            message: 'Product media retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting product media:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Get product images only
async function getProductImages(req, res) {
    try {
        const { productId } = req.params;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const images = await ProductMedia.getProductImages(productId);

        // Transform the data to match frontend expectations
        const transformedImages = images.map(item => ({
            id: item.media_id,
            product_id: item.product_id,
            url: withBaseUrl(item.media_url),
            type: item.media_type,
            created_at: item.created_at,
            updated_at: item.created_at
        }));

        res.json({
            success: true,
            data: transformedImages,
            message: 'Product images retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting product images:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Get product videos only
async function getProductVideos(req, res) {
    try {
        const { productId } = req.params;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const videos = await ProductMedia.getProductVideos(productId);

        // Transform the data to match frontend expectations
        const transformedVideos = videos.map(item => ({
            id: item.media_id,
            product_id: item.product_id,
            url: withBaseUrl(item.media_url),
            type: item.media_type,
            created_at: item.created_at,
            updated_at: item.created_at
        }));

        res.json({
            success: true,
            data: transformedVideos,
            message: 'Product videos retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting product videos:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Get main product image
async function getMainProductImage(req, res) {
    try {
        const { productId } = req.params;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const mainImage = await ProductMedia.getMainImage(productId);

        // Transform the data to match frontend expectations
        const transformedMainImage = mainImage ? {
            id: mainImage.media_id,
            product_id: mainImage.product_id,
            url: withBaseUrl(mainImage.media_url),
            type: mainImage.media_type,
            created_at: mainImage.created_at,
            updated_at: mainImage.created_at
        } : null;

        res.json({
            success: true,
            data: transformedMainImage,
            message: 'Main product image retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting main product image:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Get a specific media item
async function getMediaById(req, res) {
    try {
        const { mediaId } = req.params;

        if (!mediaId) {
            return res.status(400).json({ error: 'Media ID is required' });
        }

        const media = await ProductMedia.findById(mediaId);
        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        // Transform the data to match frontend expectations
        const transformedMedia = {
            id: media.media_id,
            product_id: media.product_id,
            url: withBaseUrl(media.media_url),
            type: media.media_type,
            created_at: media.created_at,
            updated_at: media.created_at
        };

        res.json({
            success: true,
            data: transformedMedia,
            message: 'Media retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting media:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Create a new media item
async function createMedia(req, res) {
    try {
        const { productId } = req.params;
        const mediaData = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        // Handle both frontend field names (url, type) and backend field names (media_url, media_type)
        const mediaUrl = mediaData.url || mediaData.media_url;
        const mediaType = mediaData.type || mediaData.media_type;

        if (!mediaUrl || !mediaType) {
            return res.status(400).json({ error: 'Media URL and media type are required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Prepare data for backend
        const backendMediaData = {
            product_id: parseInt(productId),
            media_url: mediaUrl,
            media_type: mediaType
        };

        const result = await ProductMedia.create(backendMediaData);

        // Return the created media with frontend field names
        const createdMedia = {
            id: result.media_id,
            product_id: parseInt(productId),
            url: mediaUrl,
            type: mediaType,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        res.status(201).json({
            success: true,
            data: createdMedia,
            message: 'Media created successfully'
        });
    } catch (error) {
        console.error('Error creating media:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Create multiple media items at once
async function createBulkMedia(req, res) {
    try {
        const { productId } = req.params;
        const { mediaItems } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
            return res.status(400).json({ error: 'Media items array is required' });
        }

        // Validate each media item and transform to backend format
        const backendMediaItems = mediaItems.map(item => {
            const mediaUrl = item.url || item.media_url;
            const mediaType = item.type || item.media_type;

            if (!mediaUrl || !mediaType) {
                throw new Error('Each media item must have url and type');
            }

            return {
                media_url: mediaUrl,
                media_type: mediaType
            };
        });

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const result = await ProductMedia.bulkCreate(parseInt(productId), backendMediaItems);

        res.status(201).json({
            success: true,
            data: result,
            message: 'Media items created successfully'
        });
    } catch (error) {
        console.error('Error creating bulk media:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Update a media item
async function updateMedia(req, res) {
    try {
        const { mediaId } = req.params;
        const updateData = req.body;

        if (!mediaId) {
            return res.status(400).json({ error: 'Media ID is required' });
        }

        // Check if media exists
        const existingMedia = await ProductMedia.findById(mediaId);
        if (!existingMedia) {
            return res.status(404).json({ error: 'Media not found' });
        }

        // Transform frontend field names to backend field names
        const backendUpdateData = {};
        if (updateData.url || updateData.media_url) {
            backendUpdateData.media_url = updateData.url || updateData.media_url;
        }
        if (updateData.type || updateData.media_type) {
            backendUpdateData.media_type = updateData.type || updateData.media_type;
        }

        const result = await ProductMedia.update(mediaId, backendUpdateData);

        res.json({
            success: true,
            data: result,
            message: 'Media updated successfully'
        });
    } catch (error) {
        console.error('Error updating media:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Delete a media item
async function deleteMedia(req, res) {
    try {
        const { mediaId } = req.params;

        if (!mediaId) {
            return res.status(400).json({ error: 'Media ID is required' });
        }

        // Check if media exists
        const existingMedia = await ProductMedia.findById(mediaId);
        if (!existingMedia) {
            return res.status(404).json({ error: 'Media not found' });
        }

        const result = await ProductMedia.delete(mediaId);

        res.json({
            success: true,
            data: result,
            message: 'Media deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting media:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Delete all media for a product
async function deleteProductMedia(req, res) {
    try {
        const { productId } = req.params;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const result = await ProductMedia.deleteByProductId(productId);

        res.json({
            success: true,
            data: result,
            message: 'Product media deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product media:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Upload product media files
async function uploadProductMedia(req, res) {
    try {
        const { productId } = req.params;
        const files = req.files;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const uploadedMedia = [];

        for (const file of files) {
            // Determine media type based on file mimetype
            let mediaType = 'image';
            if (file.mimetype.startsWith('video/')) {
                mediaType = 'video';
            }
            const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

            // Create the file URL
            const fileUrl = `http://${baseUrl}/uploads/product-media/${file.filename}`;

            // Prepare data for backend
            const mediaData = {
                product_id: parseInt(productId),
                media_url: fileUrl,
                media_type: mediaType
            };

            // Save to database
            const result = await ProductMedia.create(mediaData);

            // Add to response
            uploadedMedia.push({
                id: result.media_id,
                product_id: parseInt(productId),
                url: withBaseUrl(fileUrl),
                type: mediaType,
                filename: file.filename,
                originalname: file.originalname,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }

        res.status(201).json({
            success: true,
            data: uploadedMedia,
            message: `${uploadedMedia.length} media file(s) uploaded successfully`
        });
    } catch (error) {
        console.error('Error uploading product media:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Upload product media files without product ID (for new products)
async function uploadMediaWithoutProduct(req, res) {
    try {
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedMedia = [];

        for (const file of files) {
            // Determine media type based on file mimetype
            let mediaType = 'image';
            if (file.mimetype.startsWith('video/')) {
                mediaType = 'video';
            }
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

     
            // Create the file URL
            const fileUrl = `http://${baseUrl}/uploads/product-media/${file.filename}`;

            // Add to response (don't save to database yet)
            uploadedMedia.push({
                url: withBaseUrl(fileUrl),
                type: mediaType,
                filename: file.filename,
                originalname: file.originalname
            });
        }

        res.status(201).json({
            success: true,
            data: uploadedMedia,
            message: `${uploadedMedia.length} media file(s) uploaded successfully`
        });
    } catch (error) {
        console.error('Error uploading media without product:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

module.exports = {
    getProductMedia,
    getProductImages,
    getProductVideos,
    getMainProductImage,
    getMediaById,
    createMedia,
    createBulkMedia,
    updateMedia,
    deleteMedia,
    deleteProductMedia,
    uploadProductMedia,
    uploadMediaWithoutProduct
}; 