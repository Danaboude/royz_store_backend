const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Import routes
const productsRouter = require("./routes/products");
const authRouter = require("./routes/auth");
const categoriesRouter = require("./routes/categories");
const cartsRouter = require("./routes/carts");
const ordersRouter = require("./routes/orders");
const usersRouter = require("./routes/users");
const couponsRouter = require("./routes/coupons");
const deliveryAddressesRouter = require("./routes/deliveryAddresses");
const reviewsRouter = require("./routes/reviews");
const paymentsRouter = require("./routes/payments");
const notificationsRouter = require("./routes/notifications");
const staticPagesRouter = require("./routes/staticPages");
const productMediaRouter = require("./routes/productMedia");
const rolesRouter = require("./routes/roles");
const statisticsRouter = require('./routes/statistics');
const bannersRouter = require('./routes/banners');
const favoritesRouter = require('./routes/favorites');
const deliveryRouter = require('./routes/delivery');
const subscriptionsRouter = require('./routes/subscriptions');
const homeRouter = require('./routes/home');
const databaseProceduresRouter = require('./routes/databaseProcedures');
const vendorPaymentsRouter = require('./routes/vendorPayments');
const vendorProductsRouter = require('./routes/vendorProducts');
const vendorOnlyProductsRouter = require('./routes/vendorOnlyProducts');

// Import enhanced database
const { pool, cache } = require('./db/db');

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Compression middleware for better performance
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1500, // limit each IP to 500 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // allow more requests for development
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Enable CORS for all routes
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
// app.use(cors({
//   origin: "http://localhost:3000", // allow frontend
//   credentials: true,               // allow cookies/auth headers if needed
// }));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware with increased limits
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
}));

// Request timing middleware
app.use((req, res, next) => {
    req.startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - req.startTime;
            });
    next();
});

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint (root)
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        await pool.query('SELECT 1');
        
        // Test cache if available
        const cacheStatus = cache.redisClient ? 'connected' : 'not available';
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            cache: cacheStatus,
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Health check endpoint (API version)
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        await pool.query('SELECT 1');
        
        // Test cache if available
        const cacheStatus = cache.redisClient ? 'connected' : 'not available';
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            cache: cacheStatus,
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// API versioning middleware
app.use('/v1', (req, res, next) => {
    req.apiVersion = 'v1';
    next();
});

// Auth routes with rate limiting
app.use('/auth', authLimiter, authRouter);

// Product routes (public view products, but adding products should be for vendors only)
// If you want, you can apply:
// app.post('/products', authController.authenticateJWT, authController.authorizeRoles([1, 3, 4, 5]), productsRouter.createProduct);
app.use('/products', productsRouter);

// Categories routes
app.use('/categories', categoriesRouter);

// Cart routes (customers only)
app.use('/carts', cartsRouter);

// Order routes
app.use('/orders', ordersRouter);

// User routes with file upload support
app.use('/users', usersRouter);

// Coupon routes
app.use('/coupons', couponsRouter);

// Delivery addresses routes
app.use('/delivery-addresses', deliveryAddressesRouter);

// Review routes
app.use('/reviews', reviewsRouter);

// Payment routes
app.use('/payments', paymentsRouter);

// Notification routes
app.use('/notifications', notificationsRouter);

// Site settings routes (was static pages, now only for site-wide settings like email, phone, social links)
app.use('/static-pages', staticPagesRouter);

// Product media routes
app.use('/product-media', productMediaRouter);

// Role routes
app.use('/roles', rolesRouter);

// Statistics routes
app.use('/statistics', statisticsRouter);

// Banners routes
app.use('/banners', bannersRouter);

// Favorite routes
app.use('/favorites', favoritesRouter);

// Delivery routes
app.use('/delivery', deliveryRouter);

// Subscription routes
app.use('/subscriptions', subscriptionsRouter);

// Home batch route
app.use('/home', homeRouter);

// Database procedures routes
app.use('/db-procedures', databaseProceduresRouter);

// Vendor payments routes (for vendor self-service endpoints)
// Mount vendor-only products FIRST

app.use('/vendor/vendor-products', vendorOnlyProductsRouter);
// THEN mount vendorPaymentsRouter
app.use('/vendor', vendorPaymentsRouter);
app.use('/vendor/products', vendorProductsRouter);

// Vendor analytics and dashboard routes
app.use('/vendor/analytics', require('./routes/vendorAnalytics'));
app.use('/vendor/dashboard', require('./routes/vendorDashboard'));

// Vendor notification routes
app.use('/vendor/notifications', notificationsRouter);

// Enhanced 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `The requested resource ${req.originalUrl} was not found`,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
    });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Log error details
    const errorDetails = {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    };
    
    console.error('Error Details:', errorDetails);
    
    // Determine error type and status
    let statusCode = 500;
    let errorMessage = 'Internal Server Error';
    
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = 'Validation Error';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorMessage = 'Unauthorized';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        errorMessage = 'Forbidden';
    } else if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 409;
        errorMessage = 'Duplicate Entry';
    } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        statusCode = 400;
        errorMessage = 'Referenced Record Not Found';
    }
    
    res.status(statusCode).json({
        error: errorMessage,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
        server.close(() => {
                process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server with enhanced configuration
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
});

// Handle server errors
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }
    
    const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
    
    switch (error.code) {
        case 'EACCES':
            console.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});

module.exports = app;
