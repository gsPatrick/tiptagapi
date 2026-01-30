const { sequelize, User, Configuracao, Peca, Pessoa, TextoPadrao } = require('../models');

async function seed() {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ alter: true });

        // 1. Create Admin User
        const adminEmail = 'admin@tiptag.com';
        const admin = await User.findOne({ where: { email: adminEmail } });
        if (!admin) {
            await User.create({
                nome: 'Administrador',
                email: adminEmail,
                senha_hash: '123456',
                role: 'ADMIN',
            });
            console.log('Admin user created.');
        }

        // 2. Create Configurations
        const configs = [
            { chave: 'TAXA_COMISSAO_PADRAO', valor: '50', tipo: 'INT', descricao: 'Porcentagem padrão da loja' },
            { chave: 'CASHBACK_DIA_RESET', valor: '1', tipo: 'INT', descricao: 'Dia do mês para reset de cashback' },
            { chave: 'CASHBACK_HORA_RESET', valor: '00:00', tipo: 'STRING', descricao: 'Horário do reset de cashback' },
        ];

        for (const conf of configs) {
            const existing = await Configuracao.findByPk(conf.chave);
            if (!existing) {
                await Configuracao.create(conf);
                console.log(`Config ${conf.chave} created.`);
            }
        }

        // 3. Create Default Templates
        const templates = [
            {
                titulo: 'Confirmação de Pedido',
                gatilho_automacao: 'POS_VENDA',
                conteudo: 'Olá {NOME_CLIENTE}, obrigado por comprar na TipTag! Seu pedido {CODIGO_PEDIDO} de R$ {VALOR_TOTAL} foi confirmado.'
            },
            {
                titulo: 'Reset de Cashback',
                gatilho_automacao: 'RESET_CASHBACK',
                conteudo: '<p>O sistema executou o reset de cashback em {DATA_HORA}. Verifique o painel para mais detalhes.</p>'
            }
        ];

        for (const tmpl of templates) {
            const existing = await TextoPadrao.findOne({ where: { gatilho_automacao: tmpl.gatilho_automacao } });
            if (!existing) {
                await TextoPadrao.create(tmpl);
                console.log(`Template ${tmpl.gatilho_automacao} created.`);
            }
        }

        console.log('Seeding completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seed();
