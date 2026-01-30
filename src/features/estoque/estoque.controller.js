const estoqueService = require('./estoque.service');

class EstoqueController {
    async auditoria(req, res) {
        try {
            const { codigos } = req.body; // Array of strings
            const resultado = await estoqueService.realizarAuditoria(codigos);
            return res.json(resultado);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new EstoqueController();
