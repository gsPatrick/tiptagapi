const cron = require('node-cron');
const { Peca, Tamanho, Cor, Marca, Categoria, Pessoa } = require('../models');
const axios = require('axios');
const { Op } = require('sequelize');

const syncJob = () => {
    // Execute a cada 5 minutos para evitar sobrecarga (ajuste conforme necessário)
    // cron.schedule('*/5 * * * *', async () => {
    //     console.log('[TiptagSyncJob] Iniciando sincronização bidirecional...');
    //     try {
    //         await pushToEcommerce();
    //         await pullFromEcommerce();
    //     } catch (error) {
    //         console.error('[TiptagSyncJob] Erro no job de sync:', error.message);
    //     }
    // });
    console.log('[TiptagSyncJob] Sync agendado desativado em favor do sync em tempo real.');
};

const pushToEcommerce = async () => {
    try {
        if (!process.env.ECOMMERCE_API_URL || !process.env.INTEGRATION_SECRET) return;

        // Busca peças atualizadas nos últimos 10 minutos
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const pecasToSync = await Peca.findAll({
            where: {
                updatedAt: { [Op.gte]: tenMinutesAgo }
            },
            include: ['tamanho', 'cor', 'marca', 'categoria'],
            limit: 20 // Processa em lotes pequenos
        });

        if (pecasToSync.length > 0) {
            console.log(`[TiptagSyncJob] Encontrou ${pecasToSync.length} itens para enviar ao E-commerce.`);

            for (const peca of pecasToSync) {
                // Validação de SKU
                const sku = peca.sku_ecommerce || peca.codigo_etiqueta;
                if (!sku) {
                    console.warn(`[TiptagSyncJob] Pulando peça ID ${peca.id}: Sem SKU/Código.`);
                    continue;
                }

                const payload = {
                    name: peca.descricao_curta,
                    description: peca.descricao_detalhada || peca.descricao_curta,
                    price: parseFloat(peca.preco_venda),
                    sku: sku,
                    stock: peca.status === 'VENDIDA' ? 0 : 1,
                    weight: parseFloat(peca.peso_kg || 0),
                    dimensions: {
                        height: parseFloat(peca.altura_cm || 0),
                        width: parseFloat(peca.largura_cm || 0),
                        length: parseFloat(peca.profundidade_cm || 0) // TipTag usa profundidade, Ecom usa length
                    },
                    brand: peca.marca?.nome,
                    category: peca.categoria?.nome,
                    attributes: [],
                    status: peca.status === 'VENDIDA' ? 'archived' : 'published',
                    brechoId: peca.id
                };

                if (peca.cor) payload.attributes.push({ name: 'Cor', options: [peca.cor.nome] });
                if (peca.tamanho) payload.attributes.push({ name: 'Tamanho', options: [peca.tamanho.nome] });

                try {
                    // 1. Verifica existência no E-commerce (Idempotência)
                    let ecommerceId = null;
                    try {
                        const searchRes = await axios.get(`${process.env.ECOMMERCE_API_URL}/products?sku=${sku}`, {
                            headers: { 'x-integration-secret': process.env.INTEGRATION_SECRET }
                        });
                        if (searchRes.data && searchRes.data.length > 0) {
                            ecommerceId = searchRes.data[0].id;
                        }
                    } catch (err) { /* Ignora erro de busca */ }

                    // 2. Cria ou Atualiza
                    if (ecommerceId) {
                        await axios.put(`${process.env.ECOMMERCE_API_URL}/products/${ecommerceId}`, payload, {
                            headers: { 'x-integration-secret': process.env.INTEGRATION_SECRET }
                        });

                        // Atualiza referência local se não tiver
                        if (!peca.sku_ecommerce) await peca.update({ sku_ecommerce: sku });

                        console.log(`[TiptagSyncJob] Atualizado ${sku} no E-commerce.`);
                    } else {
                        const res = await axios.post(`${process.env.ECOMMERCE_API_URL}/products`, payload, {
                            headers: { 'x-integration-secret': process.env.INTEGRATION_SECRET }
                        });

                        if (res.data && res.data.sku && !peca.sku_ecommerce) {
                            await peca.update({ sku_ecommerce: res.data.sku });
                        }
                        console.log(`[TiptagSyncJob] Criado ${sku} no E-commerce.`);
                    }
                } catch (err) {
                    console.error(`[TiptagSyncJob] Falha ao enviar ${sku}:`, err.response?.data || err.message);
                }
            }
        }
    } catch (error) {
        console.error('[TiptagSyncJob] Erro no Push:', error.message);
    }
};

