import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../auth/auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Query('q') query: string) {
    if (!query || query.length < 2) {
      return { clients: [], projects: [], tasks: [], employees: [], sites: [] };
    }
    return this.searchService.search(query);
  }
}
