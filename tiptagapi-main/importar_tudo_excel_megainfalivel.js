const axios = require("axios");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

// =====================================================
// CONFIGURAÇÕES PRINCIPAIS
// =====================================================
const BASE_URL = "http://localhost:5000";
const EXCEL_FILE = "precificacao_export_20260108_090504.xlsx";
const EXCEL_PATH = path.join(__dirname, EXCEL_FILE);

const LOGIN_EMAIL = "admin@alcateia.com";
const LOGIN_PASSWORD = "alcateiaadmin123";

// IMPORTAÇÃO
const LIMITAR_LINHAS = 0;        // 0 = tudo
const DRY_RUN = false;            // true = simula (não grava)
const BATCH_SIZE = 50;
const DELAY_MS = 80;
const RETRIES = 3;

// LOGS
const LOG_OK = path.join(__dirname, "import_sucesso.jsonl");
const LOG_ERR = path.join(__dirname, "import_erros.jsonl");
const LOG_SUM = path.join(__dirname, "import_resumo.txt");

// =====================================================
// ENDPOINTS
// =====================================================
const LOGIN_URL = `${BASE_URL}/api/v1/auth/login`;
const PECAS_URL = `${BASE_URL}/api/v1/catalogo/pecas`;
const CADASTROS_URL = `${BASE_URL}/api/v1/cadastros`;

// =====================================================
// TOKEN / CACHE
// =====================================================
let TOKEN = "";
const cacheMarcas = new Map();
const cacheCategorias = new Map();

// =====================================================
// UTILS
// =====================================================
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function writeJsonLine(file, obj) {
  fs.appendFileSync(file, JSON.stringify(obj) + "\n");
}

function cortar70(str) {
  if (!str) return "";
  return str.toString().trim().slice(0, 70);
}

function parseDateExcel(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();

  const s = v.toString().trim();

  // dd/mm/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const dt = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }

  // fallback
  const dt2 = new Date(s);
  if (!isNaN(dt2.getTime())) return dt2.toISOString();

  return null;
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };
}

