import {
  IsDateString,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateChildDto {
  @IsString()
  @MinLength(2, { message: 'O nome da criança deve ter pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  name: string;

  @IsDateString({}, { message: 'Informe uma data de nascimento válida.' })
  birthDate: string;

  @IsOptional()
  @IsIn(['F', 'M', 'NÃO_INFORMADO'], { message: 'Sexo inválido.' })
  sex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Escola muito longa.' })
  school?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Série muito longa.' })
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Observações muito longas.' })
  notes?: string;

  @IsOptional()
  @IsBoolean()
  doesNotRead?: boolean;
}