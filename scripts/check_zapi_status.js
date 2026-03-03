require('dotenv').config();
const axios = require('axios');

async function checkStatus() {
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;

    if (!instanceId || !token) {
        console.error('Credentials missing');
        return;
    }

    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
    const headers = clientToken ? { 'Client-Token': clientToken } : {};

    try {
        const response = await axios.get(url, { headers });
        console.log('Instance Status:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('Error checking status:', err.message);
    }
}

checkStatus().then(() => process.exit(0));
