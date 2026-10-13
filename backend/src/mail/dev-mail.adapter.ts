import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailAdapter, MailInput } from './mail-adapter.interface';

@Injectable()
export class DevMailAdapter implements MailAdapter {
  private readonly logger = new Logger(DevMailAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(input: MailInput): Promise<void> {
    await this.prisma.mailLog.create({
      data: {
        to: input.to,
        subject: input.subject,
        body: input.body,
        type: input.type,
      },
    });

    // Em modo de desenvolvimento o e-mail é impresso no terminal.
    this.logger.log('────────────────────────────────────────────────────');
    this.logger.log(`[DEV MAIL] Para: ${input.to}`);
    this.logger.log(`[DEV MAIL] Assunto: ${input.subject}`);
    this.logger.log(`[DEV MAIL] Tipo: ${input.type}`);
    this.logger.log(`[DEV MAIL] Conteúdo:\n${input.body}`);
    this.logger.log('────────────────────────────────────────────────────');
  }
}