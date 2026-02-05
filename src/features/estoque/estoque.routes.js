const express = require('express');
const router = express.Router();
const estoqueController = require('./estoque.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/auditoria', estoqueController.auditoria);
router.get('/historico/:id', estoqueController.getHistory);

module.exports = router;
