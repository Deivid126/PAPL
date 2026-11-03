import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Public } from '../common/auth/public.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../common/auth/auth-user.interface';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { LogoutDto, RefreshDto } from './dto/refresh.dto';
import { ApiAuthHeaders } from './auth.swagger';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'O nome deve ter pelo menos 3 caracteres.' })
  @MaxLength(120)
  name?: string;
}


/**
 * Limite por rota, afrouxado só em teste.
 *
 * A suíte faz dezenas de logins em segundos e estourava o limite de produção,
 * fazendo falhar um teste diferente a cada execução — sempre com 429, nunca
 * pelo motivo que o teste investigava. Em produção os valores são os mesmos.
 */
const throttle = (limit: number) => ({
  default: { limit: process.env.NODE_ENV === 'test' ? 100_000 : limit, ttl: 60_000 },
});

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastro de usuário' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }


  @Public()
  @Post('login')
  @Throttle(throttle(8))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login (emite access e refresh token)' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @Throttle(throttle(20))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renova os tokens via refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoga o refresh token' })
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @Throttle(throttle(5))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicita link de recuperação de senha' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @Throttle(throttle(5))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Define nova senha com o token de recuperação' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }


  @Get('me')
  @ApiAuthHeaders()
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @Patch('me')
  @ApiAuthHeaders()
  @ApiOperation({ summary: 'Atualiza o perfil do usuário' })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }
}