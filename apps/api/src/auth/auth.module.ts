import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from './supabase.strategy';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [PassportModule],
  providers: [SupabaseStrategy, AuthService, RolesGuard, PermissionsGuard],
  exports: [AuthService, RolesGuard, PermissionsGuard, SupabaseStrategy],
})
export class AuthModule {}
