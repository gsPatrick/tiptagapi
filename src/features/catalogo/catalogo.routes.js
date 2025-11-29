const express = require('express');
const router = express.Router();
const catalogoController = require('./catalogo.controller');
const authMiddleware = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/pecas', catalogoController.createPeca);
router.get('/pecas', catalogoController.getAllPecas);
router.get('/pecas/:id', catalogoController.getPecaById);
router.put('/pecas/:id', catalogoController.updatePeca);
router.post('/etiquetas', catalogoController.generateEtiquetas);

module.exports = router;
