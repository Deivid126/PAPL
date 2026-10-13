import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/auth/public.decorator';
import { LocalBlobStorage } from './blob.service';

/**
 * Serve os arquivos do blob storage local (modo desenvolvimento).
 * Em produção com S3/Azure, as URLs públicas apontam para o provedor.
 */
@ApiTags('Blob Storage (local)')
@Controller('storage')
export class BlobController {
  constructor(private readonly local: LocalBlobStorage) {}

  @Public()
  @Get(':key(*)')
  @ApiOperation({ summary: 'Serve um arquivo do storage local' })
  async get(@Param('key') key: string, @Res() res: Response) {
    const served = await this.local.streamToResponse(key, res);
    if (!served) {
      throw new NotFoundException('Arquivo não encontrado.');
    }
  }
}