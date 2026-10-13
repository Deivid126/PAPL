import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiAuthHeaders } from '../auth/auth.swagger';
import { ProtocolService } from './protocol.service';

class ClassificationDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  classification: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  minScore: number;

  @IsInt()
  @Min(0)
  @Max(1000)
  maxScore: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@ApiTags('Protocolo')
@Controller('protocol')
export class ProtocolController {
  constructor(private readonly protocolService: ProtocolService) {}

  @Get('steps')
  @ApiAuthHeaders()
  @ApiOperation({ summary: 'Estrutura do protocolo (etapas, subetapas, itens)' })
  listSteps() {
    return this.protocolService.listSteps();
  }

  @Get('classification')
  @ApiAuthHeaders()
  @ApiOperation({ summary: 'Regras de classificação ativas' })
  classifications() {
    return this.protocolService.getActiveClassifications();
  }

  @Post('classification')
  @ApiAuthHeaders()
  @ApiOperation({ summary: 'Cria/atualiza regra de classificação (admin)' })
  upsertClassification(@Body() dto: ClassificationDto) {
    return this.protocolService.upsertClassification(dto);
  }
}