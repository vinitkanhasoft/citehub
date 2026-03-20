import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseClient } from '@supabase/supabase-js';
// Adjust the import path to match where your SUPABASE_CLIENT provider token is exported
import { SUPABASE_CLIENT } from '../../core/supabase/supabase.provider'; 
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RoleId } from '../enums/roles.enum';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(SUPABASE_CLIENT) private readonly supabase: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleId[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If route has no decorators, it is open access
    if (!requiredRoles && !requiredPermissions) {
      return true; 
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException('No access token provided');

    // 1️⃣ Verify Supabase JWT
    const { data: { user }, error: authError } = await this.supabase.auth.getUser(token);
    if (authError || !user) throw new UnauthorizedException('Invalid or expired token');

    // 2️⃣ Fetch User's Role ID from your custom `users` table
    const { data: userData, error: dbError } = await this.supabase
      .from('users')
      .select('role_id, status_id')
      .eq('id', user.id)
      .single();

    if (dbError || !userData) {
      throw new ForbiddenException('User profile not found in database');
    }

    const userRoleId = userData.role_id;

    // 🛡️ SRS Requirement: Archived users lose benefits
    if (userRoleId === RoleId.ARCHIVED) {
      throw new ForbiddenException('Account is archived');
    }

    // Attach user payload to request for controllers to use downstream
    request.user = { ...user, roleId: userRoleId };

    // 3️⃣ Role Check (If @RequireRoles is used)
    if (requiredRoles && requiredRoles.includes(userRoleId)) {
      return true;
    }

    // 4️⃣ Permission Check using your `role_permissions` table
    if (requiredPermissions) {
      const { data: permissions } = await this.supabase
        .from('role_permissions')
        // Note: Change 'permission_name' to the actual column name in your role_permissions table if different
        .select('permission_name') 
        .eq('role_id', userRoleId)
        .in('permission_name', requiredPermissions);

      // If the user's role has AT LEAST ONE of the required permissions, allow access
      if (permissions && permissions.length > 0) {
        return true;
      }
    }

    throw new ForbiddenException('You lack the required roles or permissions to perform this action');
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}