import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Não abre a conexão no boot de propósito.
 *
 * O PrismaClient conecta sozinho na primeira query. Em serverless, cada
 * instância fria que subisse o Nest tomaria uma conexão imediatamente —
 * inclusive para rotas que nem consultam o banco, como /health — e o
 * limite do papel usado em produção é baixo. Conectando sob demanda, só
 * as requisições que de fato usam o banco ocupam uma conexão.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
