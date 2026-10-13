import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

export function ApiAuthHeaders() {
  return applyDecorators(ApiBearerAuth());
}