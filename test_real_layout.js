require('dotenv').config();
const automacaoService = require('./src/features/automacao/automacao.service');
const { TextoPadrao, FilaBot, sequelize } = require('./src/models');

async function testRealMessage() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const telefone = '71982862912';
        const gatilho = 'VIRADA_MENSAL';

        // 1. Check if template exists in DB
        const template = await TextoPadrao.findOne({ where: { gatilho_automacao: gatilho } });
        if (!template) {
            console.warn(`AVISO: Template para o gatilho "${gatilho}" não encontrado no banco de dados.`);
            console.log('Vou tentar criar um template temporário para o teste se ele não existir, para garantir que o layout seja testado.');
            // However, the user says "it didn't follow the layout", implying there IS one or it should follow a specific one.
            // Let's see if we can find any other templates to understand the "layout" style.
            const allTemplates = await TextoPadrao.findAll();
            console.log('Templates encontrados no banco:', allTemplates.map(t => t.gatilho_automacao));
        } else {
            console.log(`Template encontrado: "${template.titulo}"`);
            console.log(`Conteúdo original: ${template.conteudo}`);
        }

        console.log(`Agendando mensagem real para ${telefone}...`);

        // 2. Schedule using the real service logic
        const scheduled = await automacaoService.agendarMensagem({
            telefone: telefone,
            canal: 'WHATSAPP',
            gatilho: gatilho,
            variaveis: {
                NOME: 'Teste Layout',
                MES_ANTERIOR: 'Fevereiro',
                VALOR: '150.00',
                DATA_VALIDADE: '31/03/2026'
            },
            // Fallback message just in case template is missing
            mensagem: `Olá Teste Layout, suas vendas de Fevereiro geraram R$ 150.00 em créditos! Válido até 31/03/2026. (Mensagem de Fallback)`
        });

        if (scheduled) {
            console.log('Mensagem agendada na FilaBot. Processando fila...');

            // 3. Process the queue immediately for this test
            const result = await automacaoService.processarFila();
            console.log('Resultado do Processamento:', result);
        } else {
            console.log('FALHA: Não foi possível agendar a mensagem.');
        }

    } catch (error) {
        console.error('ERRO:', error);
    } finally {
        await sequelize.close();
    }
}

testRealMessage();
