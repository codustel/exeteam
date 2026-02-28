import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  types: string[];
}

@Injectable()
export class PublicHolidaysService {
  private readonly logger = new Logger(PublicHolidaysService.name);
  constructor(private prisma: PrismaService) {}

  async findAll(year: number, country: string = 'FR') {
    return this.prisma.publicHoliday.findMany({ where: { year, country }, orderBy: { date: 'asc' } });
  }

  async syncFromNager(year: number, country: string = 'FR'): Promise<number> {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`;
    this.logger.log(`Fetching public holidays from ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Nager.Date API error: ${response.status} ${response.statusText}`);
    const holidays: NagerHoliday[] = await response.json();
    let upserted = 0;
    for (const holiday of holidays) {
      await this.prisma.publicHoliday.upsert({
        where: { date_country: { date: new Date(holiday.date), country } },
        update: { label: holiday.localName, type: holiday.types[0] ?? 'national', year },
        create: { date: new Date(holiday.date), label: holiday.localName, type: holiday.types[0] ?? 'national', country, year },
      });
      upserted++;
    }
    this.logger.log(`Synced ${upserted} public holidays for ${country} ${year}`);
    return upserted;
  }

  async ensureSync(year: number, country: string = 'FR') {
    const count = await this.prisma.publicHoliday.count({ where: { year, country } });
    if (count === 0) await this.syncFromNager(year, country);
  }
}
