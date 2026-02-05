const express = require('express');
const router = express.Router();
const pessoasController = require('./pessoas.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

const upload = require('../../middleware/upload.middleware');

router.use(authMiddleware);

router.post('/', pessoasController.create);
router.get('/', pessoasController.getAll);
router.get('/:id', pessoasController.getById);
router.put('/:id', pessoasController.update);
router.delete('/:id', pessoasController.delete);
router.get('/:id/saldo-permuta', pessoasController.getSaldoPermuta);
router.post('/:id/foto', upload.single('foto'), pessoasController.uploadFoto);

module.exports = router;
