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
            const { inicio, fim } = req.query;
            const data = await relatoriosService.getVendasPorCategoria(inicio, fim);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getVendasPorMarca(req, res) {
        try {
            const { inicio, fim } = req.query;
            const data = await relatoriosService.getVendasPorMarca(inicio, fim);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getPerformanceVendedor(req, res) {
        try {
            const { inicio, fim } = req.query;
            const data = await relatoriosService.getPerformanceVendedor(inicio, fim);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getVendasPorFornecedor(req, res) {
        try {
            const { inicio, fim } = req.query;
            const data = await relatoriosService.getVendasPorFornecedor(inicio, fim);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getVendasDetalhadas(req, res) {
        try {
            const { inicio, fim } = req.query;
            const data = await relatoriosService.getVendasDetalhadas(inicio, fim);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    async getAnaliseEstoque(req, res) {
        try {
            const data = await relatoriosService.getAnaliseEstoque();
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getRankingClientes(req, res) {
        try {
            const { inicio, fim } = req.query;
            const data = await relatoriosService.getRankingClientes(inicio, fim);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getHistoricoCliente(req, res) {
        try {
            const { id } = req.params;
            const data = await relatoriosService.getHistoricoCliente(id);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getDetalhesFornecedor(req, res) {
        try {
            const { id } = req.params;
            const { inicio, fim } = req.query;
            const data = await relatoriosService.getDetalhesFornecedor(id, inicio, fim);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getComissoes(req, res) {
        try {
            const { inicio, fim, fornecedorId } = req.query;
            const data = await relatoriosService.getComissoes(inicio, fim, fornecedorId);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getVendasRepasse(req, res) {
        try {
            const { inicio, fim, fornecedorId } = req.query;
            const data = await relatoriosService.getVendasRepasse(inicio, fim, fornecedorId);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new RelatoriosController();
