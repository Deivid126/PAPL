import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token (JWT)' })
  @IsString({ message: 'Informe o refresh token.' })
  refreshToken: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'Refresh token a ser revogado' })
  @IsString({ message: 'Informe o refresh token.' })
  refreshToken: string;
}