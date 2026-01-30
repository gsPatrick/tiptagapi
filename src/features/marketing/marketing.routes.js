const express = require('express');
const router = express.Router();
const marketingController = require('./marketing.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/campanhas', marketingController.createCampanha);
router.get('/campanhas', marketingController.getAllCampanhas);

router.post('/campanhas/:id/produtos', marketingController.addProdutosToCampanha);
router.get('/produtos-campanha', marketingController.getProdutosCampanha);
router.post('/campanhas/remover-produtos', marketingController.removeProdutosFromCampanha);
router.post('/produtos/aprovar', marketingController.approveProdutos);

module.exports = router;
