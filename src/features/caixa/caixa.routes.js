const express = require('express');
const router = express.Router();
const caixaController = require('./caixa.controller');
const authMiddleware = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/abrir', caixaController.abrir);
router.post('/sangria', caixaController.sangria);
router.post('/fechar', caixaController.fechar);

module.exports = router;
