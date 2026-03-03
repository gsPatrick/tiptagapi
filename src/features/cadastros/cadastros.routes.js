const express = require('express');
const router = express.Router();
const genericCadastroController = require('./GenericCadastroController');

const { authMiddleware } = require('../../middleware/auth.middleware');

router.use(authMiddleware);

// Bind methods to the controller instance to ensure 'this' context is preserved
router.get('/:entidade', (req, res) => genericCadastroController.getAll(req, res));
router.post('/:entidade', (req, res) => genericCadastroController.create(req, res));
router.put('/:entidade/:id', (req, res) => genericCadastroController.update(req, res));
router.post('/:entidade/:id/sync', (req, res) => genericCadastroController.sync(req, res));
router.delete('/:entidade/:id', (req, res) => genericCadastroController.delete(req, res));

module.exports = router;
