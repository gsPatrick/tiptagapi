const automacaoService = require('./automacao.service');

class AutomacaoController {
    async testBot(req, res) {
        try {
            const telefones = ['5519996481515', '5571982862912'];
            const results = [];

            for (const tel of telefones) {
                // 1. POS_VENDA (Beautiful Format)
                const msgPosVenda = await automacaoService.agendarMensagem({
                    telefone: tel,
                    canal: 'WHATSAPP',
                    gatilho: 'POS_VENDA',
                    variaveis: {
                        NOME: 'CLIENTE TESTE',
                        VALOR: '95.00',
                        MES_ANTERIOR: 'Março',
                        DATA_VALIDADE: '30/04/2026'
                    },
                    // Fallback beautiful message
                    mensagem: `Olá CLIENTE TESTE! 💖\nQue alegria ter você por aqui!\n\nAqui está o resumo das suas comprinhas:\n👗 CASACO CINZA - R$ 95.00\n\n💰 Total: R$ 95.00\n\nObrigado por garimpar com a gente! ♻️`
                });
                results.push({ tel, type: 'POS_VENDA', id: msgPosVenda?.id });

                // 2. CREDITO_LIBERADO
                const msgLiberado = await automacaoService.agendarMensagem({
                    telefone: tel,
                    canal: 'WHATSAPP',
                    gatilho: 'CREDITO_LIBERADO',
                    variaveis: {
                        NOME: 'FORNECEDOR TESTE',
                        VALOR: '47.50'
                    },
                    mensagem: `Olá FORNECEDOR TESTE! 🎉 Seus créditos de R$ 47.50 foram liberados e já estão disponíveis para uso na loja Garimpô Nós. Venha aproveitar!`
                });
                results.push({ tel, type: 'CREDITO_LIBERADO', id: msgLiberado?.id });

                // 3. LEMBRETE_EXPIRACAO
                const msgExpiracao = await automacaoService.agendarMensagem({
                    telefone: tel,
                    canal: 'WHATSAPP',
                    gatilho: 'LEMBRETE_EXPIRACAO',
                    variaveis: {
                        NOME: 'CLIENTE TESTE',
                        VALOR: '150.00'
                    },
                    mensagem: `Olá CLIENTE TESTE, você ainda tem R$ 150.00 em créditos que vencem HOJE! Venha usar na loja antes que expirem.`
                });
                results.push({ tel, type: 'LEMBRETE_EXPIRACAO', id: msgExpiracao?.id });

                // 4. LEMBRETE_CREDITO_MEIO_MES
                const msgMeioMes = await automacaoService.agendarMensagem({
                    telefone: tel,
                    canal: 'WHATSAPP',
                    gatilho: 'LEMBRETE_CREDITO_MEIO_MES',
                    variaveis: {
                        NOME: 'CLIENTE TESTE',
                        VALOR: '200.00'
                    },
                    mensagem: `Olá CLIENTE TESTE! Lembrete: você possui R$ 200.00 em créditos disponíveis na Garimpô Nós. Use antes do vencimento!`
                });
                results.push({ tel, type: 'LEMBRETE_CREDITO_MEIO_MES', id: msgMeioMes?.id });
            }

            // Trigger queue processing immediately for the test
            await automacaoService.processarFila();

            return res.json({ 
                message: 'Mensagens de teste agendadas e processamento de fila iniciado.',
                results 
            });
        } catch (err) {
            console.error('Error in testBot:', err);
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new AutomacaoController();
