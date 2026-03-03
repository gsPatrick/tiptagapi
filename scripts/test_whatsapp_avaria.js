require('dotenv').config();
const whatsappProvider = require('../src/providers/whatsapp.provider');

async function testWhatsApp() {
    const telefone = '71982862912';
    const mensagem = 'Teste de envio de mensagem de avaria (ou qualquer outra automação) do sistema TipTag. ♻️✨';

    console.log(`Enviando mensagem de teste para ${telefone}...`);
    try {
        const result = await whatsappProvider.enviarTexto(telefone, mensagem);
        console.log('Resultado do envio:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Erro ao enviar:', err.message);
    }
}

testWhatsApp().then(() => process.exit(0));
