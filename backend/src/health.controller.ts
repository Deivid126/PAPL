import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/auth/public.decorator';

@ApiTags('Saúde')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Verifica se a API está no ar' })
  check() {
    return { status: 'ok', service: 'papl-backend', timestamp: new Date().toISOString() };
  }
}