const caixaService = require('./caixa.service');

class CaixaController {
    async abrir(req, res) {
        try {
            const { saldo_inicial } = req.body;
            // Assuming req.userId comes from auth middleware
            const caixa = await caixaService.abrirCaixa(req.userId, saldo_inicial);
            return res.status(201).json(caixa);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async sangria(req, res) {
        try {
            const { valor, descricao } = req.body;
            const result = await caixaService.realizarSangria(req.userId, valor, descricao);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async fechar(req, res) {
        try {
            const { saldo_final } = req.body;
            const caixa = await caixaService.fecharCaixa(req.userId, saldo_final);
            return res.json(caixa);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async status(req, res) {
        try {
            const caixa = await caixaService.getCaixaAberto(req.userId);
            return res.json(caixa || null); // Returns null if no open caixa
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new CaixaController();
