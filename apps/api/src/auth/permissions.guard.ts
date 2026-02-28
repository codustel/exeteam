import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import type { AuthUser } from './supabase.strategy';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser;

    // super_admin bypasses all permission checks
    if (user.roleName === 'super_admin') return true;

    const hasAll = required.every((perm) => user.permissions.includes(perm));
    if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
