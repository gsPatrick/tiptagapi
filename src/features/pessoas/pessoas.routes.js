const express = require('express');
const router = express.Router();
const pessoasController = require('./pessoas.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

const upload = require('../../middleware/upload.middleware');
const { uploadDocs } = require('../../middleware/upload.middleware');

router.use(authMiddleware);

router.post('/', pessoasController.create);
router.get('/', pessoasController.getAll);
router.get('/:id', pessoasController.getById);
router.put('/:id', pessoasController.update);
router.delete('/:id', pessoasController.delete);
router.get('/:id/saldo-permuta', pessoasController.getSaldoPermuta);
router.post('/:id/foto', upload.single('foto'), pessoasController.uploadFoto);

// Contratos - usa uploadDocs para aceitar PDFs, DOCs, etc.
router.post('/:id/contratos', uploadDocs.single('contrato'), pessoasController.addContrato);
router.put('/contratos/:contratoId', pessoasController.updateContrato);
router.delete('/contratos/:contratoId', pessoasController.deleteContrato);

// Multer error handler
router.use((err, req, res, next) => {
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.message?.includes('arquivo')) {
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

module.exports = router;
