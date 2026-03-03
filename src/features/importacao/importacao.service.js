const { Peca, Pessoa } = require('../../models');
const xlsx = require('xlsx');

class ImportacaoService {
    async processarArquivo(filePath, tipo) {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        const results = { success: 0, errors: [] };

        if (tipo === 'PECAS') {
            for (const row of data) {
                try {
                    // Expected columns: codigo_etiqueta, descricao_curta, preco_venda, etc.
                    // Validate uniqueness
                    if (row.codigo_etiqueta) {
                        const existing = await Peca.findOne({ where: { codigo_etiqueta: row.codigo_etiqueta } });
                        if (existing) {
                            results.errors.push(`Peça ${row.codigo_etiqueta} já existe`);
                            continue;
                        }
                    }

                    // Basic validation
                    if (!row.descricao_curta || !row.preco_venda) {
                        results.errors.push(`Dados incompletos para linha: ${JSON.stringify(row)}`);
                        continue;
                    }

                    await Peca.create(row);
                    results.success++;
                } catch (err) {
                    results.errors.push(`Erro ao importar linha: ${err.message}`);
                }
            }
        } else if (tipo === 'PESSOAS') {
            for (const row of data) {
                try {
                    // Expected columns: nome, cpf_cnpj, email, etc.
                    if (row.cpf_cnpj) {
                        const existing = await Pessoa.findOne({ where: { cpf_cnpj: row.cpf_cnpj } });
                        if (existing) {
                            results.errors.push(`Pessoa ${row.cpf_cnpj} já existe`);
                            continue;
                        }
                    }

                    if (!row.nome) {
                        results.errors.push(`Nome obrigatório para linha: ${JSON.stringify(row)}`);
                        continue;
                    }

                    await Pessoa.create(row);
                    results.success++;
                } catch (err) {
                    results.errors.push(`Erro ao importar pessoa: ${err.message}`);
                }
            }
        }

        return results;
    }
}

module.exports = new ImportacaoService();
