# Script de Manutenção de Peças (Acesso Direto ao Banco)

Este script realiza a manutenção do catálogo de peças conectando-se diretamente ao banco de dados PostgreSQL, permitindo a limpeza de registros antigos e a importação de novas peças a partir da planilha `pecas.xlsx`.

## Funcionamento

O script utiliza os modelos do Sequelize do próprio projeto para garantir a integridade dos dados. Ele resolve automaticamente os IDs de:
- **Fornecedores** (Pessoa.nome) - Marca como `is_fornecedor: true`.
- **Marcas**, **Categorias**, **Cores** e **Tamanhos**.
- **Local** (Padrão: `ESTOQUE`) e **Motivo** (Padrão: `ENTRADA_IMPORTACAO`).

## Como usar

### 1. Simulação (Dry-run)
Veja o que será feito sem alterar o banco de dados:
```bash
npm run pecas:db-limpar-e-importar
```

### 2. Executar Limpeza e Importação Real
Aplica as mudanças de fato:
```bash
npm run pecas:db-limpar-e-importar -- --apply
```

### 3. Ajustar Janela de Dias
Por padrão, mantém peças dos últimos 10 dias. Para mudar (ex: 30 dias):
```bash
npm run pecas:db-limpar-e-importar -- --days=30
```

## Configuração
O script utiliza as credenciais (`DB_HOST`, `DB_USER`, etc.) do seu arquivo `.env` atual. Não é necessário configurar tokens de API.

> [!CAUTION]
> Ao usar `--apply`, peças criadas há mais de X dias serão removidas (soft delete) para dar lugar aos dados da planilha.
