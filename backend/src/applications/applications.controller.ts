import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../common/auth/auth-user.interface';
import { ApiAuthHeaders } from '../auth/auth.swagger';
import { ApplicationsService } from './applications.service';
import {
  CompleteApplicationDto,
  CreateApplicationDto,
  ListApplicationsQueryDto,
  SaveStepItemDto,
  UpdateApplicationDto,
  UpdateStepDto,
} from './dto/applications.dto';

@ApiTags('Aplicações')
@ApiAuthHeaders()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as aplicações do avaliador' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListApplicationsQueryDto,
  ) {
    return this.applicationsService.findAll(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova aplicação (status IN_PROGRESS)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes da aplicação (etapas e itens)' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.applicationsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza etapa atual / observações (autosave)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(user.id, id, dto);
  }

  @Post(':id/steps/:stepNumber/items')
  @ApiOperation({ summary: 'Salva a resposta de um item (autosave)' })
  saveItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('stepNumber') stepNumber: string,
    @Body() dto: SaveStepItemDto,
  ) {
    return this.applicationsService.saveItem(
      user.id,
      id,
      Number(stepNumber),
      dto,
    );
  }

  @Patch(':id/steps/:stepNumber')
  @ApiOperation({ summary: 'Atualiza o status/observações de uma etapa' })
  updateStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('stepNumber') stepNumber: string,
    @Body() dto: UpdateStepDto,
  ) {
    return this.applicationsService.updateStep(
      user.id,
      id,
      Number(stepNumber),
      dto,
    );
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Finaliza a aplicação e calcula pontuações' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteApplicationDto,
  ) {
    return this.applicationsService.complete(user.id, id, dto);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reabre uma aplicação finalizada' })
  reopen(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.applicationsService.reopen(user.id, id);
  }

  @Get(':id/result')
  @ApiOperation({ summary: 'Resultado detalhado da aplicação' })
  result(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.applicationsService.result(user.id, id);
  }
}