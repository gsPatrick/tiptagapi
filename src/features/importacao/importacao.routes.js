const express = require('express');
const router = express.Router();
const importacaoController = require('./importacao.controller');
const uploadMiddleware = require('../../middleware/upload.middleware');
const authMiddleware = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/upload', uploadMiddleware.single('file'), importacaoController.upload);

module.exports = router;
