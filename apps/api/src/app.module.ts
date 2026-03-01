import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { ClientsModule } from './clients/clients.module';
import { SitesModule } from './sites/sites.module';
import { EmployeesModule } from './employees/employees.module';
import { LeavesModule } from './leaves/leaves.module';
import { PublicHolidaysModule } from './public-holidays/public-holidays.module';
import { CodesProduitsModule } from './codes-produits/codes-produits.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { OperatorsModule } from './operators/operators.module';
import { InterlocuteursModule } from './interlocuteurs/interlocuteurs.module';
import { TagsModule } from './tags/tags.module';
import { DemandsModule } from './demands/demands.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushModule } from './push/push.module';
import { CommercialModule } from './commercial/commercial.module';
import { MessagingModule } from './messaging/messaging.module';
import { AccountingModule } from './accounting/accounting.module';
import { ImportModule } from './import/import.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './modules/search/search.module';
import { RgpdModule } from './modules/rgpd/rgpd.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    TimeEntriesModule,
    ClientsModule,
    SitesModule,
    EmployeesModule,
    LeavesModule,
    PublicHolidaysModule,
    CodesProduitsModule,
    CustomFieldsModule,
    OperatorsModule,
    InterlocuteursModule,
    TagsModule,
    DemandsModule,
    NotificationsModule,
    PushModule,
    CommercialModule,
    MessagingModule,
    AccountingModule,
    ImportModule,
    DashboardModule,
    SearchModule,
    RgpdModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
