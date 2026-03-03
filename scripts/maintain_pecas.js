const axios = require('axios');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { FormData } = require('formdata-node'); // Standard in Node 18+ but let's be safe or use built-in if available
const { Blob } = require('buffer');

dotenv.config();

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';
const TOKEN = process.env.API_TOKEN;
const EXCEL_PATH = process.env.EXCEL_PATH || path.resolve(__dirname, '../pecas.xlsx');
const DAYS_LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1]) || 10;
const APPLY = process.argv.includes('--apply');

if (!TOKEN) {
    console.error('ERROR: API_TOKEN is required in .env');
    process.exit(1);
}

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        Authorization: `Bearer ${TOKEN}`
    }
});

// Cache for ID resolution
const cache = {
    marcas: new Map(),
    categorias: new Map(),
    cores: new Map(),
    tamanhos: new Map(),
    pessoas: new Map()
};

/**
 * Utility: Wait for a specific duration
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ID Resolution Helper
 */
async function getOrCreateEntity(type, name) {
    if (!name) return null;
    const normalizedName = name.toString().trim().toLowerCase();
    
    const entityCache = cache[type];
    if (entityCache.has(normalizedName)) {
        return entityCache.get(normalizedName);
    }

    try {
        let endpoint = type === 'pessoas' ? '/pessoas' : `/cadastros/${type}`;
        
        // Search
        const response = await api.get(endpoint, { params: { nome: name } });
        let items = response.data;
        
        // Find exact match just in case
        let entity = items.find(i => i.nome?.toLowerCase() === normalizedName);
        
        if (!entity) {
            console.log(`Creating new ${type}: ${name}`);
            const createResponse = await api.post(endpoint, { nome: name });
            entity = createResponse.data;
        }

        entityCache.set(normalizedName, entity.id);
        return entity.id;
    } catch (err) {
        console.error(`Error resolving ${type} "${name}":`, err.response?.data || err.message);
        return null;
    }
}

/**
 * Main Maintenance Function
 */
