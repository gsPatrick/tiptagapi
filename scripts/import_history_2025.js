const path = require('path');
const xlsx = require('xlsx');
const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Database Connection
const sequelize = process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        define: {
            timestamps: true,
            underscored: true,
            paranoid: true,
        },
        dialectOptions: {
            ssl: false // explicit disable as per url
        }
    })
    : new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            dialect: process.env.DB_DIALECT || 'postgres',
            logging: false,
            define: {
                timestamps: true,
                underscored: true,
                paranoid: true,
            },
        }
    );

// Import Models
const PessoaModel = require('../src/models/Pessoa');
const PecaModel = require('../src/models/Peca');
const MarcaModel = require('../src/models/Marca');
const CategoriaModel = require('../src/models/Categoria');
const CorModel = require('../src/models/Cor');
const TamanhoModel = require('../src/models/Tamanho');
const LocalModel = require('../src/models/Local');
const MotivoModel = require('../src/models/Motivo');

const Pessoa = PessoaModel(sequelize, DataTypes);
const Peca = PecaModel(sequelize, DataTypes);
const Marca = MarcaModel(sequelize, DataTypes);
const Categoria = CategoriaModel(sequelize, DataTypes);
const Cor = CorModel(sequelize, DataTypes);
const Tamanho = TamanhoModel(sequelize, DataTypes);
const Local = LocalModel(sequelize, DataTypes);
const Motivo = MotivoModel(sequelize, DataTypes);

const EXCEL_FILE = path.join(__dirname, '../pecas (2).xlsx');
const FIXED_DATE = new Date('2025-12-24T12:00:00Z');

// Helpers for caching
const cache = {
    marcas: new Map(),
    categorias: new Map(),
    cores: new Map(),
    tamanhos: new Map()
};

async function getOrCreateModel(Model, name, cacheMap, defaults = {}) {
    if (!name) return null;
    const key = name.toString().trim().toUpperCase();
    if (cacheMap.has(key)) return cacheMap.get(key);

    let record = await Model.findOne({ where: { nome: name } });
    if (!record) {
        // Try case insensitive find
        const records = await Model.findAll();
        record = records.find(r => r.nome.toUpperCase() === key);
    }

    if (!record) {
        console.log(`Creating new ${Model.name}: ${name}`);
        record = await Model.create({ nome: name, ...defaults });
    }

    cacheMap.set(key, record.id);
    return record.id;
}

// Specific name consolidation rules from user
const NAME_CONSOLIDATIONS = {
    // Input variations -> Output name
    'ALINE GUIMARÃES ORNAGUI': 'ALINE ORNAGUI',
    'ALINE GUIMARAES ORNAGUI': 'ALINE ORNAGUI',
    'ALINE LIMA POR GARIMPO': 'ALINE ORNAGUI',
    'ALINE LIMA': 'ALINE ORNAGUI',
    'DENISE LIMA FOR GARIMPO': 'DENISE LIMA',
    'DENISE LIMA FOR GARIMPO 18': 'DENISE LIMA',
    'EDERALDO BUENO': 'LUANA VERONESI',
    'LUANA': 'LUANA VERONESI',
    'CLAUDIA MÃE LUANA': 'LUANA VERONESI',
    'CLAUDIA MAE LUANA': 'LUANA VERONESI',
    'JUJU SIMÕES': 'JULIANA SIMÕES',
    'JUJU SIMOES': 'JULIANA SIMÕES',
    'JULIANA SIMOES': 'JULIANA SIMÕES',
    'KELY LUZ': 'KELLY LUZ',
    'KELY LUZ COD 125': 'KELLY LUZ',
    'LETICIA REZZINI': 'LETICIA REGAZZINI',
    'MARIA APARECIDA CARVALHO ALMEIDA FORN': 'MARIA AP. DE CARVALHO ALMEIDA',
    'MARIA APARECIDA CARVALHO ALMEIDA': 'MARIA AP. DE CARVALHO ALMEIDA',
};

function normalizeSupplierName(rawName) {
    if (!rawName) return null;
    let name = rawName.toString().trim().toUpperCase();

    // Check if this name has a specific consolidation rule
    if (NAME_CONSOLIDATIONS[name]) {
        return NAME_CONSOLIDATIONS[name];
    }

    // Otherwise, return the exact name from the spreadsheet (just trimmed and uppercased)
    return name;
}

