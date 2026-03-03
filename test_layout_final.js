require('dotenv').config();
const automacaoService = require('./src/features/automacao/automacao.service');
const { TextoPadrao, FilaBot, sequelize } = require('./src/models');

async function testLayoutViaPosVenda() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const telefone = '71982862912';
        const gatilho = 'POS_VENDA'; // Use a valid enum type and ensure there is a template

        // 1. Ensure template exists for POS_VENDA
        let template = await TextoPadrao.findOne({ where: { gatilho_automacao: gatilho } });
        if (!template) {
            console.log(`Criando template temporário para ${gatilho}...`);
            template = await TextoPadrao.create({
                titulo: 'Confirmação de Créditos (Teste)',
                gatilho_automacao: gatilho,
                conteudo: '*Olá {NOME},*\n\nSuas vendas de *{MES_ANTERIOR}* geraram *R$ {VALOR}* em créditos! 💰\n\nVálido até: *{DATA_VALIDADE}*\n\n_TipTag - Seu Brechó Favorito_'
            });
        } else {
            console.log(`Usando template existente para ${gatilho}.`);
            // Update it to have a better layout for this test
            await template.update({
                conteudo: '*Olá {NOME},*\n\nSuas vendas de *{MES_ANTERIOR}* geraram *R$ {VALOR}* em créditos! 💰\n\nVálido até: *{DATA_VALIDADE}*\n\n_TipTag - Seu Brechó Favorito_'
            });
        }

        console.log(`Conteúdo do layout: \n${template.conteudo}\n`);

        console.log(`Agendando mensagem com layout para ${telefone}...`);

        // 2. Schedule using the real service logic
        const scheduled = await automacaoService.agendarMensagem({
            telefone: telefone,
            canal: 'WHATSAPP',
            gatilho: gatilho,
            tipo: 'POS_VENDA', // Using valid enum
            variaveis: {
                NOME: 'Cliente Lorena',
                MES_ANTERIOR: 'Fevereiro',
                VALOR: '150,00',
                DATA_VALIDADE: '31/03/2026'
            }
        });

        if (scheduled) {
            console.log('Mensagem agendada. Processando fila...');
            const result = await automacaoService.processarFila();
            console.log('Resultado do Processamento:', result);
        } else {
            console.log('FALHA ao agendar.');
        }

    } catch (error) {
        console.error('ERRO:', error);
    } finally {
        await sequelize.close();
    }
}

testLayoutViaPosVenda();
