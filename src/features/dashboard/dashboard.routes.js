const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/resumo', authMiddleware, dashboardController.getResumo);

module.exports = router;
