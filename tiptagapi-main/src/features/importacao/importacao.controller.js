const importacaoService = require('./importacao.service');

class ImportacaoController {
    async upload(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            const { tipo } = req.body; // PECAS or PESSOAS
            const result = await importacaoService.processarArquivo(req.file.path, tipo);
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new ImportacaoController();
