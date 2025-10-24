import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orderId = req.params.id;
    const orderDir = path.join(uploadsDir, "orders", orderId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(orderDir)) {
      fs.mkdirSync(orderDir, { recursive: true });
    }
    
    cb(null, orderDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: <nanoid>_<originalname>
    const uniqueId = nanoid(10);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    // Sanitize filename: replace special chars
    const sanitized = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${uniqueId}_${sanitized}${ext}`;
    
    cb(null, filename);
  },
});

// File filter: reject files > 50MB
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});
