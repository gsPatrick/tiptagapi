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
router.use('/', relatoriosRoutes); // Mount at root because routes define their own prefixes like /dashboard and /relatorios

module.exports = router;
