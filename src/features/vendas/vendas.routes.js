const express = require('express');
const router = express.Router();
const vendasController = require('./vendas.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/pdv', vendasController.pdv);
router.post('/sacolinhas/abrir', vendasController.abrirSacolinha);
router.get('/sacolinhas', vendasController.getSacolinhas);
router.get('/sacolinhas/:id', vendasController.getSacolinhaById);
router.put('/sacolinhas/:id/status', vendasController.atualizarStatusSacolinha);
router.post('/sacolinhas/:id/itens', vendasController.adicionarItemSacolinha);
router.delete('/sacolinhas/:id/itens/:pecaId', vendasController.removerItemSacolinha);
router.post('/sacolinhas/:id/adicionar', vendasController.addItemSacolinha);
router.put('/sacolinhas/:id/fechar', vendasController.fecharSacolinha);

router.get('/itens-vendidos', vendasController.getItensVendidos);
router.post('/devolucao', vendasController.processarDevolucao);
router.get('/devolucoes', vendasController.getDevolucoes);
router.get('/pedidos', vendasController.getPedidos);

module.exports = router;
