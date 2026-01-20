const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// In a real app, we would have a roleMiddleware here too
router.use(authMiddleware);

router.post('/users', adminController.createUser);
router.get('/users', adminController.getAllUsers);
router.get('/configuracoes', adminController.getAllConfigs);
router.put('/configuracoes/:chave', adminController.updateConfig);

const upload = require('../../middleware/upload.middleware');
router.post('/configuracoes/upload-logo', upload.single('file'), adminController.uploadLogo);

module.exports = router;
