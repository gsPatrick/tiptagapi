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

function normalizeSupplierName(rawName) {
    if (!rawName) return null;
    let name = rawName.toString().trim();

    // Rule 1: [NAME] takes precedence
    const braceletMatch = name.match(/\[(.*?)\]/);
    if (braceletMatch) {
        return braceletMatch[1].trim().toUpperCase();
    }

    // Rule 2: "NAME FICA"
    if (name.toUpperCase().includes(' FICA')) {
        name = name.split(/ FICA/i)[0];
    }

    // Cleanups
    name = name.replace(/\s+FORN\b\.?/i, '');
    name = name.replace(/\s+FOR\b\.?/i, '');
    name = name.replace(/\s+GARIMPO\b/i, '');
    name = name.replace(/\s+COD\s*\d+/i, '');
    name = name.replace(/[0-9]+$/, ''); // Remove trailing numbers like " 258"

    if (name.includes(',')) {
        name = name.split(',')[0];
    }

    return name.trim().toUpperCase();
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

                // 1. Handle Supplier
                let supplier = await Pessoa.findOne({
                    where: sequelize.where(
                        sequelize.fn('upper', sequelize.col('nome')),
                        supplierName
                    )
                });

                if (!supplier) {
                    console.log(`Creating new Provider/Client: ${supplierName}`);
                    supplier = await Pessoa.create({
                        nome: supplierName,
                        is_fornecedor: true,
                        is_cliente: true, // "AMBOS"
                        tipo: 'PF'
                    });
                } else {
                    // Ensure flags are correct if existing
                    let updated = false;
                    if (!supplier.is_fornecedor || !supplier.is_cliente) {
                        supplier.is_fornecedor = true;
                        supplier.is_cliente = true;
                        await supplier.save();
                        updated = true;
                    }
                }

                // 2. Handle Item
                const statusRaw = getCol(row, 'status');
                // 9 -> A VENDA (DISPONIVEL)
                // 4 -> VENDIDA

                let status = 'DISPONIVEL';
                let data_venda = null;
                const data_entrada = FIXED_DATE;

                if (statusRaw == 9) {
                    status = 'DISPONIVEL';
                } else if (statusRaw == 4) {
                    status = 'VENDIDA';
                    data_venda = FIXED_DATE;
                }

                const descricao = getCol(row, 'descricao') || getCol(row, 'descrição') || 'Item sem descrição';
                const preco = parseFloat(getCol(row, 'preco') || getCol(row, 'preço')) || 0;
                const custo = parseFloat(getCol(row, 'custo')) || 0;
                const comissao = parseFloat(getCol(row, 'comissao') || getCol(row, 'comissão')) || 0;

                // Relational fields
                const marcaName = getCol(row, 'marca') || getCol(row, 'marcar');
                const marcaId = await getOrCreateModel(Marca, marcaName, cache.marcas);

                const categoriaId = await getOrCreateModel(Categoria, getCol(row, 'categoria'), cache.categorias);
                const corId = await getOrCreateModel(Cor, getCol(row, 'cor'), cache.cores);
                const tamanhoId = await getOrCreateModel(Tamanho, getCol(row, 'tamanho'), cache.tamanhos);

                // Create Peca
                await Peca.create({
                    descricao_curta: descricao.substring(0, 70),
                    descricao_detalhada: descricao,
                    fornecedorId: supplier.id,
                    marcaId,
                    categoriaId,
                    corId,
                    tamanhoId,
                    preco_venda: preco,
                    preco_custo: custo,
                    valor_comissao_loja: comissao > 0 ? (preco * (comissao / 100)) : 0,
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
                console.error(`Error processing row ${countProcessed}:`, err.message);
            }

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
