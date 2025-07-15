const multer = require('multer');
const path = require('path');

// Configure storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

class UploadFileController {
  static uploadFile(req, res) {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.', error: true });
    }
    // Construct the file URL to be returned to the client
    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({
      message: 'File uploaded successfully',
      url: fileUrl,
      success: true
    });
  }
}

module.exports = {
  upload,
  uploadFileController: UploadFileController.uploadFile
}; 