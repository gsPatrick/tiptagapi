const { FilaBot, TextoPadrao } = require('../../models');
const whatsappProvider = require('../../providers/whatsapp.provider');
const emailProvider = require('../../providers/email.provider');
const { Op } = require('sequelize');

class AutomacaoService {
    async agendarMensagem(data) {
        // data: { telefone, email, mensagem (fallback), assunto, canal, tipo, gatilho, variaveis }

        let mensagemFinal = data.mensagem;
        let assuntoFinal = data.assunto;

        // 1. Try to resolve template from DB
        if (data.gatilho) {
            const template = await TextoPadrao.findOne({
                where: { gatilho_automacao: data.gatilho }
            });

            if (template) {
                mensagemFinal = template.conteudo;
                if (template.titulo) assuntoFinal = template.titulo; // Use title as subject for emails

                // 2. Substitute Variables
                if (data.variaveis) {
                    for (const [key, value] of Object.entries(data.variaveis)) {
                        // Replace {KEY} with value
                        const regex = new RegExp(`{${key}}`, 'g');
                        mensagemFinal = mensagemFinal.replace(regex, value);
                    }
                }
            }
        }

        // If no message resolved (no template and no fallback), we can't send.
        if (!mensagemFinal) {
            console.warn(`No message content for trigger ${data.gatilho}`);
            return null;
        }

        return await FilaBot.create({
            telefone: data.telefone,
            email: data.email,
            mensagem: mensagemFinal,
            assunto: assuntoFinal,
            canal: data.canal,
            tipo: data.tipo || data.gatilho,
            status: 'PENDENTE',
            data_criacao: new Date(),
        });
    }

    async processarFila() {
        console.log('Processing Message Queue...');

        const messages = await FilaBot.findAll({
            where: { status: 'PENDENTE' },
            limit: 50
        });

        if (messages.length === 0) return;

        const results = await Promise.allSettled(messages.map(async (msg) => {
            try {
                if (msg.canal === 'WHATSAPP') {
                    if (!msg.telefone) throw new Error('Telefone missing for WhatsApp');
                    await whatsappProvider.enviarTexto(msg.telefone, msg.mensagem);
                } else if (msg.canal === 'EMAIL') {
                    if (!msg.email) throw new Error('Email missing for Email channel');
                    await emailProvider.enviarEmail(msg.email, msg.assunto || 'Aviso', msg.mensagem);
                } else {
                    throw new Error(`Unknown channel: ${msg.canal}`);
                }

                await msg.update({
                    status: 'ENVIADO',
                    data_envio: new Date()
                });
                return { id: msg.id, status: 'sent' };

            } catch (err) {
                console.error(`Failed to send message ${msg.id}:`, err.message);
                await msg.update({
                    status: 'ERRO',
                    log_erro: err.message
                });
                throw err;
            }
        }));

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;

        console.log(`Queue processed: ${successCount} sent, ${failCount} failed.`);
        return { successCount, failCount };
    }
}

module.exports = new AutomacaoService();
