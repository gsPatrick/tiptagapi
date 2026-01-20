const express = require('express');
const router = express.Router();
const fiscalController = require('./fiscal.controller');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth.middleware');

// Only Admin or Manager can emit notes manually
router.post('/pedidos/:id/emitir-nota', authMiddleware, roleMiddleware(['ADMIN', 'GERENTE']), fiscalController.emitirNota);

module.exports = router;
