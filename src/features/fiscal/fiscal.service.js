const axios = require('axios');
const { Pedido, Peca, Pessoa } = require('../../models');

class FiscalService {
    constructor() {
        this.token = process.env.FOCUS_API_TOKEN;
        this.ambiente = process.env.FOCUS_AMBIENTE || 'homologacao';
        this.baseUrl = this.ambiente === 'producao'
            ? 'https://api.focusnfe.com.br/v2'
            : 'https://homologacao.focusnfe.com.br/v2';
    }

    async emitirNFCe(pedidoId) {
        if (!this.token) throw new Error('FOCUS_API_TOKEN not configured');

        const pedido = await Pedido.findByPk(pedidoId, {
            include: [
                { model: Peca, as: 'itens' }, // Assuming association is defined or via ItemPedido
                { model: Pessoa, as: 'cliente' }
            ]
        });

        if (!pedido) throw new Error('Pedido not found');
        if (pedido.status_fiscal === 'EMITIDA') throw new Error('Nota já emitida');

        // Prepare Payload
        const payload = {
            natureza_operacao: 'Venda ao Consumidor',
            data_emissao: new Date().toISOString(),
            tipo_documento: 1, // 1 = Saída
            finalidade_emissao: 1, // 1 = Normal
            presenca_comprador: 1, // 1 = Presencial
            cnpj_emitente: process.env.CNPJ_EMITENTE,
            nome_destinatario: pedido.cliente ? pedido.cliente.nome : 'Consumidor Final',
            cpf_destinatario: pedido.cliente ? pedido.cliente.cpf_cnpj : null,
            items: pedido.itens.map((item, index) => ({
                numero_item: index + 1,
                codigo_produto: item.codigo_etiqueta,
                descricao: item.descricao || 'Vestuário',
                codigo_ncm: '62044200', // Example NCM for clothes, should be in Peca model
                valor_unitario: item.ItemPedido.valor_unitario_final, // Need to fetch from join table
                quantidade: 1,
                unidade_comercial: 'UN',
                valor_bruto: item.ItemPedido.valor_unitario_final,
                icms_origem: 0,
                icms_situacao_tributaria: '102', // Simples Nacional
                pis_situacao_tributaria: '07',
                cofins_situacao_tributaria: '07'
            })),
            formas_pagamento: [
                {
                    forma_pagamento: '01', // Dinheiro (Simplified, should map from PagamentoPedido)
                    valor_pagamento: pedido.total
                }
            ]
        };

        try {
            const response = await axios.post(`${this.baseUrl}/nfce?ref=${pedido.codigo_pedido}`, payload, {
                auth: { username: this.token, password: '' }
            });

            // Update Order with Fiscal Data
            // Assuming we have columns for this or store in JSON
            // For now, let's assume we update status and log
            await pedido.update({
                status_fiscal: 'EMITIDA', // or PROCESSANDO
                chave_nfe: response.data.chave_nfe,
                url_xml: response.data.caminho_xml_nota_fiscal,
                url_pdf: response.data.caminho_danfe
            });

            return response.data;

        } catch (err) {
            console.error('Fiscal Error:', err.response ? err.response.data : err.message);
            throw new Error(`Erro ao emitir NFCe: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
        }
    }
}

module.exports = new FiscalService();
