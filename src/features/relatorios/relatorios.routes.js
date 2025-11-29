const express = require('express');
const router = express.Router();
const relatoriosController = require('./RelatoriosController');

router.get('/dashboard/resumo', relatoriosController.getResumo);
router.get('/relatorios/vendas-categoria', relatoriosController.getVendasPorCategoria);
router.get('/relatorios/vendas-marca', relatoriosController.getVendasPorMarca);
router.get('/relatorios/performance-vendedor', relatoriosController.getPerformanceVendedor);

module.exports = router;
