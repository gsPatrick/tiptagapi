const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Upload para IMAGENS (fotos de perfil, produtos, etc.)
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype || extname) {
            return cb(null, true);
        }
        cb(new Error('Apenas imagens são permitidas (JPEG, PNG, WEBP).'));
    }
});

// Upload para DOCUMENTOS (contratos, anexos - aceita imagens + docs)
const uploadDocs = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|pdf|doc|docx|xls|xlsx|txt|csv/;
        const allowedMimes = /image\/(jpeg|jpg|png|webp)|application\/(pdf|msword|vnd\.openxmlformats|vnd\.ms-excel|octet-stream)|text\/(plain|csv)/;

        const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimeOk = allowedMimes.test(file.mimetype);

        if (extOk || mimeOk) {
            return cb(null, true);
        }
        cb(new Error('Tipo de arquivo não permitido. Aceitos: imagens, PDF, DOC, DOCX, XLS, TXT.'));
    }
});

module.exports = upload;
module.exports.uploadDocs = uploadDocs;

