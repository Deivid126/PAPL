import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ListChildrenQueryDto } from './dto/list-children-query.dto';

@Injectable()
export class ChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureOwned(evaluatorId: string, id: string) {
    const child = await this.prisma.child.findUnique({ where: { id } });
    if (!child) {
      throw new NotFoundException('Criança não encontrada.');
    }
    if (child.evaluatorId !== evaluatorId) {
      throw new ForbiddenException('Acesso negado a dados de outro avaliador.');
    }
    return child;
  }

  async create(evaluatorId: string, dto: CreateChildDto) {
    const birthDate = new Date(dto.birthDate);
    if (Number.isNaN(birthDate.getTime())) {
      throw new BadRequestException('Data de nascimento inválida.');
    }
    if (birthDate.getTime() > Date.now()) {
      throw new BadRequestException('A data de nascimento não pode ser no futuro.');
    }

    const ageAtEvaluation = ageInYears(birthDate, new Date());

    const child = await this.prisma.child.create({
      data: {
        evaluatorId,
        name: dto.name.trim(),
        birthDate,
        ageAtEvaluation,
        sex: dto.sex,
        school: dto.school,
        grade: dto.grade,
        notes: dto.notes,
        doesNotRead: dto.doesNotRead ?? false,
      },
    });

    return this.serialize(child);
  }

  async findAll(evaluatorId: string, query: ListChildrenQueryDto) {
    const search = query.search?.trim();
    const status = query.status;
    const sortBy = query.sortBy || 'name';
    const sortOrder = query.sortOrder || 'asc';

    const children = await this.prisma.child.findMany({
      where: {
        evaluatorId,
        ...(search
          ? { name: { contains: search, mode: 'insensitive' } }
          : {}),
      },
      include: {
        _count: { select: { applications: true } },
        applications: {
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalScore: true,
            classification: true,
            startedAt: true,
            completedAt: true,
            currentStep: true,
          },
          take: 1,
        },
      },
    });

    let result = children.map((child) => {
      const last = child.applications[0] ?? null;
      return {
        ...this.serialize(child),
        applicationsCount: child._count.applications,
        lastApplication: last
          ? {
              id: last.id,
              status: last.status,
              totalScore: last.totalScore,
              classification: last.classification,
              startedAt: last.startedAt,
              completedAt: last.completedAt,
              currentStep: last.currentStep,
            }
          : null,
      };
    });

    if (status) {
      result = result.filter((c) => c.lastApplication?.status === status);
    }

    if (sortBy === 'name') {
      result.sort((a, b) =>
        sortOrder === 'asc'
          ? a.name.localeCompare(b.name, 'pt-BR')
          : b.name.localeCompare(a.name, 'pt-BR'),
      );
    } else {
      result.sort((a, b) => {
        const ta = a.lastApplication?.completedAt ?? a.lastApplication?.startedAt ?? null;
        const tb = b.lastApplication?.completedAt ?? b.lastApplication?.startedAt ?? null;
        if (!ta && !tb) return 0;
        if (!ta) return sortOrder === 'asc' ? -1 : 1;
        if (!tb) return sortOrder === 'asc' ? 1 : -1;
        return sortOrder === 'asc'
          ? ta.getTime() - tb.getTime()
          : tb.getTime() - ta.getTime();
      });
    }

    return result;
  }

  async findOne(evaluatorId: string, id: string) {
    await this.ensureOwned(evaluatorId, id);
    const child = await this.prisma.child.findUnique({
      where: { id },
      include: {
        applications: {
          orderBy: { startedAt: 'desc' },
          include: {
            steps: {
              orderBy: { stepNumber: 'asc' },
              select: {
                id: true,
                stepNumber: true,
                skill: true,
                maxScore: true,
                status: true,
                score: true,
                notes: true,
                _count: { select: { items: true } },
              },
            },
          },
        },
      },
    });

    if (!child) {
      throw new NotFoundException('Criança não encontrada.');
    }

    return {
      ...this.serialize(child),
      applications: child.applications.map((app) => ({
        id: app.id,
        status: app.status,
        startedAt: app.startedAt,
        completedAt: app.completedAt,
        currentStep: app.currentStep,
        totalScore: app.totalScore,
        classification: app.classification,
        notes: app.notes,
        steps: app.steps,
      })),
    };
  }

  async update(evaluatorId: string, id: string, dto: UpdateChildDto) {
    await this.findOne(evaluatorId, id);

    const data: Prisma.ChildUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.birthDate !== undefined) {
      const birthDate = new Date(dto.birthDate);
      if (Number.isNaN(birthDate.getTime()) || birthDate.getTime() > Date.now()) {
        throw new BadRequestException('Data de nascimento inválida.');
      }
      data.birthDate = birthDate;
      data.ageAtEvaluation = ageInYears(birthDate, new Date());
    }
    if (dto.sex !== undefined) data.sex = dto.sex;
    if (dto.school !== undefined) data.school = dto.school;
    if (dto.grade !== undefined) data.grade = dto.grade;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.doesNotRead !== undefined) data.doesNotRead = dto.doesNotRead;

    const updated = await this.prisma.child.update({ where: { id }, data });
    return this.serialize(updated);
  }

  async remove(evaluatorId: string, id: string) {
    await this.findOne(evaluatorId, id);
    await this.prisma.child.delete({ where: { id } });
    return { message: 'Criança removida com sucesso.' };
  }

  async history(evaluatorId: string, childId: string) {
    await this.findOne(evaluatorId, childId);
    const applications = await this.prisma.application.findMany({
      where: { childId, evaluatorId },
      orderBy: { startedAt: 'desc' },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: {
            items: { orderBy: { itemNumber: 'asc' } },
          },
        },
      },
    });
    return applications;
  }

  private serialize(child: {
    id: string;
    evaluatorId: string;
    name: string;
    birthDate: Date;
    ageAtEvaluation: number;
    sex: string | null;
    school: string | null;
    grade: string | null;
    notes: string | null;
    doesNotRead: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: child.id,
      evaluatorId: child.evaluatorId,
      name: child.name,
      birthDate: child.birthDate,
      ageAtEvaluation: child.ageAtEvaluation,
      age: ageDescription(child.birthDate),
      sex: child.sex,
      school: child.school,
      grade: child.grade,
      notes: child.notes,
      doesNotRead: child.doesNotRead,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
    };
  }
}

export function ageInYears(birthDate: Date, at: Date): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const m = at.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function ageDescription(birthDate: Date): string {
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
    years--;
  }
  const monthDiff = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
  let months = monthDiff;
  if (now.getDate() < birthDate.getDate()) months--;
  if (months < 0) months = 0;

  if (years > 0) {
    return `${years} ano${years > 1 ? 's' : ''} e ${months} mes${months !== 1 ? 'es' : ''}`;
  }
  return `${months} mes${months !== 1 ? 'es' : ''}`;
}