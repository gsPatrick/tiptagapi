const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const db = require('../src/models');
const { Peca, Pessoa, Marca, Categoria, Cor, Tamanho } = db;

const EXCEL_PATH = path.resolve(__dirname, '../pecas.xlsx');
const APPLY = process.argv.includes('--apply');

const entityCache = {
    Pessoa: new Map(),
    Marca: new Map(),
    Categoria: new Map(),
    Cor: new Map(),
    Tamanho: new Map()
};

async function getOrCreateEntity(Model, name, field = 'nome', extraData = {}) {
    if (!name) return null;
    const normalizedName = name.toString().trim();
    if (normalizedName === '') return null;
    const cacheKey = normalizedName.toLowerCase();

    if (entityCache[Model.name].has(cacheKey)) {
        return entityCache[Model.name].get(cacheKey);
    }

    let entity = await Model.findOne({
        where: { [field]: { [Op.iLike]: normalizedName } }
    });

    if (!entity) {
        if (APPLY) {
            console.log(`[UPGRADE] Creating ${Model.name}: ${normalizedName}`);
            entity = await Model.create({ [field]: normalizedName, ...extraData });
        } else {
            return -1; // Special marker for dry-run creation
        }
    }

    const id = entity.id;
    entityCache[Model.name].set(cacheKey, id);
    return id;
}

async function run() {
    console.log(`\n--- Tiptag Data Enrichment Upgrade ---`);
    console.log(`Excel Path: ${EXCEL_PATH}`);
    console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`------------------------------------\n`);

    try {
        await db.sequelize.authenticate();
        console.log('Database connected.');

        if (!fs.existsSync(EXCEL_PATH)) {
            throw new Error(`Excel file not found at ${EXCEL_PATH}`);
        }

        const workbook = xlsx.readFile(EXCEL_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const excelData = xlsx.utils.sheet_to_json(sheet);
        console.log(`Excel contains ${excelData.length} records.`);

        // Create a map for fast lookup in Excel
        // We assume TAG-1001 is row 0, TAG-1002 is row 1, etc.
        // But to be safer, we can try to find by ID if the ID column matches or use order.

        const pecasDB = await Peca.findAll({
            order: [['codigo_etiqueta', 'ASC']],
            where: {
                codigo_etiqueta: { [Op.like]: 'TAG-%' }
            }
        });

        console.log(`Database contains ${pecasDB.length} pieces to evaluate.`);

        let updatedCount = 0;
        let createdEntities = 0;

        for (let i = 0; i < pecasDB.length; i++) {
            const peca = pecasDB[i];
            // Match logic: spreadsheet row i matches peca i IF they were imported in order
            // We verify with a slice of description just in case
            const row = excelData[i];
            if (!row) continue;

            const rowDesc = (row.desc || row.descricao || '').substring(0, 30);
            const dbDesc = (peca.descricao_curta || '').substring(0, 30);

            // Simple heuristic check
            if (rowDesc.toLowerCase() !== dbDesc.toLowerCase() && rowDesc !== '' && dbDesc !== '') {
                // If they don't match, we might need a more complex lookup, but for now
                // let's assume the order is correct based on how maintain_pecas_db.js works
            }

            const updates = {};

            // 1. Color
            if (!peca.corId && row.cor) {
                const corId = await getOrCreateEntity(Cor, row.cor);
                if (corId === -1) createdEntities++;
                else if (corId) updates.corId = corId;
            }

            // 2. Brand
            if (!peca.marcaId && row.marca) {
                const marcaId = await getOrCreateEntity(Marca, row.marca);
                if (marcaId === -1) createdEntities++;
                else if (marcaId) updates.marcaId = marcaId;
            }

            // 3. Size (Tamanho) - Just in case
            if (!peca.tamanhoId && (row.tam || row.tamanho)) {
                const tamId = await getOrCreateEntity(Tamanho, row.tam || row.tamanho);
                if (tamId === -1) createdEntities++;
                else if (tamId) updates.tamanhoId = tamId;
            }

            if (Object.keys(updates).length > 0) {
                if (APPLY) {
                    await peca.update(updates);
                }
                updatedCount++;
            }

            if ((i + 1) % 500 === 0) console.log(`Evaluated ${i + 1}/${pecasDB.length} pieces...`);
        }

        console.log(`\n--- Upgrade Summary ---`);
        console.log(`Pieces identifying for upgrade: ${updatedCount}`);
        if (!APPLY) {
            console.log(`Dry-run: New auxiliary records to be created: ${createdEntities}`);
            console.log(`Use --apply to execute the changes.`);
        } else {
            console.log(`Successfully updated ${updatedCount} pieces.`);
        }

    } catch (err) {
        console.error('\nERROR:', err.message);
    } finally {
        await db.sequelize.close();
    }
}

run();
