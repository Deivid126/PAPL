import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { DevMailController } from './dev-mail.controller';

@Module({
  providers: [MailService],
  controllers: [DevMailController],
  exports: [MailService],
})
export class MailModule {}