async function main() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // Read Excel
        const workbook = xlsx.readFile(EXCEL_FILE);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet);

        console.log(`Total rows to process: ${rows.length}`);
        if (rows.length > 0) {
            console.log('Sample row keys:', Object.keys(rows[0]));
        }

        let countProcessed = 0;
        let countCreated = 0;

        // Get the current max Tag number
        const [maxTagResult] = await sequelize.query(
            `SELECT MAX(CAST(SPLIT_PART(codigo_etiqueta, '-', 2) AS INTEGER)) as max_num
             FROM pecas
             WHERE codigo_etiqueta LIKE 'TAG-%'`,
            { type: sequelize.QueryTypes.SELECT }
        );
        let nextTagNum = (maxTagResult?.max_num || 1000) + 1;
        console.log(`Starting with Tag number: TAG-${nextTagNum}`);

        // Helper for case-insensitive lookup
        const getCol = (row, key) => {
            const exact = row[key];
            if (exact !== undefined) return exact;
            const lowerKey = key.toLowerCase();
            const foundKey = Object.keys(row).find(k => k.toLowerCase() === lowerKey);
            return foundKey ? row[foundKey] : undefined;
        };

        for (const row of rows) {
            countProcessed++;
            try {
                const rawSupplier = getCol(row, 'fornecedor');
                const supplierName = normalizeSupplierName(rawSupplier);

                if (!supplierName) {
                    continue;
                }

                // 1. Handle Supplier using raw SQL (to avoid model column mismatch)
                const [existingSuppliers] = await sequelize.query(
                    `SELECT id, nome, is_fornecedor, is_cliente FROM pessoas 
                     WHERE UPPER(nome) = :nome AND deleted_at IS NULL LIMIT 1`,
                    { replacements: { nome: supplierName }, type: sequelize.QueryTypes.SELECT }
                );

                let supplierId;
                if (existingSuppliers && existingSuppliers.id) {
                    supplierId = existingSuppliers.id;
                    // Update flags if needed
                    if (!existingSuppliers.is_fornecedor || !existingSuppliers.is_cliente) {
                        await sequelize.query(
                            `UPDATE pessoas SET is_fornecedor = true, is_cliente = true, updated_at = NOW() WHERE id = :id`,
                            { replacements: { id: supplierId } }
                        );
                    }
                } else {
                    console.log(`Creating new Provider/Client: ${supplierName}`);
                    const [insertResult] = await sequelize.query(
                        `INSERT INTO pessoas (nome, is_fornecedor, is_cliente, tipo, created_at, updated_at) 
                         VALUES (:nome, true, true, 'PF', NOW(), NOW()) RETURNING id`,
                        { replacements: { nome: supplierName }, type: sequelize.QueryTypes.INSERT }
                    );
                    supplierId = insertResult[0]?.id || insertResult;
                }

                // 2. Handle Item
                const statusRaw = getCol(row, 'status');
                // 9 -> A VENDA (DISPONIVEL)
                // 4 -> VENDIDA

                let status = 'DISPONIVEL';
                let data_venda = null;
                const data_entrada = FIXED_DATE;

                const statusStr = String(statusRaw || '').toUpperCase();
                if (statusStr.startsWith('9')) {
                    status = 'DISPONIVEL';
                } else if (statusStr.startsWith('4')) {
                    status = 'VENDIDA';
                    data_venda = FIXED_DATE;
                } else if (statusStr.startsWith('1')) {
                    status = 'NOVA';
                } else if (statusStr.startsWith('5')) {
                    status = 'DEVOLVIDA_FORNECEDOR';
                }

                const descricao = getCol(row, 'descricao') || getCol(row, 'descrição') || 'Item sem descrição';
                const preco = parseFloat(getCol(row, 'preco') || getCol(row, 'preço')) || 0;
                const custo = parseFloat(getCol(row, 'custo')) || 0;
                const id_alternativo = getCol(row, 'id_alternativo');

                // Commission is always 50% as per user request
                const valor_comissao_loja = preco * 0.5;
                const valor_liquido_fornecedor = preco * 0.5;

                // Relational fields
                const marcaName = getCol(row, 'marca') || getCol(row, 'marcar');
                const marcaId = await getOrCreateModel(Marca, marcaName, cache.marcas);

                const categoriaId = await getOrCreateModel(Categoria, getCol(row, 'categoria'), cache.categorias);
                const corId = await getOrCreateModel(Cor, getCol(row, 'cor'), cache.cores);
                const tamanhoId = await getOrCreateModel(Tamanho, getCol(row, 'tamanho'), cache.tamanhos);

                // Create Peca
                const codigo_etiqueta = `TAG-${nextTagNum++}`;
                await Peca.create({
                    uuid: require('crypto').randomUUID(),
                    codigo_etiqueta: codigo_etiqueta,
                    sku_ecommerce: id_alternativo ? String(id_alternativo) : null,
                    descricao_curta: descricao.substring(0, 70),
                    descricao_detalhada: descricao,
                    fornecedorId: supplierId,
                    marcaId,
                    categoriaId,
                    corId,
                    tamanhoId,
                    preco_venda: preco,
                    preco_custo: custo,
                    valor_comissao_loja: valor_comissao_loja,
                    valor_liquido_fornecedor: valor_liquido_fornecedor,
                    status: status,
                    data_entrada: data_entrada,
                    data_venda: data_venda,
                    quantidade: 1,
                    quantidade_inicial: 1,
                    tipo_aquisicao: 'CONSIGNACAO',
                    localId: null,
                });

                countCreated++;
            } catch (err) {
                console.error(`Error processing row ${countProcessed + 1}:`, err.message);
            }
            countProcessed++;

            // Add a small delay to prevent overwhelming the DB connection
            await new Promise(resolve => setTimeout(resolve, 50));

            if (countProcessed % 50 === 0) {
                console.log(`Processed ${countProcessed} rows...`);
            }
        }

        console.log(`Finished! Processed: ${countProcessed}, Created Items: ${countCreated}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

main();
