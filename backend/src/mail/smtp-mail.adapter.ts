import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailAdapter, MailInput } from './mail-adapter.interface';

@Injectable()
export class SmtpMailAdapter implements MailAdapter {
  private readonly logger = new Logger(SmtpMailAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: MailInput): Promise<void> {
    // Import dinâmico para não carregar nodemailer quando não for usado.
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT') || 587),
      secure: Number(this.config.get<string>('SMTP_PORT')) === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    await transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM') || 'PAPL <nao-responder@papl.local>',
      to: input.to,
      subject: input.subject,
      text: input.body,
    });

    this.logger.log(`E-mail enviado para ${input.to}`);
  }
}