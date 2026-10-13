import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString({ message: 'Informe o nome completo.' })
  @MinLength(3, { message: 'O nome deve ter pelo menos 3 caracteres.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  name: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(200, { message: 'E-mail muito longo.' })
  email: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(128, { message: 'A senha deve ter no máximo 128 caracteres.' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'A senha deve conter letras e números.',
  })
  password: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  confirmPassword: string;

  @ApiProperty({ example: true })
  @IsBoolean({ message: 'Você deve aceitar os termos de uso.' })
  acceptTerms: boolean;
}