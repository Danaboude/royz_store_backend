const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const profileImagesDir = path.join(uploadsDir, 'profile-images');
const bannersDir = path.join(uploadsDir, 'banners');
const productMediaDir = path.join(uploadsDir, 'product-media');
const deliveryConfirmationsDir = path.join(uploadsDir, 'delivery-confirmations');
const vendorDocsDir = path.join(uploadsDir, 'vendor-docs');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(profileImagesDir)) fs.mkdirSync(profileImagesDir);
if (!fs.existsSync(bannersDir)) fs.mkdirSync(bannersDir);
if (!fs.existsSync(productMediaDir)) fs.mkdirSync(productMediaDir);
if (!fs.existsSync(deliveryConfirmationsDir)) fs.mkdirSync(deliveryConfirmationsDir);
if (!fs.existsSync(vendorDocsDir)) fs.mkdirSync(vendorDocsDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'profileImage') {
      cb(null, profileImagesDir);
    } else if (file.fieldname === 'banner_image') {
      cb(null, bannersDir);
    } else if (file.fieldname === 'media') {
      cb(null, productMediaDir);
    } else if (file.fieldname === 'delivery_confirmation_image') {
      cb(null, deliveryConfirmationsDir);
    } else if (['commercial_registration_doc', 'tax_registration_doc', 'identity_doc', 'signature_authorization_doc', 'lease_or_ownership_doc', 'special_license_doc'].includes(file.fieldname)) {
      cb(null, vendorDocsDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = file.fieldname + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e9) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB limit for product media
  fileFilter: function (req, file, cb) {
    // Allow images and videos for product media
    if (file.fieldname === 'media') {
      if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image and video files are allowed for product media!'), false);
      }
    } else if (file.fieldname === 'delivery_confirmation_image') {
      // For delivery confirmation, only allow images
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for delivery confirmation!'), false);
      }
    } else if (['commercial_registration_doc', 'tax_registration_doc', 'identity_doc', 'signature_authorization_doc', 'lease_or_ownership_doc', 'special_license_doc','profileImage'].includes(file.fieldname)) {
      if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only image and PDF files are allowed for vendor documents!'), false);
      }
    } else {
      // For other uploads, only allow images
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    }
  }
});

// Banner image compression middleware
async function compressBannerImage(req, res, next) {
  if (!req.file || req.file.fieldname !== 'banner_image') return next();
  const filePath = req.file.path;
  const ext = path.extname(filePath).toLowerCase();
  let outputJpg;
  if (ext === '.jpg' || ext === '.jpeg') {
    // Write to a new file to avoid sharp error
    outputJpg = filePath.replace(/\.jpe?g$/, `-compressed.jpg`);
  } else {
    outputJpg = filePath.replace(ext, '.jpg');
  }
  try {
    await sharp(filePath)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(outputJpg);
    // Remove original file and update req.file
    if (outputJpg !== filePath) {
      fs.unlinkSync(filePath);
      req.file.filename = path.basename(outputJpg);
      req.file.path = outputJpg;
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // If we wrote to a new file for .jpg, replace original
      fs.unlinkSync(filePath);
      req.file.filename = path.basename(outputJpg);
      req.file.path = outputJpg;
    }
  } catch (err) {
    console.error('Failed to compress banner image:', err);
  }
  next();
}

// Delivery confirmation image compression middleware
async function compressDeliveryConfirmationImage(req, res, next) {
  if (!req.file || req.file.fieldname !== 'delivery_confirmation_image') return next();
  const filePath = req.file.path;
  const ext = path.extname(filePath).toLowerCase();
  let outputJpg;
  if (ext === '.jpg' || ext === '.jpeg') {
    outputJpg = filePath.replace(/\.jpe?g$/, `-compressed.jpg`);
  } else {
    outputJpg = filePath.replace(ext, '.jpg');
  }
  try {
    await sharp(filePath)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outputJpg);
    // Remove original file and update req.file
    if (outputJpg !== filePath) {
      fs.unlinkSync(filePath);
      req.file.filename = path.basename(outputJpg);
      req.file.path = outputJpg;
    }
  } catch (err) {
    console.error('Failed to compress delivery confirmation image:', err);
  }
  next();
}

module.exports = {
  upload,
  compressBannerImage,
  compressDeliveryConfirmationImage
}; 