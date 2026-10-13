import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobStorage,
  LocalBlobStorage,
  createBlobStorage,
} from './blob.service';
import { BlobController } from './blob.controller';

@Global()
@Module({
  providers: [
    LocalBlobStorage,
    {
      provide: BlobStorage,
      useFactory: (config: ConfigService) => createBlobStorage(config),
      inject: [ConfigService],
    },
  ],
  exports: [BlobStorage, LocalBlobStorage],
  controllers: [BlobController],
})
export class BlobModule {}

export { BlobStorage } from './blob.service';