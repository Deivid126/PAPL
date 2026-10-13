import { Module } from '@nestjs/common';
import { ChildrenModule } from '../children/children.module';
import { ProtocolModule } from '../protocol/protocol.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [ChildrenModule, ProtocolModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}