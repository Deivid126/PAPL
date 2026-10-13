import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Filtro global de erros: garante um formato consistente de resposta
 * e evita vazamento de detalhes internos (stack traces, etc.).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno do servidor.';
    let errors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { message?: unknown; error?: string; errors?: unknown };
        if (Array.isArray(b.message)) {
          message = 'Verifique os dados informados.';
          errors = b.message;
        } else {
          message = String(b.message ?? b.error ?? message);
        }
        if (Array.isArray(b.errors)) {
          errors = b.errors;
        }
      }
    }

    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error('[PAPL] Erro não tratado:', exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  }
}