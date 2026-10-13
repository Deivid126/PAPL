import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailAdapter, MailInput } from './mail-adapter.interface';
import { DevMailAdapter } from './dev-mail.adapter';
import { SmtpMailAdapter } from './smtp-mail.adapter';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailService {
  private readonly adapter: MailAdapter;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const driver = this.config.get<string>('MAIL_DRIVER') || 'dev';
    if (driver === 'smtp') {
      this.adapter = new SmtpMailAdapter(config);
    } else {
      this.adapter = new DevMailAdapter(prisma);
    }
  }

  async send(input: MailInput): Promise<void> {
    await this.adapter.send(input);
  }

  async listDevEmails(): Promise<
    Array<{ id: string; to: string; subject: string; body: string; type: string; createdAt: Date }>
  > {
    return this.prisma.mailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}