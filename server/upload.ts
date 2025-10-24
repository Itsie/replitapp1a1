import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// SECURITY: Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Archives
  'application/zip', 'application/x-zip-compressed',
  // Text
  'text/plain', 'text/csv',
  // Design files
  'application/postscript', // AI files
  'image/vnd.adobe.photoshop', // PSD
];

// SECURITY: Allowed file extensions
const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx',
  '.zip',
  '.txt', '.csv',
  '.ai', '.psd', '.eps',
];

// SECURITY: Validate orderId is a valid CUID (alphanumeric, starts with 'c')
const isValidCUID = (id: string): boolean => {
  return /^c[a-z0-9]{24}$/.test(id);
};

// SECURITY: Validate that resolved path is within allowed directory
const isPathSafe = (basePath: string, userPath: string): boolean => {
  const resolvedBase = path.resolve(basePath);
  const resolvedUser = path.resolve(path.join(basePath, userPath));
  return resolvedUser.startsWith(resolvedBase);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orderId = req.params.id;
    
    // SECURITY: Validate orderId format (prevent path traversal)
    if (!isValidCUID(orderId)) {
      return cb(new Error(`Invalid order ID format: ${orderId}`), '');
    }
    
    const orderDir = path.join(uploadsDir, "orders", orderId);
    
    // SECURITY: Ensure resolved path is within uploads directory
    if (!isPathSafe(uploadsDir, `orders/${orderId}`)) {
      return cb(new Error('Path traversal attempt detected'), '');
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(orderDir)) {
      fs.mkdirSync(orderDir, { recursive: true });
    }
    
    cb(null, orderDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: <nanoid>_<originalname>
    const uniqueId = nanoid(10);
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext);
    // Sanitize filename: replace special chars
    const sanitized = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${uniqueId}_${sanitized}${ext}`;
    
    cb(null, filename);
  },
});

// SECURITY: File filter with MIME type and extension validation
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
  
  // Check file extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File extension not allowed: ${ext}`));
  }
  
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});
