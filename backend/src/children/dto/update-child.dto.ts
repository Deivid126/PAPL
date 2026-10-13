import {
  IsDateString,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateChildDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'O nome da criança deve ter pelo menos 2 caracteres.' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Informe uma data de nascimento válida.' })
  birthDate?: string;

  @IsOptional()
  @IsIn(['F', 'M', 'NÃO_INFORMADO'], { message: 'Sexo inválido.' })
  sex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  school?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  doesNotRead?: boolean;
}