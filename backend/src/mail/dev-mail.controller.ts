import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';

@ApiTags('E-mails (desenvolvimento)')
@Controller('dev')
export class DevMailController {
  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Get('emails')
  @ApiOperation({
    summary: 'Lista e-mails enviados em modo de desenvolvimento (apenas NODE_ENV != production)',
  })
  async listEmails(): Promise<unknown> {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new NotFoundException('Recurso indisponível em produção.');
    }
    return this.mail.listDevEmails();
  }
}