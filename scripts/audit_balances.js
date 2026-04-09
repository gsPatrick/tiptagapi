const PessoasService = require('../src/features/pessoas/pessoas.service');
const { Pessoa } = require('../src/models');

async function audit() {
    console.log('--- AUDITORIA DE SALDOS PERMUTA ---');
    const fornecedores = await Pessoa.findAll({ where: { is_fornecedor: true } });
    console.log(`Analisando ${fornecedores.length} fornecedores...\n`);

    const summary = [];

    for (const f of fornecedores) {
        try {
            const res = await PessoasService.getSaldoPermuta(f.id);
            
            // Check if any competency has negative value
            const negativeMonth = res.detalhamento.find(d => d.valor < 0);
            
            if (negativeMonth || res.saldo < 0) {
                summary.push({
                    id: f.id,
                    nome: f.nome,
                    saldo: res.saldo,
                    problema: negativeMonth ? `Mês ${negativeMonth.mes}/${negativeMonth.ano} com saldo ${negativeMonth.valor}` : 'Saldo total negativo'
                });
            }
        } catch (err) {
            console.error(`Erro ao processar ID ${f.id}:`, err.message);
        }
    }

    if (summary.length === 0) {
        console.log('✅ SUCESSO: Nenhum fornecedor apresenta saldo negativo ou competência negativa no novo modelo!');
    } else {
        console.log('⚠️ ALERT: Encontrados fornecedores com inconsistências:');
        console.table(summary);
    }

    process.exit(0);
}

audit();
