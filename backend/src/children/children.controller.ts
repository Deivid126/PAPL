import {
  Body,
  Controller,
  Delete,
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
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ListChildrenQueryDto } from './dto/list-children-query.dto';

@ApiTags('Crianças')
@ApiAuthHeaders()
@Controller('children')
export class ChildrenController {
  constructor(private readonly children: ChildrenService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as crianças do avaliador' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListChildrenQueryDto,
  ) {
    return this.children.findAll(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra uma nova criança' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChildDto) {
    return this.children.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes da criança e histórico de aplicações' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.children.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza dados da criança' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.children.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a criança' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.children.remove(user.id, id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Histórico de aplicações da criança' })
  history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.children.history(user.id, id);
  }
}