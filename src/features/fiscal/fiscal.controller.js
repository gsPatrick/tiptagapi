const fiscalService = require('./fiscal.service');

class FiscalController {
    async emitirNota(req, res) {
        try {
            const { id } = req.params;
            const result = await fiscalService.emitirNFCe(id);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new FiscalController();
