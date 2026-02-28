import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CustomFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  required: boolean;
  options?: string[];
  showInList: boolean;
  order: number;
}

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  // Get the merged custom field config for a client (project inherits client fields + adds its own)
  async getConfig(clientId: string, projectId?: string): Promise<CustomFieldConfig[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId, deletedAt: null },
      select: { customFieldsConfig: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const clientFields = (client.customFieldsConfig as CustomFieldConfig[] | null) ?? [];

    if (!projectId) {
      return clientFields.sort((a, b) => a.order - b.order);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId, deletedAt: null },
      select: { customFieldsConfig: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const projectFields = (project.customFieldsConfig as CustomFieldConfig[] | null) ?? [];

    // Merge: project fields override client fields with same key
    const merged = new Map<string, CustomFieldConfig>();
    for (const f of clientFields) merged.set(f.key, f);
    for (const f of projectFields) merged.set(f.key, f);

    return Array.from(merged.values()).sort((a, b) => a.order - b.order);
  }

  async updateClientConfig(clientId: string, config: CustomFieldConfig[]) {
    this.validateConfig(config);
    const client = await this.prisma.client.findUnique({ where: { id: clientId, deletedAt: null } });
    if (!client) throw new NotFoundException('Client not found');
    return this.prisma.client.update({
      where: { id: clientId },
      data: { customFieldsConfig: config as any },
      select: { id: true, customFieldsConfig: true },
    });
  }

  async updateProjectConfig(projectId: string, config: CustomFieldConfig[]) {
    this.validateConfig(config);
    const project = await this.prisma.project.findUnique({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.project.update({
      where: { id: projectId },
      data: { customFieldsConfig: config as any },
      select: { id: true, customFieldsConfig: true },
    });
  }

  async updateSiteData(siteId: string, data: Record<string, unknown>) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId, deletedAt: null } });
    if (!site) throw new NotFoundException('Site not found');
    return this.prisma.site.update({
      where: { id: siteId },
      data: { customFieldsData: data as any },
      select: { id: true, customFieldsData: true },
    });
  }

  async updateTaskData(taskId: string, data: Record<string, unknown>) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.task.update({
      where: { id: taskId },
      data: { customFieldsData: data as any },
      select: { id: true, customFieldsData: true },
    });
  }

  private validateConfig(config: CustomFieldConfig[]) {
    const keys = config.map((f) => f.key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      throw new BadRequestException('Duplicate field keys in config');
    }
    for (const field of config) {
      if (!/^[a-z][a-z0-9_]*$/.test(field.key)) {
        throw new BadRequestException(`Invalid key format: "${field.key}". Must be snake_case.`);
      }
      if (['select', 'multiselect'].includes(field.type) && (!field.options || field.options.length === 0)) {
        throw new BadRequestException(`Field "${field.key}" of type ${field.type} requires options.`);
      }
    }
  }
}
