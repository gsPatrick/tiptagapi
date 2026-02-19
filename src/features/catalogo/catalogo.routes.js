const express = require('express');
const router = express.Router();
const catalogoController = require('./catalogo.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const upload = require('../../middleware/upload.middleware');

router.use(authMiddleware);

router.post('/upload', upload.single('file'), catalogoController.uploadImage);

router.get('/pecas/expirando', catalogoController.getExpiringPecas);
router.get('/pecas', catalogoController.getAllPecas);
router.post('/pecas', catalogoController.createPeca);
router.get('/pecas/:id', catalogoController.getPecaById);
router.put('/pecas/:id', catalogoController.updatePeca);
router.delete('/pecas/:id', catalogoController.deletePeca);
router.post('/pecas/:id/sync', catalogoController.syncPeca);
router.post('/pecas/report-avaria', catalogoController.reportAvaria);
router.get('/marcas', catalogoController.getAllMarcas);
router.post('/etiquetas', catalogoController.generateEtiquetas);

module.exports = router;
