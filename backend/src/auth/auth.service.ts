import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  generateOpaqueToken,
  hashToken,
  isExpired,
} from '../common/utils/token.util';
import { sanitizeString } from '../common/utils/sanitize.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/forgot-password.dto';
import { AuthenticatedUser } from '../common/auth/auth-user.interface';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerifiedAt: Date | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private accessSecret() {
    return this.config.get<string>('JWT_ACCESS_SECRET') ?? 'access-secret';
  }

  private refreshSecret() {
    return this.config.get<string>('JWT_REFRESH_SECRET') ?? 'refresh-secret';
  }

  private accessExpiresIn() {
    return Number(this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? 900);
  }

  private refreshExpiresIn() {
    return Number(this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? 604800);
  }

  async register(dto: RegisterDto) {
    const name = sanitizeString(dto.name) ?? '';
    const email = sanitizeString(dto.email)?.toLowerCase() ?? '';
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('A confirmação da senha não confere.');
    }
    if (!dto.acceptTerms) {
      throw new BadRequestException('É necessário aceitar os termos de uso.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Este e-mail já está cadastrado.');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const user = await this.prisma.user.create({
      data: { name, email, passwordHash, emailVerifiedAt: new Date() },
    });

    return {
      message: 'Cadastro realizado com sucesso. Você já pode entrar no sistema.',
    };
  }


  async login(dto: LoginDto) {
    const email = sanitizeString(dto.email)?.toLowerCase() ?? '';
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    const valid = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!valid) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    return this.issueTokens(user);
  }

  async refresh(rawToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(rawToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    const hash = hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!record || record.revokedAt) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    if (isExpired(record.expiresAt) || payload.sub !== record.userId) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(record.user);
  }

  async logout(rawToken: string) {
    const hash = hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Sessão encerrada.' };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessExpiresIn = this.accessExpiresIn();
    const refreshExpiresIn = this.refreshExpiresIn();
    const payload = { sub: user.id, email: user.email, name: user.name };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.accessSecret(),
      expiresIn: accessExpiresIn,
    });
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, tokenType: 'refresh', jti: randomUUID() },
      { secret: this.refreshSecret(), expiresIn: refreshExpiresIn },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshExpiresIn * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresIn,
      refreshExpiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async forgotPassword(email: string) {
    const clean = sanitizeString(email)?.toLowerCase() ?? '';
    const user = await this.prisma.user.findUnique({ where: { email: clean } });
    if (user) {
      const { token, hash } = generateOpaqueToken();
      const ttl = Number(
        this.config.get<string>('PASSWORD_TOKEN_EXPIRES_IN') ?? 3600,
      );
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + ttl * 1000),
        },
      });
      const link = this.buildClientUrl(`/reset-password?token=${token}`);
      await this.mailService.send({
        to: user.email,
        subject: 'Recuperação de senha — PAPL',
        type: 'password-reset',
        body: `Olá, ${user.name}!\n\nPara redefinir sua senha no PAPL, acesse:\n${link}\n\nEste link expira em 1 hora.`,
      });
    }
    return {
      message:
        'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('A confirmação da senha não confere.');
    }
    const hash = hashToken(dto.token);
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!record || record.usedAt) {
      throw new BadRequestException('Token de recuperação inválido.');
    }
    if (isExpired(record.expiresAt)) {
      throw new BadRequestException(
        'Token de recuperação expirado. Solicite um novo.',
      );
    }
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { message: 'Senha redefinida com sucesso.' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }
    return user;
  }

  async updateProfile(
    userId: string,
    data: { name?: string },
  ): Promise<AuthenticatedUser> {
    const name = data.name ? sanitizeString(data.name) : undefined;
    if (name && name.length < 3) {
      throw new BadRequestException('O nome deve ter pelo menos 3 caracteres.');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { ...(name ? { name } : {}) },
      select: { id: true, name: true, email: true },
    });
    return user;
  }

  private buildClientUrl(path: string): string {
    const origin = this.config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
    return `${origin}${path}`;
  }
}