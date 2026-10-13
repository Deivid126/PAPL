import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListChildrenQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'], {
    message: 'Status de aplicação inválido.',
  })
  status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

  @IsOptional()
  @IsIn(['name', 'lastEvaluation'], { message: 'Ordenação inválida.' })
  sortBy?: 'name' | 'lastEvaluation';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Direção de ordenação inválida.' })
  sortOrder?: 'asc' | 'desc';
}