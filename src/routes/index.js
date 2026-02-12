const express = require('express');
const router = express.Router();

const authRoutes = require('../features/auth/auth.routes');
const pessoasRoutes = require('../features/pessoas/pessoas.routes');
const catalogoRoutes = require('../features/catalogo/catalogo.routes');
const vendasRoutes = require('../features/vendas/vendas.routes');
const financeiroRoutes = require('../features/financeiro/financeiro.routes');
const marketingRoutes = require('../features/marketing/marketing.routes');
const importacaoRoutes = require('../features/importacao/importacao.routes');
const integracaoRoutes = require('../features/api_externa/integracao.routes');
const dashboardRoutes = require('../features/dashboard/dashboard.routes');
const fiscalRoutes = require('../features/fiscal/fiscal.routes');
const cadastrosRoutes = require('../features/cadastros/cadastros.routes');
const relatoriosRoutes = require('../features/relatorios/relatorios.routes');
const adminRoutes = require('../features/admin/admin.routes');

const caixaRoutes = require('../features/caixa/caixa.routes');

router.use('/auth', authRoutes);
router.use('/pessoas', pessoasRoutes);
router.use('/catalogo', catalogoRoutes);
router.use('/vendas', vendasRoutes);
router.use('/financeiro', financeiroRoutes);
router.use('/marketing', marketingRoutes);
router.use('/importacao', importacaoRoutes);
router.use('/integracao', integracaoRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/fiscal', fiscalRoutes);
router.use('/cadastros', cadastrosRoutes);
router.use('/admin', adminRoutes);
router.use('/caixa', caixaRoutes);
router.get('/public/system-config', require('../features/admin/admin.controller').getPublicConfigs);

// --- COMPATIBILITY ROUTES (Fix for 404s on frontend) ---
const genericCadastroController = require('../features/cadastros/GenericCadastroController');
const { authMiddleware } = require('../middleware/auth.middleware');

router.get('/tamanhos', authMiddleware, (req, res) => { req.params.entidade = 'tamanhos'; return genericCadastroController.getAll(req, res); });
router.get('/categorias', authMiddleware, (req, res) => { req.params.entidade = 'categorias'; return genericCadastroController.getAll(req, res); });
router.get('/marcas', authMiddleware, (req, res) => { req.params.entidade = 'marcas'; return genericCadastroController.getAll(req, res); });
// -------------------------------------------------------

router.use('/', relatoriosRoutes); // Mount at root because routes define their own prefixes like /dashboard and /relatorios

module.exports = router;
