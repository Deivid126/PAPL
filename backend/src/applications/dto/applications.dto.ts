import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty({ description: 'ID da criança avaliada' })
  @IsString({ message: 'Informe a criança.' })
  childId: string;

  @ApiPropertyOptional({ description: 'Observações iniciais' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class SaveStepItemDto {
  @ApiProperty({ description: 'Número do item na subetapa' })
  @IsInt()
  @Min(1)
  itemNumber: number;

  @ApiPropertyOptional({ description: 'Enunciado apresentado (editável quando pendente)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  prompt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  expectedAnswer?: string | null;

  @ApiPropertyOptional({ description: 'Resposta da criança' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  childAnswer?: string | null;

  @ApiPropertyOptional({ description: 'Acerto ou erro' })
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean | null;

  @ApiPropertyOptional({ description: 'Pontuação do item (0 ou 1 normalmente)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  score?: number;

  @ApiPropertyOptional({ description: 'Tempo de resposta em milissegundos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  responseTimeMs?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateStepDto {
  @ApiPropertyOptional({ enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] })
  @IsOptional()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateApplicationDto {
  @ApiPropertyOptional({ description: 'Etapa atual do avaliador' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  currentStep?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class CompleteApplicationDto {
  @ApiPropertyOptional({
    description:
      'Permite finalizar mesmo com etapas obrigatórias incompletas (confirmação explícita)',
  })
  @IsOptional()
  @IsBoolean()
  confirmIncomplete?: boolean;
}

export class ListApplicationsQueryDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'])
  status?: string;
}