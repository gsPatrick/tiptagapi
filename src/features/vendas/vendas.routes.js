const express = require('express');
const router = express.Router();
const vendasController = require('./vendas.controller');
const authMiddleware = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/pdv', vendasController.pdv);
router.post('/sacolinhas/abrir', vendasController.abrirSacolinha);
router.post('/sacolinhas/:id/adicionar', vendasController.addItemSacolinha);
router.put('/sacolinhas/:id/fechar', vendasController.fecharSacolinha);

module.exports = router;
