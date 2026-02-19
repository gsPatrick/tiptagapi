require('dotenv').config();
const whatsappProvider = require('../src/providers/whatsapp.provider');

async function testFormats() {
    const rawNumber = '71982862912';
    const msg = "Teste de formato WhatsApp - " + new Date().toLocaleTimeString();

    console.log(`--- TESTING WHATSAPP FORMATS FOR ${rawNumber} ---`);

    // 1. Current format (with 9)
    console.log('\n1. Testing with 9 (current logic):');
    try {
        const res1 = await whatsappProvider.enviarTexto(rawNumber, msg + " (COM 9)");
        console.log('Result 1:', res1);
    } catch (e) {
        console.error('Error 1:', e.message);
    }

    // 2. Without 9
    const withoutNine = '7182862912';
    console.log('\n2. Testing without 9:');
    try {
        const res2 = await whatsappProvider.enviarTexto(withoutNine, msg + " (SEM 9)");
        console.log('Result 2:', res2);
    } catch (e) {
        console.error('Error 2:', e.message);
    }
}

testFormats().then(() => process.exit(0));
