const express = require('express');
const router = express.Router();
const financeiroController = require('./financeiro.controller');
const authMiddleware = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/extrato/:pessoaId', financeiroController.getExtrato);
router.get('/repasses', financeiroController.getRepasses);
router.post('/repasses/pagar', financeiroController.pagarRepasse);
router.get('/dre', financeiroController.getDRE);
router.get('/recebiveis', financeiroController.getRecebiveis);
router.post('/transacoes', financeiroController.createTransacao);
router.get('/transacoes', financeiroController.getTransacoes);
router.get('/contas', financeiroController.getContas);
router.get('/fechamentos', financeiroController.getFechamentos);
router.get('/extrato-pessoa/:pessoaId', financeiroController.getExtratoPessoa);
router.get('/saldos-pessoas', financeiroController.getSaldosPessoas);
router.get('/entradas-saidas', financeiroController.getEntradasSaidas);

module.exports = router;
