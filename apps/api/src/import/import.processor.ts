import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { getRowSchema, EntityType } from './helpers/row-validators';
import { isFuzzyMatch } from './helpers/levenshtein';
import type { ImportError } from '@exeteam/shared';

interface ImportJobData {
  jobId: string;
}

@Processor('import')
export class ImportProcessor {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('process')
  async handleImport(bullJob: Job<ImportJobData>) {
    const { jobId } = bullJob.data;
    this.logger.log(`Processing import job ${jobId}`);

    // Fetch job record
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) {
      this.logger.error(`ImportJob ${jobId} not found`);
      return;
    }

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    try {
      // Download file
      const response = await fetch(job.fileUrl);
      if (!response.ok) throw new Error(`Cannot download file: ${response.statusText}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Parse workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('Empty workbook');

      // Read headers from row 1
      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell) => headers.push(cell.value?.toString().trim() ?? ''));

      // Gather data rows (rows 2..N)
      const dataRows: Record<string, unknown>[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj: Record<string, unknown> = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) obj[header] = cell.value ?? null;
        });
        dataRows.push(obj);
      });

      const totalRows = dataRows.length;
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { totalRows },
      });

      const mappings = job.mappings as Record<string, string>;
      const onDuplicate = job.onDuplicate as 'skip' | 'update';
      const entityType = job.entityType as EntityType;
      const schema = getRowSchema(entityType);

      const errors: ImportError[] = [];
      let processedRows = 0;
      let errorRows = 0;

      // Pre-load data needed for fuzzy/duplicate checks
      const allEmployees =
        entityType === 'employees'
          ? await this.prisma.employee.findMany({
              select: { id: true, firstName: true, lastName: true, professionalEmail: true },
            })
          : [];

      for (let i = 0; i < dataRows.length; i++) {
        const excelRow = dataRows[i];
        const rowNumber = i + 2; // Excel row number (1=header)

        // Map columns to DB fields
        const mapped: Record<string, unknown> = {};
        for (const [excelCol, dbField] of Object.entries(mappings)) {
          mapped[dbField] = excelRow[excelCol] ?? null;
        }

        // Validate with Zod
        const parsed = schema.safeParse(mapped);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            errors.push({
              row: rowNumber,
              field: issue.path.join('.'),
              message: issue.message,
            });
          }
          errorRows++;
          processedRows++;
          continue;
        }

        const data = parsed.data;

        try {
          await this.upsertRow(entityType, data as Record<string, unknown>, onDuplicate, allEmployees);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ row: rowNumber, field: '', message: msg });
          errorRows++;
        }

        processedRows++;

        // Persist progress every 50 rows
        if (processedRows % 50 === 0) {
          await this.prisma.importJob.update({
            where: { id: jobId },
            data: { processedRows, errorRows, errors },
          });
        }
      }

      // Final update
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          processedRows,
          errorRows,
          totalRows,
          errors,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Job ${jobId} done: ${processedRows} rows, ${errorRows} errors`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${jobId} failed: ${msg}`);
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errors: [{ row: 0, field: '', message: msg }],
          completedAt: new Date(),
        },
      });
    }
  }

  // ────────────────────────────────────────────────────────────
  // Per-entity upsert logic
  // ────────────────────────────────────────────────────────────

  private async upsertRow(
    entityType: EntityType,
    data: Record<string, unknown>,
    onDuplicate: 'skip' | 'update',
    allEmployees: { id: string; firstName: string; lastName: string; professionalEmail: string | null }[],
  ): Promise<void> {
    switch (entityType) {
      case 'clients':
        return this.upsertClient(data, onDuplicate);
      case 'employees':
        return this.upsertEmployee(data, onDuplicate, allEmployees);
      case 'sites':
        return this.upsertSite(data, onDuplicate);
      case 'tasks':
        return this.upsertTask(data, onDuplicate);
      case 'purchase-invoices':
        return this.upsertPurchaseInvoice(data, onDuplicate);
    }
  }

  private async upsertClient(data: Record<string, unknown>, onDuplicate: 'skip' | 'update') {
    const siret = data['siret'] as string | undefined;
    const existing = siret
      ? await this.prisma.client.findFirst({ where: { siret } })
      : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.client.update({ where: { id: existing.id }, data });
      }
      return;
    }
    await this.prisma.client.create({ data: data as Parameters<typeof this.prisma.client.create>[0]['data'] });
  }

  private async upsertEmployee(
    data: Record<string, unknown>,
    onDuplicate: 'skip' | 'update',
    allEmployees: { id: string; firstName: string; lastName: string; professionalEmail: string | null }[],
  ) {
    const email = (data['professionalEmail'] as string | undefined)?.toLowerCase();

    // Exact duplicate check by email
    const existing = email
      ? await this.prisma.employee.findFirst({ where: { professionalEmail: email } })
      : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.employee.update({ where: { id: existing.id }, data });
      }
      return;
    }

    // Fuzzy match by full name to warn/skip accidental near-duplicates
    const fullName = `${data['firstName'] ?? ''} ${data['lastName'] ?? ''}`.trim();
    const fuzzyMatch = allEmployees.find((e) =>
      isFuzzyMatch(`${e.firstName} ${e.lastName}`, fullName),
    );
    if (fuzzyMatch && onDuplicate === 'skip') {
      throw new Error(
        `Doublon potentiel (nom similaire): "${fuzzyMatch.firstName} ${fuzzyMatch.lastName}"`,
      );
    }

    await this.prisma.employee.create({ data: data as Parameters<typeof this.prisma.employee.create>[0]['data'] });
  }

  private async upsertSite(data: Record<string, unknown>, onDuplicate: 'skip' | 'update') {
    const address = data['address'] as string | undefined;
    const clientId = data['clientId'] as string | undefined;

    const existing =
      address && clientId
        ? await this.prisma.site.findFirst({ where: { address, clientId } })
        : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.site.update({ where: { id: existing.id }, data });
      }
      return;
    }

    // Generate reference
    const count = await this.prisma.site.count();
    const reference = `SITE-${String(count + 1).padStart(5, '0')}`;
    await this.prisma.site.create({
      data: { ...(data as Parameters<typeof this.prisma.site.create>[0]['data']), reference },
    });
  }

  private async upsertTask(data: Record<string, unknown>, onDuplicate: 'skip' | 'update') {
    const title = data['title'] as string | undefined;
    const projectId = data['projectId'] as string | undefined;

    const existing =
      title && projectId
        ? await this.prisma.task.findFirst({ where: { title, projectId } })
        : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.task.update({ where: { id: existing.id }, data });
      }
      return;
    }

    const count = await this.prisma.task.count();
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const reference = `TASK-${yyyymm}-${String(count + 1).padStart(5, '0')}`;

    await this.prisma.task.create({
      data: { ...(data as Parameters<typeof this.prisma.task.create>[0]['data']), reference },
    });
  }

  private async upsertPurchaseInvoice(data: Record<string, unknown>, onDuplicate: 'skip' | 'update') {
    const reference = data['reference'] as string | undefined;
    const existing = reference
      ? await this.prisma.purchaseInvoice.findFirst({ where: { reference } })
      : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.purchaseInvoice.update({ where: { id: existing.id }, data });
      }
      return;
    }
    await this.prisma.purchaseInvoice.create({
      data: data as Parameters<typeof this.prisma.purchaseInvoice.create>[0]['data'],
    });
  }
}
