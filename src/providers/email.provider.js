const { Resend } = require('resend');

class EmailProvider {
    constructor() {
        this.apiKey = process.env.RESEND_API_KEY;
        this.resend = this.apiKey ? new Resend(this.apiKey) : null;
        this.from = process.env.EMAIL_REMETENTE_PADRAO || 'onboarding@resend.dev';
    }

    async enviarEmail(destinatario, assunto, htmlBody) {
        if (!this.resend) {
            console.warn('Resend API Key not configured');
            return { error: 'Not configured' };
        }

        try {
            const { data, error } = await this.resend.emails.send({
                from: this.from,
                to: destinatario,
                subject: assunto,
                html: htmlBody,
            });

            if (error) {
                throw new Error(error.message);
            }

            return data;
        } catch (err) {
            console.error('Error sending Email:', err.message);
            throw new Error(`Resend Error: ${err.message}`);
        }
    }
}

module.exports = new EmailProvider();
