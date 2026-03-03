const financeiroService = require('./financeiro.service');

class FinanceiroController {
    async getExtrato(req, res) {
        try {
            const { pessoaId } = req.params;
            const extrato = await financeiroService.getExtrato(pessoaId);
            return res.json(extrato);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getRepasses(req, res) {
        try {
            const repasses = await financeiroService.getRepasses();
            return res.json(repasses);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async pagarRepasse(req, res) {
        try {
            const result = await financeiroService.pagarRepasse(req.body);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getDRE(req, res) {
        try {
            const { inicio, fim } = req.query;
            const dre = await financeiroService.getDRE(inicio, fim);
            return res.json(dre);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getRecebiveis(req, res) {
        try {
            const { inicio, fim } = req.query;
            const recebiveis = await financeiroService.getRecebiveis(inicio, fim);
            return res.json(recebiveis);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async createTransacao(req, res) {
        try {
            const transacao = await financeiroService.createTransacao(req.body);
            return res.status(201).json(transacao);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getTransacoes(req, res) {
        try {
            const { inicio, fim, tipo } = req.query;
            const transacoes = await financeiroService.getTransacoes(inicio, fim, tipo);
            return res.json(transacoes);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getContas(req, res) {
        try {
            const contas = await financeiroService.getContas();
            return res.json(contas);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getFechamentos(req, res) {
        try {
            const { inicio, fim } = req.query;
            const fechamentos = await financeiroService.getFechamentos(inicio, fim);
            return res.json(fechamentos);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getExtratoPessoa(req, res) {
        try {
            const { pessoaId } = req.params;
            const { inicio, fim } = req.query;
            const extrato = await financeiroService.getExtratoPessoa(pessoaId, inicio, fim);
            return res.json(extrato);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getSaldosPessoas(req, res) {
        try {
            const filters = req.query;
            const saldos = await financeiroService.getSaldosPessoas(filters);
            return res.json(saldos);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getEntradasSaidas(req, res) {
        try {
            const { inicio, fim, compareMode } = req.query;
            const data = await financeiroService.getEntradasSaidas(inicio, fim, compareMode);
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new FinanceiroController();
