const express = require('express');
const router = express.Router();
const marketingController = require('./marketing.controller');
const authMiddleware = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/campanhas', marketingController.createCampanha);
router.get('/campanhas', marketingController.getAllCampanhas);
router.post('/bot/match', marketingController.triggerBotMatch);
router.post('/campanhas/:id/produtos', marketingController.addProdutosToCampanha);

module.exports = router;