async function requestWithRetry(fn, tries = RETRIES) {
  let lastErr;

  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = e.response?.status;

      // retry apenas em erro temporário
      if ([429, 500, 502, 503, 504].includes(status)) {
        await sleep(300 + i * 600);
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

// =====================================================
// AUTH
// =====================================================
async function login() {
  const res = await axios.post(LOGIN_URL, {
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  });

  TOKEN =
    res.data?.token ||
    res.data?.access_token ||
    res.data?.accessToken ||
    res.data?.data?.token ||
    res.data?.data?.access_token;

  if (!TOKEN) {
    throw new Error("Token não encontrado na resposta do login.");
  }

  console.log("✅ Login OK. Token recebido.");
}

// =====================================================
// CADASTROS (MARCA / CATEGORIA)
// =====================================================
async function obterOuCriarCadastro(entidade, nome, cacheMap) {
  if (!nome) return null;

  const key = nome.toString().trim().toUpperCase();
  if (cacheMap.has(key)) return cacheMap.get(key);

  const listRes = await requestWithRetry(() =>
    axios.get(`${CADASTROS_URL}/${entidade}`, { headers: headers() })
  );

  const raw = listRes.data;
  const arr = Array.isArray(raw) ? raw : (raw?.data || []);

  let item = arr.find(i => (i.nome || "").toString().trim().toUpperCase() === key);
  if (!item) {
    item = arr.find(i => (i.nome || "").toString().trim().toUpperCase().includes(key));
  }

  if (item?.id) {
    cacheMap.set(key, item.id);
    return item.id;
  }

  if (DRY_RUN) return null;

  const created = await requestWithRetry(() =>
    axios.post(`${CADASTROS_URL}/${entidade}`, { nome }, { headers: headers() })
  );

  const id = created.data?.id || created.data?.data?.id;
  if (!id) throw new Error(`Não consegui criar ${entidade} (${nome})`);

  cacheMap.set(key, id);
  console.log(`➕ Criado ${entidade}: ${nome} (id=${id})`);
  return id;
}

// =====================================================
// MAPEAMENTOS
// =====================================================
function mapTipoAquisicao(tipoExcel) {
  const t = (tipoExcel || "").toString().toLowerCase();
  if (t.includes("consign")) return "CONSIGNACAO";
  if (t.includes("permuta")) return "PERMUTA";
  return "COMPRA";
}

function mapStatus(statusExcel) {
  const s = (statusExcel || "").toString().toUpperCase();
  if (s.includes("VENDA")) return "DISPONIVEL";
  return "NOVA";
}

// =====================================================
// SKU INFALÍVEL
// =====================================================
function gerarSku(row, index) {
  const alt = row["Alt Id"];
  const id = row["ID"];

  if (alt && alt.toString().trim()) return alt.toString().trim();
  if (id && id.toString().trim()) return `ALT${id.toString().trim()}`;

  return `AUTO${String(index + 1).padStart(8, "0")}`;
}

// =====================================================
// PAYLOAD
// =====================================================
function montarPayload(row, marcaId, categoriaId, index) {
  const descricao = row["Descrição"] || row["Nome"] || row["Produto"] || "SEM DESCRICAO";
  const sku = gerarSku(row, index);

  const preco = Number(row["Preço"] || 0);
  const custo = Number(row["Custo"] || 0);
  const promo = Number(row["Promo"] || 0);

  const tipoOriginal = mapTipoAquisicao(row["Tipo"]);
  const status = mapStatus(row["Status"]);
  const dataEntrada = parseDateExcel(row["Entrada"]);

  // ✅ REGRA INFALÍVEL
  // CONSIGNACAO exige fornecedorId no backend, e pode quebrar,
  // então convertemos para COMPRA se não tiver fornecedor.
  let tipoFinal = tipoOriginal;
  if (tipoFinal === "CONSIGNACAO") {
    tipoFinal = "COMPRA";
  }

  const payload = {
    codigo_etiqueta: sku,
    descricao_curta: cortar70(descricao),
    descricao_detalhada: descricao ? descricao.toString().trim() : null,
    tipo_aquisicao: tipoFinal,
    status: status,
    preco_venda: preco,
    preco_custo: custo > 0 ? custo : null,
    preco_promocional: promo > 0 ? promo : null,
    quantidade: 1
  };

  if (dataEntrada) payload.data_entrada = dataEntrada;
  if (marcaId) payload.marcaId = marcaId;
  if (categoriaId) payload.categoriaId = categoriaId;

  // ❌ NUNCA ENVIA fornecedorId (evita FK constraint)
  // payload.fornecedorId = ...

  return payload;
}

function validarPayload(payload) {
  const erros = [];
  if (!payload.codigo_etiqueta) erros.push("codigo_etiqueta/SKU vazio");
  if (!payload.descricao_curta) erros.push("descricao_curta vazia");
  if (!payload.tipo_aquisicao) erros.push("tipo_aquisicao vazio");
  if (!payload.preco_venda || payload.preco_venda <= 0) erros.push("preco_venda inválido");
  return erros;
}

// =====================================================
// UPSERT
// =====================================================
async function criarPeca(payload) {
  return requestWithRetry(() =>
    axios.post(PECAS_URL, payload, { headers: headers() })
  );
}

async function upsertPeca(payload) {
  if (DRY_RUN) return { action: "dryrun" };

  try {
    const res = await criarPeca(payload);
    return { action: "created", data: res.data };
  } catch (e) {
    const status = e.response?.status;
    const data = e.response?.data;
    const msg = JSON.stringify(data || "").toLowerCase();

    const isDuplicate =
      status === 409 ||
      msg.includes("duplic") ||
      msg.includes("already exists") ||
      msg.includes("unique");

    if (isDuplicate) {
      return { action: "duplicate_skipped", data };
    }

    throw e;
  }
}

// =====================================================
// MAIN
// =====================================================
async function main() {
  fs.writeFileSync(LOG_OK, "");
  fs.writeFileSync(LOG_ERR, "");
  fs.writeFileSync(LOG_SUM, "");

  console.log("🚀 Importador MEGA INFALÍVEL iniciado");
  console.log("📌 DRY_RUN:", DRY_RUN);
  console.log("📌 Excel:", EXCEL_PATH);

  await login();

  const wb = xlsx.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const total = LIMITAR_LINHAS > 0 ? Math.min(LIMITAR_LINHAS, rows.length) : rows.length;
  console.log(`📦 Linhas no Excel: ${rows.length} | Vou processar: ${total}`);

  let created = 0, duplicated = 0, failed = 0, skipped = 0;

  for (let i = 0; i < total; i++) {
    const row = rows[i];

    try {
      const marcaId = await obterOuCriarCadastro("marcas", row["Marca"] || "SEM MARCA", cacheMarcas);
      const categoriaId = await obterOuCriarCadastro("categorias", row["Categoria"] || "IMPORTACAO", cacheCategorias);

      const payload = montarPayload(row, marcaId, categoriaId, i);
      const erros = validarPayload(payload);

      if (erros.length) {
        skipped++;
        writeJsonLine(LOG_ERR, { line: i + 1, error: "SKIPPED_VALIDATION", detalhes: erros, payload });
        continue;
      }

      const result = await upsertPeca(payload);

      if (result.action === "duplicate_skipped") {
        duplicated++;
        console.log(`⚠️ [${i+1}/${total}] DUPLICATE | SKU=${payload.codigo_etiqueta} | ${payload.descricao_curta}`);
      } else {
        created++;
        console.log(`✅ [${i+1}/${total}] CREATED | SKU=${payload.codigo_etiqueta} | ${payload.descricao_curta}`);
      }

      writeJsonLine(LOG_OK, { line: i + 1, action: result.action, sku: payload.codigo_etiqueta, nome: payload.descricao_curta });
      await sleep(DELAY_MS);

      if ((i + 1) % BATCH_SIZE === 0) {
        console.log(`⏸️ Pausa de lote (${BATCH_SIZE})...`);
        await sleep(800);
      }

    } catch (e) {
      failed++;
      writeJsonLine(LOG_ERR, {
        line: i + 1,
        status: e.response?.status,
        data: e.response?.data,
        message: e.message,
        stack: e.stack
      });

      console.log(`❌ [${i+1}/${total}] ERRO status=${e.response?.status} | ${e.message}`);
    }
  }

  const summary =
`Resumo:
Total processado: ${total}
Criados: ${created}
Duplicados ignorados: ${duplicated}
Falhas: ${failed}
Ignorados (validação): ${skipped}

Logs:
- ${LOG_OK}
- ${LOG_ERR}
`;

  fs.writeFileSync(LOG_SUM, summary);
  console.log("\n" + summary);
}

main();
