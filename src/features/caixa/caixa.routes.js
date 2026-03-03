const express = require('express');
const router = express.Router();
const caixaController = require('./caixa.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

// User operations (uses req.userId)
router.post('/abrir', caixaController.abrir);
router.post('/sangria', caixaController.sangria);
router.post('/suprimento', caixaController.suprimento);
router.post('/fechar', caixaController.fechar);
router.get('/status', caixaController.status);

// Admin operations
router.get('/abertos', caixaController.getAbertos);
router.get('/:id/detalhes', caixaController.getDetalhesCaixa);
router.post('/:id/fechar', caixaController.fecharById);

module.exports = router;
