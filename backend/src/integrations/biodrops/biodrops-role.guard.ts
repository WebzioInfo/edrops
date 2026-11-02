import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Access Control Guard for Aquora Biodrops Integration.
 *
 * CRITICAL REQUIREMENT:
 * Accessible ONLY to these three roles:
 * 1. Upper Admin (SUPER_ADMIN, UPPER_ADMIN, or Admin with level > 1)
 * 2. Admin (ADMIN)
 * 3. Staff (STAFF)
 *
 * All other roles (CUSTOMER, DELIVERY_PARTNER, DISTRIBUTOR, MANAGER, etc.)
 * MUST be denied access with HTTP 403.
 *
 * Validates the authenticated user's actual role strictly on the server.
 * Never trusts a role supplied by frontend headers or request body.
 */
@Injectable()
export class BiodropsRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || Object.keys(user).length === 0) {
      throw new UnauthorizedException('Authentication required');
    }

    const rawRole = user.role;
    if (!rawRole) {
      throw new ForbiddenException(
        'Access denied. No authenticated role found.',
      );
    }

    const normalizedRole = String(rawRole)
      .toUpperCase()
      .trim()
      .replace(/[\s\-]/g, '_');

    const isUpperAdmin =
      normalizedRole === 'UPPER_ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      (user.admin && typeof user.admin.level === 'number' && user.admin.level > 1);

    const isAdmin = normalizedRole === 'ADMIN';
    const isStaff = normalizedRole === 'STAFF';

    if (!isUpperAdmin && !isAdmin && !isStaff) {
      throw new ForbiddenException(
        'Access denied. Aquora Biodrops integration is restricted to Upper Admin, Admin, and Staff roles only.',
      );
    }

    return true;
  }
}