const pullFromEcommerce = async () => {
    try {
        if (!process.env.ECOMMERCE_API_URL || !process.env.INTEGRATION_SECRET) return;

        // Busca produtos recentes do E-commerce
        const response = await axios.get(`${process.env.ECOMMERCE_API_URL}/products?limit=20&sort=createdAt:desc`, {
            headers: { 'x-integration-secret': process.env.INTEGRATION_SECRET }
        });

        const products = response.data.data || response.data; // Ajuste conforme resposta da API
        if (!Array.isArray(products)) return;

        console.log(`[TiptagSyncJob] Analisando ${products.length} produtos vindos do E-commerce...`);

        for (const prod of products) {
            if (!prod.sku) continue;

            // --- PROTEÇÃO CONTRA DUPLICIDADE NO ERP ---

            // Verifica se a peça JÁ EXISTE no TipTag
            const existingPeca = await Peca.findOne({
                where: {
                    [Op.or]: [
                        { sku_ecommerce: prod.sku },
                        { codigo_etiqueta: prod.sku }
                    ]
                }
            });

            if (existingPeca) {
                // Peça já existe. Apenas vincula se necessário.
                if (!existingPeca.sku_ecommerce) {
                    await existingPeca.update({ sku_ecommerce: prod.sku });
                    console.log(`[TiptagSyncJob] Vinculado produto local ${existingPeca.id} ao SKU ${prod.sku}`);
                }
                continue; // Pula criação
            }

            // --- CRIAÇÃO DE DEPENDÊNCIAS (findOrCreate para não duplicar Tabelas Auxiliares) ---

            let marcaId = null;
            if (prod.brand) {
                const [marca] = await Marca.findOrCreate({ where: { nome: prod.brand } });
                marcaId = marca.id;
            }

            let categoriaId = null;
            if (prod.category) {
                const [categoria] = await Categoria.findOrCreate({ where: { nome: prod.category } });
                categoriaId = categoria.id;
            }

            let corId = null;
            let tamanhoId = null;

            // Extrair atributos (Lógica depende da estrutura do E-commerce)
            if (prod.attributes && Array.isArray(prod.attributes)) {
                const corAttr = prod.attributes.find(a => a.name === 'Cor' || a.name === 'Color');
                if (corAttr && corAttr.options[0]) {
                    const [cor] = await Cor.findOrCreate({ where: { nome: corAttr.options[0] } });
                    corId = cor.id;
                }

                const tamAttr = prod.attributes.find(a => a.name === 'Tamanho' || a.name === 'Size');
                if (tamAttr && tamAttr.options[0]) {
                    const [tamanho] = await Tamanho.findOrCreate({ where: { nome: tamAttr.options[0] } });
                    tamanhoId = tamanho.id;
                }
            }

            // --- CRIAÇÃO DA PEÇA NO ERP ---
            console.log(`[TiptagSyncJob] Importando novo produto do E-commerce: ${prod.name}`);

            await Peca.create({
                descricao_curta: prod.name,
                descricao_detalhada: prod.description,
                preco_venda: prod.price,
                sku_ecommerce: prod.sku,
                codigo_etiqueta: prod.sku, // Usa o SKU como código se for importado
                tipo_aquisicao: 'COMPRA', // Assumido, já que veio do site
                status: 'DISPONIVEL',
                stock: prod.stock, // Se seu model Peca tiver stock, senão ignore
                peso_kg: prod.weight,
                altura_cm: prod.dimensions?.height,
                largura_cm: prod.dimensions?.width,
                profundidade_cm: prod.dimensions?.length,
                marcaId,
                categoriaId,
                corId,
                tamanhoId,
                fornecedorId: null // Loja Própria
            });
        }

    } catch (error) {
        console.error('[TiptagSyncJob] Erro no Pull:', error.message);
    }
};

module.exports = syncJob;