async function maintain() {
    console.log(`--- Tiptag Maintenance Script ---`);
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Date Limit: ${DAYS_LIMIT} days`);
    console.log(`Mode: ${APPLY ? 'APPLY (Actual deletions)' : 'DRY-RUN'}`);
    console.log(`---------------------------------`);

    try {
        // 1. Fetch All Pieces
        console.log('Fetching pieces...');
        let allPecas = [];
        let limit = 5000; // Large limit as a fallback for lack of pagination
        const response = await api.get('/catalogo/pecas', { params: { limit } });
        allPecas = response.data;
        
        console.log(`Total pieces found: ${allPecas.length}`);

        // 2. Filter Pieces
        const now = Date.now();
        const limitMs = DAYS_LIMIT * 24 * 60 * 60 * 1000;
        
        const toKeep = [];
        const toDelete = [];

        for (const peca of allPecas) {
            const createdAt = new Date(peca.createdAt).getTime();
            if (now - createdAt < limitMs) {
                toKeep.push(peca);
            } else {
                toDelete.push(peca);
            }
        }

        console.log(`Pieces to KEEP: ${toKeep.length}`);
        console.log(`Pieces to DELETE: ${toDelete.length}`);

        if (toDelete.length > 0) {
            console.log('Sample IDs for deletion:', toDelete.slice(0, 10).map(p => p.id).join(', '));
        }

        // 3. Cleanup Deletions
        if (APPLY && toDelete.length > 0) {
            console.log(`\nStarting cleanup of ${toDelete.length} pieces...`);
            let count = 0;
            let failures = [];

            for (const peca of toDelete) {
                try {
                    await api.delete(`/catalogo/pecas/${peca.id}`);
                    count++;
                    if (count % 10 === 0) console.log(`Deleted ${count}/${toDelete.length}...`);
                    await sleep(200); // 5 requests per second
                } catch (err) {
                    // Simple retry
                    try {
                        await sleep(1000);
                        await api.delete(`/catalogo/pecas/${peca.id}`);
                        count++;
                    } catch (retryErr) {
                        failures.push({ id: peca.id, error: retryErr.message });
                    }
                }
            }
            console.log(`Cleanup complete: ${count} deleted, ${failures.length} failed.`);
            
            // Save deletion log
            const logPath = path.resolve(__dirname, `deletion_log_${Date.now()}.json`);
            fs.writeFileSync(logPath, JSON.stringify({ deleted: toDelete.map(p => p.id), failures }, null, 2));
            console.log(`Log saved to: ${logPath}`);
        } else if (!APPLY) {
            console.log('\nDRY-RUN: No pieces were deleted. Use --apply to proceed.');
        }

        // 4. Re-import from Excel
        console.log('\nStarting Excel re-import...');
        if (!fs.existsSync(EXCEL_PATH)) {
            console.error(`ERROR: Excel file not found at ${EXCEL_PATH}`);
            return;
        }

        const workbook = xlsx.readFile(EXCEL_PATH);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        console.log(`Rows in Excel: ${data.length}`);

        const normalizedData = [];
        for (const row of data) {
            // ID Resolution
            const fornecedorId = await getOrCreateEntity('pessoas', row.fornecedor);
            const marcaId = await getOrCreateEntity('marcas', row.marca);
            const categoriaId = await getOrCreateEntity('categorias', row.categoria);
            const corId = await getOrCreateEntity('cores', row.cor);
            const tamanhoId = await getOrCreateEntity('tamanhos', row.tamanho);

            normalizedData.push({
                descricao_curta: row.descricao || row.descricao_curta,
                preco_venda: row.preco || row.preco_venda,
                preco_custo: row.custo || row.preco_custo || null,
                tipo_aquisicao: process.env.DEFAULT_TIPO_AQUISICAO || 'CONSIGNACAO',
                status: 'NOVA',
                quantidade: row.quantidade || 1,
                fornecedorId,
                marcaId,
                categoriaId,
                corId,
                tamanhoId,
                codigo_etiqueta: row.codigo_etiqueta || null
            });
        }

        // Create intermediate Excel
        const intermediatePath = path.resolve(__dirname, 'pecas_normalized.xlsx');
        const newWs = xlsx.utils.json_to_sheet(normalizedData);
        const newWb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWb, newWs, 'PECAS');
        xlsx.writeFile(newWb, intermediatePath);
        console.log(`Normalized Excel created at: ${intermediatePath}`);

        // Upload
        if (APPLY) {
            console.log('Uploading pieces to API...');
            
            // Using a simple POST since we can't easily use FormData without external deps if not built-in
            // But Node 18+ has it. Let's try native fetch which is cleaner for multipart in modern Node.
            const fileBuffer = fs.readFileSync(intermediatePath);
            const formData = new global.FormData();
            const blob = new global.Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            formData.append('file', blob, 'pecas_normalized.xlsx');
            formData.append('tipo', 'PECAS');

            const uploadResponse = await fetch(`${BASE_URL}/importacao/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: formData
            });

            if (uploadResponse.ok) {
                const result = await uploadResponse.json();
                console.log('Import Result:', result);
            } else {
                const errorBody = await uploadResponse.text();
                console.error('Upload failed:', uploadResponse.status, errorBody);
            }
        }

        // 5. Validation
        console.log('\n--- Post-Import Validation ---');
        const suppliers = [...cache.pessoas.values()].slice(0, 3);
        for (const id of suppliers) {
            const vResponse = await api.get('/catalogo/pecas', { params: { fornecedorId: id } });
            console.log(`Supplier ID ${id}: Found ${vResponse.data.length} pieces.`);
        }

    } catch (err) {
        console.error('Fatal Error during maintenance:', err.response?.data || err.message);
    }
}

maintain();
