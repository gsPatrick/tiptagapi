const relatoriosService = require('./RelatoriosService');

class RelatoriosController {
    async getResumo(req, res) {
        try {
            const data = await relatoriosService.getResumo();
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getVendasPorCategoria(req, res) {
        try {
            const data = await relatoriosService.getVendasPorCategoria();
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getVendasPorMarca(req, res) {
        try {
            const data = await relatoriosService.getVendasPorMarca();
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getPerformanceVendedor(req, res) {
        try {
            const data = await relatoriosService.getPerformanceVendedor();
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new RelatoriosController();
