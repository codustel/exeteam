import { Controller, Get, Put, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('custom-fields')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomFieldsController {
  constructor(private customFieldsService: CustomFieldsService) {}

  // GET /custom-fields/config?clientId=X&projectId=Y
  @Get('config')
  @RequirePermissions('custom_fields.read')
  getConfig(
    @Query('clientId') clientId: string,
    @Query('projectId') projectId?: string,
  ): Promise<unknown> {
    return this.customFieldsService.getConfig(clientId, projectId);
  }

  // PUT /custom-fields/clients/:id/config
  @Put('clients/:id/config')
  @RequirePermissions('custom_fields.configure')
  updateClientConfig(
    @Param('id') id: string,
    @Body() config: Record<string, unknown>[],
  ) {
    return this.customFieldsService.updateClientConfig(id, config as any);
  }

  // PUT /custom-fields/projects/:id/config
  @Put('projects/:id/config')
  @RequirePermissions('custom_fields.configure')
  updateProjectConfig(
    @Param('id') id: string,
    @Body() config: Record<string, unknown>[],
  ) {
    return this.customFieldsService.updateProjectConfig(id, config as any);
  }

  // PATCH /custom-fields/sites/:id/data
  @Patch('sites/:id/data')
  @RequirePermissions('custom_fields.update')
  updateSiteData(
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
  ) {
    return this.customFieldsService.updateSiteData(id, data);
  }

  // PATCH /custom-fields/tasks/:id/data
  @Patch('tasks/:id/data')
  @RequirePermissions('custom_fields.update')
  updateTaskData(
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
  ) {
    return this.customFieldsService.updateTaskData(id, data);
  }
}
