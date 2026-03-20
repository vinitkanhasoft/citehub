import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase.module';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: any) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists and is in the correct format (Bearer token)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'AUTH_HEADER_MISSING',
        message: 'Authorization header is missing or malformed',
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      // Verify the token with Supabase
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
        });
      }

      // Attach the user to the request object
      req.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
      });
    }
  }
}
