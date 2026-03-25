const express = require('express');
const router = express.Router();
const automacaoController = require('./automacao.controller');

// Public route for testing purposes as requested
router.get('/test-bot', automacaoController.testBot);

module.exports = router;
