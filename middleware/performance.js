const { cache, queryWithCache } = require('../db/db');

// Cache middleware for API responses
const cacheMiddleware = (ttl = 3600) => {
    return async (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Skip caching for authenticated requests
        if (req.headers.authorization) {
            return next();
        }

        const cacheKey = `api:${req.originalUrl}`;
        
        try {
            const cachedData = await cache.get(cacheKey);
            if (cachedData) {
                return res.json({
                    ...cachedData,
                    cached: true,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn('Cache middleware error:', error.message);
        }

        // Store original send method
        const originalSend = res.json;
        
        // Override send method to cache response
        res.json = function(data) {
            // Cache the response
            cache.set(cacheKey, data, ttl).catch(err => {
                console.warn('Failed to cache response:', err.message);
            });
            
            // Call original send method
            return originalSend.call(this, data);
        };

        next();
    };
};

// Query optimization middleware
const queryOptimization = (req, res, next) => {
    // Add query optimization hints
    req.queryOptimization = {
        useCache: true,
        maxResults: req.query.limit ? Math.min(parseInt(req.query.limit), 1000) : 100,
        timeout: 30000
    };
    
    next();
};

// Response time monitoring
const responseTimeMonitor = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        // Log slow requests
        if (duration > 1000) {
            console.warn(`🐌 Slow request: ${req.method} ${req.originalUrl} - ${duration}ms - ${status}`);
        }
        
        // Log very slow requests
        if (duration > 5000) {
            console.error(`🐌🐌 Very slow request: ${req.method} ${req.originalUrl} - ${duration}ms - ${status}`);
        }
        
        // Add response time header
        res.setHeader('X-Response-Time', `${duration}ms`);
    });
    
    next();
};

// Database connection monitoring
const dbConnectionMonitor = (req, res, next) => {
    const { pool } = require('../db/db');
    
    // Add connection info to request
    req.dbInfo = {
        poolSize: pool.config.connectionLimit,
        activeConnections: pool._allConnections.length,
        idleConnections: pool._freeConnections.length
    };
    
    next();
};

// Memory usage monitoring
const memoryMonitor = (req, res, next) => {
    const memUsage = process.memoryUsage();
    
    // Log high memory usage
    if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
        console.warn(`⚠️ High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }
    
    // Add memory info to response headers
    res.setHeader('X-Memory-Usage', `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    next();
};

// Rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const userRequests = new Map();
    
    return (req, res, next) => {
        const userId = req.user?.user_id || req.ip;
        const now = Date.now();
        
        if (!userRequests.has(userId)) {
            userRequests.set(userId, []);
        }
        
        const userRequestsList = userRequests.get(userId);
        
        // Remove old requests outside the window
        const validRequests = userRequestsList.filter(time => now - time < windowMs);
        userRequests.set(userId, validRequests);
        
        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000 / 60} minutes`,
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }
        
        validRequests.push(now);
        next();
    };
};

// Query result size limiting
const resultSizeLimit = (maxSize = 1000) => {
    return (req, res, next) => {
        const originalJson = res.json;
        
        res.json = function(data) {
            if (Array.isArray(data) && data.length > maxSize) {
                console.warn(`Large result set: ${data.length} items for ${req.originalUrl}`);
                data = data.slice(0, maxSize);
            }
            
            return originalJson.call(this, data);
        };
        
        next();
    };
};

// Compression optimization
const compressionOptimization = (req, res, next) => {
    // Set appropriate cache headers for different content types
    if (req.path.includes('/api/products') || req.path.includes('/api/categories')) {
        res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    } else if (req.path.includes('/api/statistics')) {
        res.set('Cache-Control', 'public, max-age=60'); // 1 minute
    }
    
    next();
};

// Error tracking middleware
const errorTracking = (req, res, next) => {
    const originalError = console.error;
    
    console.error = function(...args) {
        // Log additional context for errors
        const errorContext = {
            url: req.originalUrl,
            method: req.method,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            timestamp: new Date().toISOString()
        };
        
        originalError.call(console, ...args, '\nContext:', errorContext);
    };
    
    next();
};

// Performance metrics collection
const performanceMetrics = (req, res, next) => {
    const startTime = process.hrtime();
    
    res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000;
        
        // Collect metrics
        const metrics = {
            endpoint: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode,
            duration: Math.round(duration),
            timestamp: new Date().toISOString()
        };
        
        // Store metrics in cache for analytics
        const metricsKey = `metrics:${new Date().toISOString().split('T')[0]}`;
        cache.get(metricsKey).then(existingMetrics => {
            const allMetrics = existingMetrics || [];
            allMetrics.push(metrics);
            
            // Keep only last 1000 metrics per day
            if (allMetrics.length > 1000) {
                allMetrics.splice(0, allMetrics.length - 1000);
            }
            
            cache.set(metricsKey, allMetrics, 86400); // 24 hours
        }).catch(err => {
            console.warn('Failed to store metrics:', err.message);
        });
    });
    
    next();
};

// Database query optimization hints
const queryHints = (req, res, next) => {
    // Add query hints based on request type
    if (req.path.includes('/api/products') && req.query.search) {
        req.queryHints = {
            useFullTextSearch: true,
            indexHint: 'USE INDEX (ft_products_name_description)'
        };
    }
    
    if (req.path.includes('/api/orders') && req.query.status) {
        req.queryHints = {
            useIndex: 'idx_orders_status'
        };
    }
    
    next();
};

// Cache warming for frequently accessed data
const cacheWarming = async () => {
    const { pool } = require('../db/db');
    
    try {
        // Warm cache with frequently accessed data
        const queries = [
            { key: 'cache:categories', sql: 'SELECT * FROM categories WHERE is_active = 1' },
            { key: 'cache:vendor_types', sql: 'SELECT * FROM vendor_types WHERE is_active = 1' },
            { key: 'cache:delivery_zones', sql: 'SELECT * FROM delivery_zones WHERE is_active = 1' },
            { key: 'cache:popular_products', sql: 'SELECT * FROM products WHERE is_best_selling = 1 AND deleted = 0 LIMIT 20' }
        ];
        
        for (const query of queries) {
            const [rows] = await pool.query(query.sql);
            await cache.set(query.key, rows, 3600); // 1 hour
        }
        
            } catch (error) {
        console.warn('⚠️ Cache warming failed:', error.message);
    }
};

// Schedule cache warming
setInterval(cacheWarming, 30 * 60 * 1000); // Every 30 minutes

module.exports = {
    cacheMiddleware,
    queryOptimization,
    responseTimeMonitor,
    dbConnectionMonitor,
    memoryMonitor,
    userRateLimit,
    resultSizeLimit,
    compressionOptimization,
    errorTracking,
    performanceMetrics,
    queryHints,
    cacheWarming
}; 