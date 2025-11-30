const express = require('express');
const router = express.Router();
const relatoriosController = require('./RelatoriosController');

router.get('/dashboard/resumo', relatoriosController.getResumo);
router.get('/relatorios/vendas-categoria', relatoriosController.getVendasPorCategoria);
router.get('/relatorios/vendas-marca', relatoriosController.getVendasPorMarca);
router.get('/relatorios/performance-vendedor', relatoriosController.getPerformanceVendedor);
router.get('/relatorios/vendas-fornecedor', relatoriosController.getVendasPorFornecedor);
router.get('/relatorios/vendas-detalhadas', relatoriosController.getVendasDetalhadas);
router.get('/relatorios/analise-estoque', relatoriosController.getAnaliseEstoque);
router.get('/relatorios/ranking-clientes', relatoriosController.getRankingClientes);
router.get('/relatorios/historico-cliente/:id', relatoriosController.getHistoricoCliente);
router.get('/relatorios/detalhes-fornecedor/:id', relatoriosController.getDetalhesFornecedor);
router.get('/relatorios/comissoes', relatoriosController.getComissoes);
router.get('/relatorios/vendas-repasse', relatoriosController.getVendasRepasse);
router.get('/relatorios/pecas-fornecedor/:fornecedorId', relatoriosController.getPecasPorFornecedor);
router.get('/relatorios/grade-estoque', relatoriosController.getGradeEstoque);
router.get('/relatorios/vendas-tamanho', relatoriosController.getVendasPorTamanho);

module.exports = router;
