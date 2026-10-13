import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(200)
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString({ message: 'Informe o token.' })
  token: string;

  @ApiProperty({ example: 'NovaSenha@123' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'A senha deve conter letras e números.',
  })
  password: string;

  @ApiProperty({ example: 'NovaSenha@123' })
  @IsString()
  confirmPassword: string;
}