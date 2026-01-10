const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { uploadController } = require('../controllers');
const { verifyToken, requirePermission } = require('../middleware');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(verifyToken);

// Upload bank file (single)
router.post('/bank',
  requirePermission('canUploadFiles'),
  upload.single('file'),
  uploadController.uploadBankFile
);

// Upload merchant files (multiple)
router.post('/merchant',
  requirePermission('canUploadFiles'),
  upload.array('files', 10),
  uploadController.uploadMerchantFiles
);

// Get file uploads
router.get('/files', uploadController.getFileUploads);
router.get('/files/:id', uploadController.getFileDetails);

module.exports = router;
