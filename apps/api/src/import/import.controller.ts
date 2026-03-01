import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/supabase.strategy';
import { ImportService } from './import.service';
import { StartImportDto } from './dto/start-import.dto';
import { SaveTemplateDto } from './dto/save-template.dto';
import { ListImportsDto } from './dto/list-imports.dto';

@UseGuards(JwtAuthGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  // ── File handling ───────────────────────────────────────────

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    const { fileUrl, fileName } = await this.importService.uploadFile(file);
    const headers = await this.importService.parseHeaders(fileUrl);
    return { fileUrl, fileName, headers };
  }

  @Post('parse-headers')
  async parseHeaders(@Body() body: { fileUrl: string }) {
    const headers = await this.importService.parseHeaders(body.fileUrl);
    return { headers };
  }

  // ── Jobs ────────────────────────────────────────────────────

  @Post('start')
  async start(@Body() dto: StartImportDto, @CurrentUser() user: AuthUser) {
    return this.importService.startImport(dto, user.id);
  }

  @Get('jobs')
  async listJobs(@Query() dto: ListImportsDto) {
    return this.importService.listJobs(dto);
  }

  @Get('jobs/:id')
  async getJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.importService.getJob(id);
  }

  // ── Templates ───────────────────────────────────────────────

  @Get('templates')
  async listTemplates(@Query('entityType') entityType?: string) {
    return this.importService.listTemplates(entityType);
  }

  @Post('templates')
  async saveTemplate(
    @Body() dto: SaveTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.importService.saveTemplate(dto, user.id);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.importService.deleteTemplate(id);
  }
}
