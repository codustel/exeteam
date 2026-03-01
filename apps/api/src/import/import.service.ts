import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { StartImportDto } from './dto/start-import.dto';
import { SaveTemplateDto } from './dto/save-template.dto';
import { ListImportsDto } from './dto/list-imports.dto';

@Injectable()
export class ImportService {
  private readonly supabase;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('import') private readonly importQueue: Queue,
  ) {
    this.supabase = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  // ────────────────────────────────────────────────────────────
  // File handling
  // ────────────────────────────────────────────────────────────

  async uploadFile(file: Express.Multer.File): Promise<{ fileUrl: string; fileName: string }> {
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Fichier trop volumineux (max 10 MB)');
    }
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Seuls les fichiers .xlsx et .xls sont acceptés');
    }

    const ext = file.originalname.split('.').pop() ?? 'xlsx';
    const path = `imports/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await this.supabase.storage
      .from('imports')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (error) throw new BadRequestException(`Erreur upload: ${error.message}`);

    const { data } = this.supabase.storage.from('imports').getPublicUrl(path);
    return { fileUrl: data.publicUrl, fileName: file.originalname };
  }

  async parseHeaders(fileUrl: string): Promise<string[]> {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new BadRequestException('Impossible de télécharger le fichier');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer: any = Buffer.from(await response.arrayBuffer());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Le fichier Excel est vide');

    const firstRow = sheet.getRow(1);
    const headers: string[] = [];
    firstRow.eachCell((cell) => {
      const val = cell.value?.toString().trim();
      if (val) headers.push(val);
    });
    return headers;
  }

  // ────────────────────────────────────────────────────────────
  // Jobs
  // ────────────────────────────────────────────────────────────

  async startImport(dto: StartImportDto, userId: string) {
    const job = await this.prisma.importJob.create({
      data: {
        entityType: dto.entityType,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        mappings: dto.mappings,
        onDuplicate: dto.onDuplicate,
        templateId: dto.templateId ?? null,
        createdById: userId,
        status: 'pending',
      },
    });

    await this.importQueue.add(
      'process',
      { jobId: job.id },
      { attempts: 2, backoff: { type: 'exponential', delay: 3000 } },
    );

    return { jobId: job.id };
  }

  async getJob(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      include: { template: { select: { id: true, name: true } } },
    });
    if (!job) throw new NotFoundException(`ImportJob ${id} not found`);
    return job;
  }

  async listJobs(dto: ListImportsDto) {
    const { page, limit, entityType, status } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (entityType) where['entityType'] = entityType;
    if (status) where['status'] = status;

    const [data, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { template: { select: { id: true, name: true } } },
      }),
      this.prisma.importJob.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ────────────────────────────────────────────────────────────
  // Templates
  // ────────────────────────────────────────────────────────────

  async saveTemplate(dto: SaveTemplateDto, userId: string) {
    return this.prisma.importTemplate.create({
      data: {
        name: dto.name,
        entityType: dto.entityType,
        mappings: dto.mappings,
        createdById: userId,
      },
    });
  }

  async listTemplates(entityType?: string) {
    return this.prisma.importTemplate.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTemplate(id: string) {
    const tpl = await this.prisma.importTemplate.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException(`ImportTemplate ${id} not found`);
    await this.prisma.importTemplate.delete({ where: { id } });
    return { success: true };
  }
}
