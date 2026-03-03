require('dotenv').config();
const whatsappProvider = require('./src/providers/whatsapp.provider');

async function testMessage() {
    const telefone = '71982862912';
    const mensagem = 'Olá, este é um teste real do sistema TipTag. Suas vendas de Fevereiro geraram R$ 100.00 em créditos! Válido até 31/03/2026.';

    console.log(`Iniciando teste de disparo para: ${telefone}`);
    
    try {
        const response = await whatsappProvider.enviarTexto(telefone, mensagem);
        console.log('Resposta do Provedor:', JSON.stringify(response, null, 2));
        
        if (response && (response.messageId || response.success)) {
            console.log('SUCESSO: Mensagem enviada com sucesso!');
        } else {
            console.log('FALHA: O provedor não retornou um ID de mensagem de sucesso.');
        }
    } catch (error) {
        console.error('ERRO ao enviar mensagem:', error.message);
    }
}

testMessage();
