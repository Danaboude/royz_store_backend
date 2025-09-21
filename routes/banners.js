const express = require('express');
const router = express.Router();
const bannersController = require('../controllers/bannersController');
const { upload, compressBannerImage } = require('../middleware/upload');

router.get('/', bannersController.getBanners);
router.post('/', bannersController.addBanner);
router.put('/:id', bannersController.editBanner);
router.delete('/:id', bannersController.deleteBanner);

// Banner image upload endpoint
router.post('/upload', upload.single('banner_image'), compressBannerImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Construct the public URL for the uploaded image
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/banners/${req.file.filename}`;
  res.json({ url: imageUrl });
});

module.exports = router; 