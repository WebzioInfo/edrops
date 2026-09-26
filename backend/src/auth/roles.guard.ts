import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export function matchPermission(
  userPerm: string,
  requiredPerm: string,
): boolean {
  const u = userPerm.trim().toLowerCase();
  const r = requiredPerm.trim().toLowerCase();

  // Wildcards
  if (u === '*' || u === 'all' || u === 'all:manage') return true;

  // Exact match
  if (u === r) return true;

  // Domain wildcard (e.g. catalog.* or catalog:manage covers all catalog permissions)
  if (
    (u === 'catalog.*' ||
      u === 'catalog.manage' ||
      u === 'catalog:manage' ||
      u === 'catalog') &&
    (r.startsWith('catalog.') || r.startsWith('catalog:'))
  ) {
    return true;
  }

  // Cross-format equivalence between dot-notation and colon-notation
  const map: Record<string, string[]> = {
    'catalog.view': ['catalog:read', 'catalog.read', 'catalog.view'],
    'catalog:read': ['catalog:read', 'catalog.read', 'catalog.view'],
    'catalog.create': ['catalog:create', 'catalog.create'],
    'catalog:create': ['catalog:create', 'catalog.create'],
    'catalog.update': ['catalog:update', 'catalog.update'],
    'catalog:update': ['catalog:update', 'catalog.update'],
    'catalog.delete': ['catalog:delete', 'catalog.delete'],
    'catalog:delete': ['catalog:delete', 'catalog.delete'],
  };

  if (map[r] && map[r].includes(u)) {
    return true;
  }

  return false;
}

export function checkUserPermissions(
  userPermissions: string[] = [],
  requiredPermissions: string[] = [],
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  if (!userPermissions || userPermissions.length === 0) return false;

  return requiredPermissions.some((req) =>
    userPermissions.some((usr) => matchPermission(usr, req)),
  );
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If neither roles nor permissions are required, allow
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Role check
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have the required role to perform this action',
      );
    }

    // If user is ADMIN, they inherently have all permissions
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Permission check for non-admin roles (e.g. STAFF, MANAGER)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions: string[] = Array.isArray(user.permissions)
        ? user.permissions
        : [];

      // Default permissions for STAFF and MANAGER include catalog permissions
      const effectivePermissions = [
        ...userPermissions,
        ...(user.role === UserRole.STAFF || user.role === UserRole.MANAGER
          ? [
              'catalog.view',
              'catalog.create',
              'catalog.update',
              'catalog.delete',
              'catalog.manage',
              'CATALOG:READ',
              'CATALOG:CREATE',
              'CATALOG:UPDATE',
              'CATALOG:DELETE',
              'CATALOG:MANAGE',
            ]
          : []),
      ];

      const hasAccess = checkUserPermissions(
        effectivePermissions,
        requiredPermissions,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have permission to access or manage this resource',
        );
      }
    }

    return true;
  }
}
