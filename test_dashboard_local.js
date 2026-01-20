const axios = require('axios');

async function testDashboard() {
  try {
    // A rota base no app.js é /api/v1
    const baseUrl = 'http://localhost:5000/api/v1';

    console.log(`Tentando login em ${baseUrl}/auth/login ...`);
    const loginResponse = await axios.post(`${baseUrl}/auth/login`, {
      email: 'admin@tiptag.com.br',
      password: '123'
    });

    const token = loginResponse.data.token;
    console.log('Login OK, token obtido.');

    console.log(`Chamando ${baseUrl}/dashboard/resumo ...`);
    const dashboardResponse = await axios.get(`${baseUrl}/dashboard/resumo`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Dashboard status:', dashboardResponse.status);
    console.log('Dashboard data:', JSON.stringify(dashboardResponse.data, null, 2));

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
       console.error('Falha na conexão: O servidor não parece estar rodando na porta 5000.');
    } else {
       console.error('Erro no teste:', error.message);
       if (error.response) {
           console.error('Status:', error.response.status);
           console.error('Data:', JSON.stringify(error.response.data, null, 2));
       }
    }
  }
}

testDashboard();
