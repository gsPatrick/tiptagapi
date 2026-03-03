const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const db = require('../src/models');
const { Peca, Pessoa, Marca, Categoria, Cor, Tamanho, Local, Motivo } = db;

const EXCEL_PATH = path.resolve(__dirname, '../pecas.xlsx');
const DAYS_LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1]) || 10;
const APPLY = process.argv.includes('--apply');

const entityCache = {
    Pessoa: new Map(),
    Marca: new Map(),
    Categoria: new Map(),
    Cor: new Map(),
    Tamanho: new Map(),
    Local: new Map(),
    Motivo: new Map()
};

async function getOrCreateEntity(Model, name, field = 'nome', extraData = {}) {
    if (!name) return null;
    const normalizedName = name.toString().trim();
    const cacheKey = normalizedName.toLowerCase();

    if (entityCache[Model.name].has(cacheKey)) {
        return entityCache[Model.name].get(cacheKey);
    }

    // Attempt lookup (case-insensitive for Postgres usually requires Op.iLike or lower)
    let entity = await Model.findOne({
        where: {
            [field]: {
                [Op.iLike]: normalizedName
            }
        }
    });

    if (!entity) {
        console.log(`[SEED] Creating ${Model.name}: ${normalizedName}`);
        entity = await Model.create({
            [field]: normalizedName,
            ...extraData
        });
    }

    entityCache[Model.name].set(cacheKey, entity.id);
    return entity.id;
}

async function run() {
    console.log(`\n--- Tiptag DB Maintenance Script ---`);
    console.log(`Excel Path: ${EXCEL_PATH}`);
    console.log(`Days Limit: ${DAYS_LIMIT}`);
    console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`------------------------------------\n`);

    try {
        // 1. Database Connection
        await db.sequelize.authenticate();
        console.log('Database connected successfully.');

        // 2. Soft-delete old pieces
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (DAYS_LIMIT * 24 * 60 * 60 * 1000));

        const oldPecas = await Peca.findAll({
            where: {
                createdAt: {
                    [Op.lt]: cutoffDate
                }
            }
        });

        console.log(`Found ${oldPecas.length} pieces created before ${cutoffDate.toISOString()}.`);

        if (APPLY && oldPecas.length > 0) {
            console.log(`Deleting ${oldPecas.length} pieces...`);
            await Peca.destroy({
                where: {
                    id: oldPecas.map(p => p.id)
                }
            });
            console.log('Old pieces deleted (soft delete).');
        } else if (!APPLY) {
            console.log('DRY-RUN: Skipping deletion.');
        }

        // 3. Read Excel
        if (!fs.existsSync(EXCEL_PATH)) {
            throw new Error(`Excel file not found at ${EXCEL_PATH}`);
        }

        const workbook = xlsx.readFile(EXCEL_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);
        console.log(`Excel contains ${data.length} rows.`);

        // 4. Resolve Defaults
        const defaultLocalId = await getOrCreateEntity(Local, 'ESTOQUE');
        const defaultMotivoId = await getOrCreateEntity(Motivo, 'ENTRADA_IMPORTACAO', 'descricao');

        // 4.1 Tag Sequence logic
        const lastPeca = await Peca.findOne({
            order: [['codigo_etiqueta', 'DESC']],
            where: {
                codigo_etiqueta: { [Op.like]: 'TAG-%' }
            }
        });
        let nextSeq = lastPeca ? (parseInt(lastPeca.codigo_etiqueta.split('-')[1]) || 1000) + 1 : 1001;

        // 5. Process Rows
        const piecesToCreate = [];
        console.log('\nResolving entities and preparing pieces...');

        for (let i = 0; i < data.length; i++) {
            const row = data[i];

            // Resolve IDs
            const fornecedorId = await getOrCreateEntity(Pessoa, row.fornecedor, 'nome', { is_fornecedor: true, tipo: 'PF' });
            const marcaId = await getOrCreateEntity(Marca, row.marca);
            const categoriaId = await getOrCreateEntity(Categoria, row.categoria);
            const corId = await getOrCreateEntity(Cor, row.cor);
            const tamanhoId = await getOrCreateEntity(Tamanho, row.tam || row.tamanho);

            // Calculate values
            const preco_venda = parseFloat(row.preco || 0);
            const comissao_pct = parseFloat(row.comissao || 50); // Default to 50 if missing

            // Logic matching CatalogoService
            const valor_liquido_fornecedor = (preco_venda * comissao_pct) / 100;
            const valor_comissao_loja = preco_venda - valor_liquido_fornecedor;

            piecesToCreate.push({
                codigo_etiqueta: `TAG-${nextSeq++}`,
                descricao_curta: (row.desc || row.descricao || 'Sem Descrição').substring(0, 70),
                preco_venda,
                preco_custo: parseFloat(row.custo || 0),
                valor_comissao_loja,
                valor_liquido_fornecedor,
                tipo_aquisicao: 'CONSIGNACAO',
                status: 'NOVA',
                quantidade: parseInt(row.quantidade || 1),
                quantidade_inicial: parseInt(row.quantidade || 1),
                fornecedorId,
                marcaId,
                categoriaId,
                corId,
                tamanhoId,
                localId: defaultLocalId,
                motivoId: defaultMotivoId,
                data_entrada: now,
                sync_ecommerce: true
            });

            if ((i + 1) % 100 === 0) console.log(`Processed ${i + 1}/${data.length} rows...`);
        }

        // 6. Bulk Insert
        if (APPLY) {
            console.log(`\nInserting ${piecesToCreate.length} pieces...`);
            // We use standard create or bulkCreate. 
            // Note: hooks might be important (like SKU generation if it exists).
            // Peca model has an afterUpdate hook but no beforeCreate hook shown in our previous view_file.
            // Let's use bulkCreate for performance.
            const createdPecas = await Peca.bulkCreate(piecesToCreate, { returning: true });

            console.log('Logging stock movements...');
            const stockMovements = createdPecas.map(p => ({
                pecaId: p.id,
                tipo: 'ENTRADA',
                quantidade: p.quantidade,
                motivo: 'Cadastro Inicial (Importação)',
                data_movimento: now,
            }));

            // We need to import MovimentacaoEstoque from db
            await db.MovimentacaoEstoque.bulkCreate(stockMovements);

            console.log('Import finished successfully!');
        } else {
            console.log(`\nDRY-RUN: Prepared ${piecesToCreate.length} pieces. Use --apply to save.`);
        }

        // 7. Summary
        console.log('\n--- Import Summary ---');
        console.log(`Total Rows Processed: ${piecesToCreate.length}`);
        if (piecesToCreate.length > 0) {
            console.log('First Item Sample:', JSON.stringify(piecesToCreate[0], null, 2));
        }

    } catch (err) {
        console.error('\nFATAL ERROR:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
