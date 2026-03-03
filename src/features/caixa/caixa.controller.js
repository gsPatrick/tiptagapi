const caixaService = require('./caixa.service');

class CaixaController {
    async abrir(req, res) {
        try {
            const { saldo_inicial } = req.body;
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

    async suprimento(req, res) {
        try {
            const { valor, descricao } = req.body;
            const result = await caixaService.realizarSuprimento(req.userId, valor, descricao);
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

    // Close a specific caixa by ID (admin function)
    async fecharById(req, res) {
        try {
            const { id } = req.params;
            const { saldo_final } = req.body;
            const caixa = await caixaService.fecharCaixaById(parseInt(id), saldo_final);
            return res.json(caixa);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async status(req, res) {
        try {
            const caixa = await caixaService.getCaixaAberto(req.userId);
            return res.json(caixa || null);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    // Get all open caixas (admin view)
    async getAbertos(req, res) {
        try {
            const caixas = await caixaService.getTodosCaixasAbertos();
            return res.json(caixas);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    // Get sales/details for a specific caixa
    async getDetalhesCaixa(req, res) {
        try {
            const { id } = req.params;
            const detalhes = await caixaService.getDetalhesCaixa(parseInt(id));
            return res.json(detalhes);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new CaixaController();
