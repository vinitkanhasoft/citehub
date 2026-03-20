import {
    CanActivate,
    ExecutionContext,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(ctx: ExecutionContext): boolean {
        const allowedRoles =
            this.reflector.get<string[]>(ROLES_KEY, ctx.getHandler());

        if (!allowedRoles) return true;

        const req = ctx.switchToHttp().getRequest();
        return allowedRoles.includes(req.user.role);
    }
}

