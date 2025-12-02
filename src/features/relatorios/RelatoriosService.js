const { Pedido, ItemPedido, Peca, Categoria, Marca, User, Sequelize, Pessoa, Tamanho, Cor, PagamentoPedido } = require('../../models');
const { Op } = require('sequelize');
const { startOfDay, endOfDay } = require('date-fns');

class RelatoriosService {
    async getResumo() {
        const totalVendas = await Pedido.sum('total', {
            where: { status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] } }
        });

        const totalPedidos = await Pedido.count({
            where: { status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] } }
        });

        const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

        const pagamentos = await PagamentoPedido.findAll({
            attributes: [
                'metodo',
                [Sequelize.fn('SUM', Sequelize.col('valor')), 'total']
            ],
            include: [{
                model: Pedido,
                as: 'pedido',
                attributes: [],
                where: { status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] } }
            }],
            group: ['metodo'],
            raw: true
        });

        let totalReal = 0;
        let totalPermuta = 0;

        pagamentos.forEach(p => {
            if (p.metodo === 'VOUCHER_PERMUTA') {
                totalPermuta += parseFloat(p.total || 0);
            } else {
                totalReal += parseFloat(p.total || 0);
            }
        });

        return {
            totalVendas: parseFloat(totalVendas || 0).toFixed(2),
            totalReal: totalReal.toFixed(2),
            totalPermuta: totalPermuta.toFixed(2),
            totalPedidos,
            ticketMedio: parseFloat(ticketMedio).toFixed(2)
        };
    }

    async getVendasPorCategoria(inicio, fim) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
        };

        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereClause.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const vendas = await ItemPedido.findAll({
            attributes: [
                [Sequelize.col('peca.categoria.nome'), 'categoria'],
                [Sequelize.fn('SUM', Sequelize.col('valor_unitario_final')), 'total'],
                [Sequelize.fn('COUNT', Sequelize.col('ItemPedido.id')), 'qtd']
            ],
            include: [
                {
                    model: Peca,
                    as: 'peca',
                    attributes: [],
                    include: [{ model: Categoria, as: 'categoria', attributes: [] }]
                },
                {
                    model: Pedido,
                    as: 'pedido',
                    attributes: [],
                    where: whereClause
                }
            ],
            group: [Sequelize.col('peca.categoria.nome')],
            raw: true,
            order: [[Sequelize.literal('total'), 'DESC']]
        });

        return vendas.map(v => {
            const valor = parseFloat(v.total || 0);
            const qtd = parseInt(v.qtd || 0);
            const ticket = qtd > 0 ? valor / qtd : 0;
            return {
                name: v.categoria || 'SEM CATEGORIA',
                valor,
                qtd,
                ticket
            };
        });
    }

    async getVendasPorMarca(inicio, fim) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
        };

        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereClause.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const vendas = await ItemPedido.findAll({
            attributes: [
                [Sequelize.col('peca.marca.nome'), 'marca'],
                [Sequelize.fn('SUM', Sequelize.col('valor_unitario_final')), 'total'],
                [Sequelize.fn('COUNT', Sequelize.col('ItemPedido.id')), 'qtd']
            ],
            include: [
                {
                    model: Peca,
                    as: 'peca',
                    attributes: [],
                    include: [{ model: Marca, as: 'marca', attributes: [] }]
                },
                {
                    model: Pedido,
                    as: 'pedido',
                    attributes: [],
                    where: whereClause
                }
            ],
            group: [Sequelize.col('peca.marca.nome')],
            raw: true,
            order: [[Sequelize.literal('total'), 'DESC']]
        });

        return vendas.map(v => {
            const valor = parseFloat(v.total || 0);
            const qtd = parseInt(v.qtd || 0);
            const ticket = qtd > 0 ? valor / qtd : 0;
            return {
                name: v.marca || 'SEM MARCA',
                valor,
                qtd,
                ticket
            };
        });
    }

    async getPerformanceVendedor(inicio, fim) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] },
            vendedorId: { [Op.ne]: null }
        };

        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereClause.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const performance = await Pedido.findAll({
            attributes: [
                [Sequelize.col('vendedor.nome'), 'vendedor'],
                [Sequelize.fn('SUM', Sequelize.col('pagamentos.valor')), 'total_vendas'],
                [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('Pedido.id'))), 'quantidade_pedidos'],
                [Sequelize.fn('SUM', Sequelize.col('desconto')), 'total_descontos']
            ],
            include: [
                { model: User, as: 'vendedor', attributes: [] },
                {
                    model: PagamentoPedido,
                    as: 'pagamentos',
                    attributes: [],
                    where: { metodo: { [Op.ne]: 'VOUCHER_PERMUTA' } },
                    required: false
                }
            ],
            where: whereClause,
            group: [Sequelize.col('vendedor.nome')],
            raw: true,
            order: [[Sequelize.literal('total_vendas'), 'DESC']],
            subQuery: false
        });

        return performance.map(p => {
            const total = parseFloat(p.total_vendas || 0);
            const qtd = parseInt(p.quantidade_pedidos || 0);
            const descontos = parseFloat(p.total_descontos || 0);
            const ticketMedio = qtd > 0 ? total / qtd : 0;
            // Simple score calculation
            const score = (total / 1000) + (qtd * 2);

            return {
                nome: p.vendedor,
                faturamento: total,
                vendas: qtd,
                ticket: ticketMedio,
                descontos: descontos,
                score: Math.min(100, score), // Cap score at 100
                pecas: 0, // Need ItemPedido join for this
                comissao: 0, // Need logic
                margem: 0 // Need logic
            };
        });
    }
    async getVendasPorFornecedor(inicio, fim) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
        };

        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereClause.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const vendas = await ItemPedido.findAll({
            attributes: [
                [Sequelize.col('peca.fornecedor.id'), 'fornecedorId'],
                [Sequelize.col('peca.fornecedor.nome'), 'fornecedor'],
                [Sequelize.fn('COUNT', Sequelize.col('ItemPedido.id')), 'qtd'],
                [Sequelize.fn('SUM', Sequelize.col('valor_unitario_final')), 'valor'],
                [Sequelize.fn('SUM', Sequelize.col('peca.valor_comissao_loja')), 'loja'],
                [Sequelize.fn('SUM', Sequelize.col('peca.valor_liquido_fornecedor')), 'custo']
            ],
            include: [
                {
                    model: Peca,
                    as: 'peca',
                    attributes: [],
                    include: [{ model: Pessoa, as: 'fornecedor', attributes: [] }]
                },
                {
                    model: Pedido,
                    as: 'pedido',
                    attributes: [],
                    where: whereClause
                }
            ],
            group: [Sequelize.col('peca.fornecedor.id'), Sequelize.col('peca.fornecedor.nome')],
            raw: true,
            order: [[Sequelize.literal('valor'), 'DESC']]
        });

        return vendas.map(v => {
            const valor = parseFloat(v.valor || 0);
            const loja = parseFloat(v.loja || 0);
            const custo = parseFloat(v.custo || 0);
            const qtd = parseInt(v.qtd || 0);
            const margem = valor > 0 ? (loja / valor) * 100 : 0;
            const ticket = qtd > 0 ? valor / qtd : 0;

            return {
                id: v.fornecedorId,
                nome: v.fornecedor || 'LOJA PRÓPRIA',
                qtd,
                valor,
                loja,
                custo,
                margem,
                ticket
            };
        });
    }

    async getVendasDetalhadas(inicio, fim) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
        };

        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereClause.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const itens = await ItemPedido.findAll({
            include: [
                {
                    model: Peca,
                    as: 'peca',
                    include: [
                        { model: Pessoa, as: 'fornecedor', attributes: ['nome'] },
                        { model: Categoria, as: 'categoria', attributes: ['nome'] },
                        { model: Marca, as: 'marca', attributes: ['nome'] },
                        { model: Tamanho, as: 'tamanho', attributes: ['nome'] },
                        { model: Cor, as: 'cor', attributes: ['nome'] }
                    ]
                },
                {
                    model: Pedido,
                    as: 'pedido',
                    attributes: ['id', 'data_pedido', 'status'],
                    include: [{ model: Pessoa, as: 'cliente', attributes: ['nome'] }],
                    where: whereClause
                }
            ],
            order: [[Sequelize.col('pedido.data_pedido'), 'DESC']]
        });

        return itens.map(item => {
            const p = item.peca;
            const ped = item.pedido;
            const preco = parseFloat(item.valor_unitario_final || 0);
            const loja = parseFloat(p.valor_comissao_loja || 0);
            const custo = parseFloat(p.valor_liquido_fornecedor || 0);
            const margem = preco > 0 ? (loja / preco) * 100 : 0;

            return {
                id: p.id,
                idAlt: p.codigo_etiqueta || '—',
                desc: p.descricao_curta,
                fornecedor: p.fornecedor ? p.fornecedor.nome : 'LOJA PRÓPRIA',
                cliente: ped.cliente ? ped.cliente.nome : 'CLIENTE FINAL',
                cat: p.categoria ? p.categoria.nome : '—',
                marca: p.marca ? p.marca.nome : '—',
                cor: p.cor ? p.cor.nome : '—',
                tam: p.tamanho ? p.tamanho.nome : '—',
                tipo: p.tipo_aquisicao === 'CONSIGNACAO' ? 'share' : 'own',
                preco,
                taxa: 0, // Need logic
                imposto: 0, // Need logic
                repasse: custo,
                loja,
                margem,
                data: new Date(ped.data_pedido).toLocaleDateString('pt-BR')
            };
        });
    }
    async getAnaliseEstoque() {
        const pecas = await Peca.findAll({
            attributes: [
                'id', 'status', 'preco_venda', 'data_entrada', 'data_venda', 'valor_comissao_loja',
                [Sequelize.col('categoria.nome'), 'categoriaNome'],
                [Sequelize.col('fornecedor.nome'), 'fornecedorNome']
            ],
            include: [
                { model: Categoria, as: 'categoria', attributes: [] },
                { model: Pessoa, as: 'fornecedor', attributes: [] }
            ],
            raw: true
        });

        const totalPecas = pecas.length;
        const totalValor = pecas.reduce((acc, p) => acc + parseFloat(p.preco_venda || 0), 0);
        const precoMedio = totalPecas > 0 ? totalValor / totalPecas : 0;

        // Status
        const statusMap = {};
        pecas.forEach(p => {
            const s = p.status || 'OUTROS';
            statusMap[s] = (statusMap[s] || 0) + 1;
        });
        const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

        // Price Ranges
        const priceRanges = {
            'Até R$ 50': 0,
            'R$ 51 a R$ 100': 0,
            'R$ 101 a R$ 200': 0,
            'R$ 201 a R$ 500': 0,
            'Acima de R$ 500': 0
        };
        pecas.forEach(p => {
            const val = parseFloat(p.preco_venda || 0);
            if (val <= 50) priceRanges['Até R$ 50']++;
            else if (val <= 100) priceRanges['R$ 51 a R$ 100']++;
            else if (val <= 200) priceRanges['R$ 101 a R$ 200']++;
            else if (val <= 500) priceRanges['R$ 201 a R$ 500']++;
            else priceRanges['Acima de R$ 500']++;
        });
        const priceData = Object.entries(priceRanges).map(([name, value]) => ({ name, value }));

        // Time in Stock
        const timeRanges = {
            'Até 30 dias': 0,
            '31 a 60 dias': 0,
            '61 a 90 dias': 0,
            '91 a 180 dias': 0,
            'Mais de 180 dias': 0
        };
        const now = new Date();
        let totalDiasEstoque = 0;
        let countEstoque = 0;
        let totalDiasVenda = 0;
        let countVenda = 0;

        pecas.forEach(p => {
            const entrada = new Date(p.data_entrada);
            const diffTime = Math.abs(now - entrada);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (p.status === 'DISPONIVEL' || p.status === 'NOVA') {
                totalDiasEstoque += diffDays;
                countEstoque++;
                if (diffDays <= 30) timeRanges['Até 30 dias']++;
                else if (diffDays <= 60) timeRanges['31 a 60 dias']++;
                else if (diffDays <= 90) timeRanges['61 a 90 dias']++;
                else if (diffDays <= 180) timeRanges['91 a 180 dias']++;
                else timeRanges['Mais de 180 dias']++;
            }

            if (p.status === 'VENDIDA' && p.data_venda) {
                const venda = new Date(p.data_venda);
                const diffVenda = Math.ceil(Math.abs(venda - entrada) / (1000 * 60 * 60 * 24));
                totalDiasVenda += diffVenda;
                countVenda++;
            }
        });
        const timeData = Object.entries(timeRanges).map(([name, value]) => ({ name, value }));
        const tempoMedioEstoque = countEstoque > 0 ? Math.round(totalDiasEstoque / countEstoque) : 0;
        const tempoMedioVenda = countVenda > 0 ? Math.round(totalDiasVenda / countVenda) : 0;

        // Category
        const catMap = {};
        pecas.forEach(p => {
            const c = p.categoriaNome || 'OUTROS';
            catMap[c] = (catMap[c] || 0) + 1;
        });
        const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

        // Suppliers
        const supMap = {};
        pecas.forEach(p => {
            const s = p.fornecedorNome || 'LOJA PRÓPRIA';
            if (!supMap[s]) supMap[s] = { nome: s, estoque: 0, vendidas: 0, valor: 0, margemTotal: 0, countMargem: 0 };

            if (p.status === 'DISPONIVEL' || p.status === 'NOVA') {
                supMap[s].estoque++;
                supMap[s].valor += parseFloat(p.preco_venda || 0);
            } else if (p.status === 'VENDIDA') {
                supMap[s].vendidas++;
                const preco = parseFloat(p.preco_venda || 0);
                const loja = parseFloat(p.valor_comissao_loja || 0);
                if (preco > 0) {
                    supMap[s].margemTotal += (loja / preco);
                    supMap[s].countMargem++;
                }
            }
        });
        const suppliersData = Object.values(supMap)
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 10)
            .map(s => ({
                ...s,
                conversao: (s.estoque + s.vendidas) > 0 ? (s.vendidas / (s.estoque + s.vendidas)) * 100 : 0,
                margem: s.countMargem > 0 ? (s.margemTotal / s.countMargem) * 100 : 0
            }));

        return {
            kpis: {
                totalPecas,
                precoMedio,
                tempoMedioEstoque,
                tempoMedioVenda
            },
            statusData,
            priceData,
            timeData,
            categoryData,
            suppliersData
        };
    }
    async getRankingClientes(inicio, fim) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] },
            clienteId: { [Op.ne]: null }
        };

        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereClause.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const clientes = await Pedido.findAll({
            attributes: [
                [Sequelize.col('cliente.id'), 'id'],
                [Sequelize.col('cliente.nome'), 'nome'],
                [Sequelize.col('cliente.telefone'), 'telefone'],
                [Sequelize.col('cliente.createdAt'), 'desde'],
                [Sequelize.fn('MAX', Sequelize.col('data_pedido')), 'ultCompra'],
                [Sequelize.fn('SUM', Sequelize.col('total')), 'totalCompras'],
                [Sequelize.fn('COUNT', Sequelize.col('Pedido.id')), 'qtdCompras']
            ],
            include: [{ model: Pessoa, as: 'cliente', attributes: [] }],
            where: whereClause,
            group: [Sequelize.col('cliente.id')],
            raw: true,
            order: [[Sequelize.literal('totalCompras'), 'DESC']]
        });

        const now = new Date();

        return clientes.map(c => {
            const ultCompra = new Date(c.ultCompra);
            const diffTime = Math.abs(now - ultCompra);
            const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            let status = 'INATIVO';
            if (dias <= 30) status = 'ATIVO';
            else if (dias <= 90) status = 'EM RISCO';

            const total = parseFloat(c.totalCompras || 0);
            const qtd = parseInt(c.qtdCompras || 0);
            const ticket = qtd > 0 ? total / qtd : 0;

            // Simple trend logic (placeholder)
            const tendencia = 'FLAT';

            return {
                id: c.id,
                cliente: c.nome,
                cel: c.telefone || '-',
                desde: new Date(c.desde).toLocaleDateString('pt-BR'),
                ultCompra: ultCompra.toLocaleDateString('pt-BR'),
                dias,
                status,
                freq: 0, // Need more complex logic for frequency per month
                tendencia,
                compras: total,
                qtd,
                ticket
            };
        });
    }

    async getHistoricoCliente(clienteId) {
        const itens = await ItemPedido.findAll({
            include: [
                {
                    model: Pedido,
                    as: 'pedido',
                    where: {
                        clienteId,
                        status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
                    },
                    attributes: ['id', 'data_pedido']
                },
                {
                    model: Peca,
                    as: 'peca',
                    attributes: ['descricao_curta']
                }
            ],
            order: [[Sequelize.col('pedido.data_pedido'), 'DESC']]
        });

        return itens.map(item => ({
            venda: item.pedido.id,
            data: new Date(item.pedido.data_pedido).toLocaleDateString('pt-BR'),
            descricao: item.peca ? item.peca.descricao_curta : 'ITEM REMOVIDO',
            preco: parseFloat(item.valor_unitario || 0),
            desconto: parseFloat(item.desconto || 0),
            total: parseFloat(item.valor_unitario_final || 0)
        }));
    }
    async getDetalhesFornecedor(fornecedorId, inicio, fim) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
        };

        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereClause.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const wherePeca = {};
        // If fornecedorId is 'LOJA_PROPRIA' (or similar logic), handle it. 
        // Assuming fornecedorId is passed. If it's a specific ID:
        if (fornecedorId && fornecedorId !== 'null') {
            wherePeca.fornecedorId = fornecedorId;
        } else {
            wherePeca.fornecedorId = null; // Loja Própria
        }

        const itens = await ItemPedido.findAll({
            include: [
                {
                    model: Peca,
                    as: 'peca',
                    where: wherePeca,
                    include: [
                        { model: Categoria, as: 'categoria', attributes: ['nome'] },
                        { model: Marca, as: 'marca', attributes: ['nome'] }
                    ]
                },
                {
                    model: Pedido,
                    as: 'pedido',
                    where: whereClause,
                    attributes: ['id', 'data_pedido']
                }
            ]
        });

        // Aggregations
        const catMap = {};
        const marcaMap = {};
        const pecasList = [];

        itens.forEach(item => {
            const p = item.peca;
            const cat = p.categoria ? p.categoria.nome : 'OUTROS';
            const marca = p.marca ? p.marca.nome : 'OUTROS';

            catMap[cat] = (catMap[cat] || 0) + 1;
            marcaMap[marca] = (marcaMap[marca] || 0) + 1;

            pecasList.push({
                venda: item.pedido.id,
                data: new Date(item.pedido.data_pedido).toLocaleDateString('pt-BR'),
                desc: p.descricao_curta,
                preco: parseFloat(item.valor_unitario || 0),
                descVal: parseFloat(item.desconto || 0),
                total: parseFloat(item.valor_unitario_final || 0)
            });
        });

        const categorias = Object.entries(catMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
        const marcas = Object.entries(marcaMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);

        return {
            categorias,
            marcas,
            pecas: pecasList.sort((a, b) => b.venda - a.venda) // Sort by order ID desc
        };
    }
    async getComissoes(inicio, fim, fornecedorId) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
        };

        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereClause.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const wherePeca = {};
        if (fornecedorId && fornecedorId !== 'todos') {
            wherePeca.fornecedorId = fornecedorId;
        }

        const itens = await ItemPedido.findAll({
            include: [
                {
                    model: Peca,
                    as: 'peca',
                    where: wherePeca,
                    include: [{ model: Pessoa, as: 'fornecedor', attributes: ['nome', 'comissao_padrao'] }]
                },
                {
                    model: Pedido,
                    as: 'pedido',
                    where: whereClause,
                    attributes: ['id', 'data_pedido']
                }
            ],
            order: [[Sequelize.col('pedido.data_pedido'), 'DESC']]
        });

        return itens.map(item => {
            const p = item.peca;
            const venda = parseFloat(item.valor_unitario_final || 0);
            let custo = parseFloat(p.valor_liquido_fornecedor || 0);

            // Fallback: If stored cost is 0, calculate based on supplier default commission
            if (custo === 0 && p.fornecedor) {
                const comissaoPadrao = parseFloat(p.fornecedor.comissao_padrao || 50);
                custo = (venda * comissaoPadrao) / 100;
            }

            const comissao = custo; // Supplier Payout
            const pct = venda > 0 ? (comissao / venda) * 100 : 0;

            return {
                data: new Date(item.pedido.data_pedido).toLocaleDateString('pt-BR'),
                id: item.pedido.id,
                vendedor: p.fornecedor ? p.fornecedor.nome : 'LOJA PRÓPRIA',
                venda,
                base: venda,
                desc: parseFloat(item.desconto || 0),
                outros: 0,
                comissao,
                pct
            };
        });
    }
    async getVendasRepasse(inicio, fim, fornecedorId) {
        const whereBase = {};
        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereBase.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const wherePeca = {};
        if (fornecedorId && fornecedorId !== 'todos') {
            wherePeca.fornecedorId = fornecedorId;
        }

        const includeOptions = [
            {
                model: Peca,
                as: 'peca',
                where: wherePeca,
                include: [
                    { model: Pessoa, as: 'fornecedor', attributes: ['nome'] },
                    { model: Marca, as: 'marca', attributes: ['nome'] }
                ]
            },
            {
                model: Pedido,
                as: 'pedido',
                where: whereBase,
                attributes: ['id', 'data_pedido', 'status'],
                include: [
                    { model: Pessoa, as: 'cliente', attributes: ['nome'] },
                    { model: PagamentoPedido, as: 'pagamentos', attributes: ['metodo'] }
                ]
            }
        ];

        // Fetch Sales
        const salesItems = await ItemPedido.findAll({
            include: includeOptions.map(inc => {
                if (inc.as === 'pedido') {
                    return { ...inc, where: { ...inc.where, status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] } } };
                }
                return inc;
            }),
            order: [[Sequelize.col('pedido.data_pedido'), 'DESC']]
        });

        // Fetch Returns
        const returnItems = await ItemPedido.findAll({
            include: includeOptions.map(inc => {
                if (inc.as === 'pedido') {
                    return { ...inc, where: { ...inc.where, status: 'DEVOLVIDO' } };
                }
                return inc;
            }),
            order: [[Sequelize.col('pedido.data_pedido'), 'DESC']]
        });

        const mapItem = (item) => {
            const p = item.peca;
            const ped = item.pedido;
            const valor = parseFloat(item.valor_unitario_final || 0);
            const loja = parseFloat(p.valor_comissao_loja || 0);
            const custo = parseFloat(p.valor_liquido_fornecedor || 0);
            const comissaoPct = valor > 0 ? Math.round((loja / valor) * 100) : 0;
            const pagamentos = ped.pagamentos ? ped.pagamentos.map(pg => pg.metodo) : [];

            return {
                data: new Date(ped.data_pedido).toLocaleDateString('pt-BR'),
                venda: ped.id,
                idPeca: p.codigo_etiqueta || p.id,
                peca: p.descricao_curta,
                marca: p.marca ? p.marca.nome : '-',
                fornecedor: p.fornecedor ? p.fornecedor.nome : 'LOJA PRÓPRIA',
                cliente: ped.cliente ? ped.cliente.nome : 'CLIENTE FINAL',
                valor,
                f1: pagamentos[0] || '-',
                f2: pagamentos[1] || '-',
                comissao: comissaoPct,
                repasse: custo
            };
        };

        return {
            vendas: salesItems.map(mapItem),
            devolucoes: returnItems.map(mapItem)
        };
    }
    async getGradeEstoque(filters = {}) {
        const whereClause = {
            status: { [Op.in]: ['DISPONIVEL', 'NOVA', 'EM_AUTORIZACAO'] }
        };

        if (filters.fornecedorId && filters.fornecedorId !== 'todos') {
            whereClause.fornecedorId = filters.fornecedorId;
        }
        if (filters.marcaId && filters.marcaId !== 'todas') {
            whereClause.marcaId = filters.marcaId;
        }
        if (filters.precoMin) {
            whereClause.preco_venda = { ...whereClause.preco_venda, [Op.gte]: parseFloat(filters.precoMin) };
        }
        if (filters.precoMax) {
            whereClause.preco_venda = { ...whereClause.preco_venda, [Op.lte]: parseFloat(filters.precoMax) };
        }

        const pecas = await Peca.findAll({
            where: whereClause,
            include: [
                { model: Categoria, as: 'categoria', attributes: ['nome'] },
                { model: Tamanho, as: 'tamanho', attributes: ['nome'] }
            ],
            attributes: ['id']
        });

        // Build Matrix
        const matrix = {};
        const sizesSet = new Set();

        pecas.forEach(p => {
            const cat = p.categoria ? p.categoria.nome : 'SEM CATEGORIA';
            const tam = p.tamanho ? p.tamanho.nome : 'UN';

            sizesSet.add(tam);

            if (!matrix[cat]) matrix[cat] = {};
            if (!matrix[cat][tam]) matrix[cat][tam] = 0;
            matrix[cat][tam]++;
        });

        // Sort sizes (custom logic might be needed for S, M, L vs 38, 40, 42)
        const sortedSizes = Array.from(sizesSet).sort((a, b) => {
            // Try to sort numbers
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;

            // Sort standard sizes
            const order = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'UN'];
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;

            return a.localeCompare(b);
        });

        const result = Object.keys(matrix).map(cat => {
            const values = sortedSizes.map(size => matrix[cat][size] || 0);
            return { category: cat, values };
        });

        return { sizes: sortedSizes, matrix: result };
    }

    async getVendasPorTamanho(inicio, fim, categoriaId) {
        const whereClause = {
            status: { [Op.in]: ['PAGO', 'SEPARACAO', 'ENVIADO', 'ENTREGUE'] }
        };

        if (inicio && fim) {
            const startDate = startOfDay(new Date(inicio));
            const endDate = endOfDay(new Date(fim));
            whereClause.data_pedido = { [Op.between]: [startDate, endDate] };
        }

        const wherePeca = {};
        if (categoriaId && categoriaId !== 'all') {
            // Assuming we can filter by category name or ID. Let's assume ID for now or join.
            // If the frontend sends 'letras'/'numeros', we might need logic here.
            // For now, let's support direct Category ID filtering if passed, or ignore if 'all'.
            // If 'letras'/'numeros' is passed, we'd need to filter by size name pattern, which is complex in SQL.
            // Let's stick to simple Category ID filter if provided, otherwise all.
        }

        const vendas = await ItemPedido.findAll({
            attributes: [
                [Sequelize.col('peca.tamanho.nome'), 'tamanho'],
                [Sequelize.fn('COUNT', Sequelize.col('ItemPedido.id')), 'qtd'],
                [Sequelize.fn('SUM', Sequelize.col('valor_unitario_final')), 'valor']
            ],
            include: [
                {
                    model: Peca,
                    as: 'peca',
                    attributes: [],
                    where: wherePeca,
                    include: [{ model: Tamanho, as: 'tamanho', attributes: [] }]
                },
                {
                    model: Pedido,
                    as: 'pedido',
                    attributes: [],
                    where: whereClause
                }
            ],
            group: [Sequelize.col('peca.tamanho.nome')],
            raw: true,
            order: [[Sequelize.literal('qtd'), 'DESC']]
        });

        return vendas.map(v => {
            const qtd = parseInt(v.qtd || 0);
            const valor = parseFloat(v.valor || 0);
            const ticket = qtd > 0 ? valor / qtd : 0;

            // Determine category type based on size name for frontend filtering
            let category = 'unico';
            const size = v.tamanho || 'UN';
            if (['PP', 'P', 'M', 'G', 'GG', 'XG'].includes(size)) category = 'letras';
            else if (!isNaN(parseInt(size))) category = 'numeros';

            return {
                size,
                qtd,
                valor,
                ticket,
                category
            };
        });
    }

    async getPecasPorFornecedor(fornecedorId, filters = {}) {
        const whereClause = {
            fornecedorId
        };

        if (filters.dataEntrada) {
            whereClause.data_entrada = { [Op.gte]: startOfDay(new Date(filters.dataEntrada)) };
        }

        const pecas = await Peca.findAll({
            where: whereClause,
            include: [
                { model: Categoria, as: 'categoria', attributes: ['nome'] },
                { model: Marca, as: 'marca', attributes: ['nome'] },
                { model: Tamanho, as: 'tamanho', attributes: ['nome'] },
                { model: Cor, as: 'cor', attributes: ['nome'] }
            ],
            order: [['data_entrada', 'DESC']]
        });

        return pecas.map(p => ({
            id: p.id,
            codigo: p.codigo_etiqueta || p.id,
            descricao: p.descricao_curta,
            categoria: p.categoria ? p.categoria.nome : '-',
            marca: p.marca ? p.marca.nome : '-',
            tamanho: p.tamanho ? p.tamanho.nome : '-',
            cor: p.cor ? p.cor.nome : '-',
            preco: parseFloat(p.preco_venda || 0),
            custo: parseFloat(p.valor_liquido_fornecedor || 0),
            status: p.status,
            dataEntrada: p.data_entrada ? new Date(p.data_entrada).toLocaleDateString('pt-BR') : '-'
        }));
    }

}

module.exports = new RelatoriosService();
