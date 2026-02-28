import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/create-quote.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('commercial/quotes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Get()
  @RequirePermissions('commercial.read')
  findAll(@Query() q: any) { return this.quotesService.findAll(q); }

  @Get(':id')
  @RequirePermissions('commercial.read')
  findOne(@Param('id') id: string) { return this.quotesService.findOne(id); }

  @Post()
  @RequirePermissions('commercial.create')
  create(@Body() dto: CreateQuoteDto) { return this.quotesService.create(dto); }

  @Patch(':id')
  @RequirePermissions('commercial.update')
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('commercial.delete')
  remove(@Param('id') id: string) { return this.quotesService.remove(id); }
}
