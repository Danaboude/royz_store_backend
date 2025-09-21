const ProductFeature = require('../models/ProductFeature');
const Product = require('../models/Product');

// Get all features for a product
async function getProductFeatures(req, res) {
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

        const features = await ProductFeature.findByProductId(productId);
        
        res.json({
            success: true,
            data: features,
            message: 'Product features retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting product features:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

// Get a specific feature
async function getFeatureById(req, res) {
    try {
        const { featureId } = req.params;
        
        if (!featureId) {
            return res.status(400).json({ error: 'Feature ID is required' });
        }

        const feature = await ProductFeature.findById(featureId);
        if (!feature) {
            return res.status(404).json({ error: 'Feature not found' });
        }

        res.json({
            success: true,
            data: feature,
            message: 'Feature retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting feature:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

// Create a new feature
async function createFeature(req, res) {
    try {
        const { productId } = req.params;
        const featureData = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Add product_id to feature data
        featureData.product_id = parseInt(productId);

        const result = await ProductFeature.create(featureData);
        
        res.status(201).json({
            success: true,
            data: result,
            message: 'Feature created successfully'
        });
    } catch (error) {
        console.error('Error creating feature:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

// Create multiple features at once
async function createBulkFeatures(req, res) {
    try {
        const { productId } = req.params;
        const { features } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        if (!Array.isArray(features) || features.length === 0) {
            return res.status(400).json({ error: 'Features array is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const result = await ProductFeature.bulkCreate(parseInt(productId), features);
        
        res.status(201).json({
            success: true,
            data: result,
            message: 'Features created successfully'
        });
    } catch (error) {
        console.error('Error creating bulk features:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

// Update a feature
async function updateFeature(req, res) {
    try {
        const { featureId } = req.params;
        const updateData = req.body;

        if (!featureId) {
            return res.status(400).json({ error: 'Feature ID is required' });
        }

        // Check if feature exists
        const existingFeature = await ProductFeature.findById(featureId);
        if (!existingFeature) {
            return res.status(404).json({ error: 'Feature not found' });
        }

        const result = await ProductFeature.update(featureId, updateData);
        
        res.json({
            success: true,
            data: result,
            message: 'Feature updated successfully'
        });
    } catch (error) {
        console.error('Error updating feature:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

// Delete a feature
async function deleteFeature(req, res) {
    try {
        const { featureId } = req.params;

        if (!featureId) {
            return res.status(400).json({ error: 'Feature ID is required' });
        }

        // Check if feature exists
        const existingFeature = await ProductFeature.findById(featureId);
        if (!existingFeature) {
            return res.status(404).json({ error: 'Feature not found' });
        }

        const result = await ProductFeature.delete(featureId);
        
        res.json({
            success: true,
            data: result,
            message: 'Feature deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting feature:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

// Delete all features for a product
async function deleteProductFeatures(req, res) {
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

        const result = await ProductFeature.deleteByProductId(productId);
        
        res.json({
            success: true,
            data: result,
            message: 'Product features deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product features:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

module.exports = {
    getProductFeatures,
    getFeatureById,
    createFeature,
    createBulkFeatures,
    updateFeature,
    deleteFeature,
    deleteProductFeatures
}; 