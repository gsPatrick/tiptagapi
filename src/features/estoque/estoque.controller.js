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
    async getHistory(req, res) {
        try {
            const { id } = req.params;
            const history = await estoqueService.getHistory(id);
            return res.json(history);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new EstoqueController();
