# Script de Manutenção de Peças - Tiptag API

Este script automatiza a limpeza de peças antigas e a re-importação de peças a partir de uma planilha Excel, garantindo que os filtros do painel (fornecedor, marca, categoria, etc.) funcionem corretamente através da resolução de IDs.

## Pré-requisitos

Certifique-se de que as seguintes variáveis estão no seu arquivo `.env`:

```env
API_BASE_URL=http://localhost:5000/api/v1
API_TOKEN=seu_token_jwt_aqui
```

## Como usar

### 1. Simulação (Dry-run)
Apenas mostra o que seria feito, sem apagar nenhum dado:
```bash
npm run pecas:limpar-e-importar
```

### 2. Executar Limpeza e Re-importação
Apaga as peças antigas e sobe as novas da planilha:
```bash
npm run pecas:limpar-e-importar -- --apply
```

### 3. Ajustar Janela de Dias
Por padrão, o script mantém peças dos últimos 10 dias. Para mudar esse valor:
```bash
npm run pecas:limpar-e-importar -- --days=15
```

## O que o script faz:

1. **Coleta**: Busca todas as peças cadastradas na API.
2. **Filtra**: Separa as peças que têm mais de 10 dias de criação.
3. **Limpa**: Realiza o soft-delete das peças antigas (se usar `--apply`).
4. **Resolve IDs**: Lê o arquivo `pecas.xlsx` e, para cada linha, busca ou cria o ID correto para Fornecedor, Marca, Categoria, Cor e Tamanho.
5. **Normaliza**: Gera um arquivo temporário `scripts/pecas_normalized.xlsx` com os IDs resolvidos.
6. **Importa**: Faz o upload do arquivo normalizado para a API.
7. **Valida**: Verifica se os filtros estão retornando dados corretamente após a importação.

## Logs
O script gera um arquivo `scripts/deletion_log_*.json` com a lista de IDs processados para auditoria.
