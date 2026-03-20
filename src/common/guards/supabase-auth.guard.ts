import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase.module';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    // 1. Check if Authorization header exists and is in the correct format (Bearer token)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'AUTH_HEADER_MISSING',
        message: 'Missing or invalid Authorization header',
      });
    }

    // Extract the token from the Authorization header
    const token = authHeader.split(' ')[1];

    // 2. Validate the JWT token using Supabase
    const { data: { user }, error } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: error?.message || 'Invalid or expired token',
      });
    }

    // 3. Attach the validated user data to the request object
    req.user = {
      id: user.id,
      email: user.email,
      aal: user.app_metadata?.aal,  // Optional: Attach additional user metadata if needed
    };

    return true;  // Allow access to the requested resource
  }
}

// import {
//   CanActivate,
//   ExecutionContext,
//   Injectable,
//   UnauthorizedException,
//   Inject,
// } from '@nestjs/common';
// import { SupabaseClient } from '@supabase/supabase-js';
// import { SUPABASE_CLIENT } from '../../core/supabase/supabase.module';

// @Injectable()
// export class SupabaseAuthGuard implements CanActivate {
//   constructor(
//     @Inject(SUPABASE_CLIENT)
//     private readonly supabase: SupabaseClient,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const req = context.switchToHttp().getRequest();
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       throw new UnauthorizedException({
//         code: 'AUTH_HEADER_MISSING',
//         message: 'Missing Authorization header',
//       });
//     }

//     const token = authHeader.split(' ')[1];

//     // 1. Validate the JWT with Supabase
//     const { data: { user }, error } = await this.supabase.auth.getUser(token);

//     if (error || !user) {
//       throw new UnauthorizedException({
//         code: 'INVALID_TOKEN',
//         message: error?.message || 'Invalid session',
//       });
//     }

//     // 2. Fetch user role from DB (Array-based to avoid Coerce error)
//     const { data: dbUsers, error: dbError } = await this.supabase
//       .from('users.users')
//       .select('role_id')
//       .eq('id', user.id);

//     if (dbError || !dbUsers || dbUsers.length === 0) {
//       throw new UnauthorizedException({
//         code: 'USER_NOT_FOUND',
//         message: 'User profile not found in database',
//       }); 
//     }

//     // 3. Attach user to request
//     req.user = {
//       id: user.id,
//       email: user.email,
//       role: dbUsers[0].role_id,
//       aal: user.app_metadata?.aal,
//     };

//     return true;
//   }
// }


// import {
//   CanActivate,
//   ExecutionContext,
//   Inject,
//   Injectable,
//   UnauthorizedException,
//   ForbiddenException,
// } from '@nestjs/common';
// import { SupabaseClient } from '@supabase/supabase-js';
// import { SUPABASE_CLIENT } from 'src/core/supabase/supabase.module';

// @Injectable()
// export class SupabaseAuthGuard implements CanActivate {
//   constructor(
//     @Inject(SUPABASE_CLIENT)
//     private readonly supabase: SupabaseClient,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const req = context.switchToHttp().getRequest();
//     const token = req.headers.authorization?.replace('Bearer ', '');
//     if (!token) throw new UnauthorizedException('Missing token');

//     const { data, error } = await this.supabase.auth.getUser(token);
//     if (error || !data.user) throw new UnauthorizedException('Invalid token');

//     req.user = {
//       id: data.user.id,
//       email: data.user.email,
//     };

//     return true;
//   }
// }


// @Injectable()
// export class SupabaseAuthGuard implements CanActivate {
//   constructor(
//     @Inject(SUPABASE_CLIENT)
//     private readonly supabase: SupabaseClient,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const req = context.switchToHttp().getRequest();
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       throw new UnauthorizedException('Missing Authorization header');
//     }

//     const token = authHeader.replace('Bearer ', '');
//     if (!token) {
//       throw new UnauthorizedException('Missing token');
//     }

//     // ✅ Get Supabase Auth user
//     const { data: authData, error: authError } = await this.supabase.auth.getUser(token);
//     if (authError || !authData.user) {
//       throw new UnauthorizedException('Invalid or expired token');
//     }

//     const userId = authData.user.id; // UUID string

//     // ✅ Query user in Supabase DB
//     const { data: user, error: dbError } = await this.supabase
//       .from('users')
//       .select(`
//         id,
//         status_id,
//         user_status: user_status (status_code)
//       `)
//       .eq('id', userId)
//       .single();

//     if (dbError || !user) {
//       throw new UnauthorizedException('User not registered in LMS');
//     }

//     // ✅ Optional: check status
//     if (user.user_status?.status_code !== 'active') {
//       throw new ForbiddenException(`Account is ${user.user_status?.status_code}`);
//     }

//     // ✅ Attach user info to request
//     req.user = {
//       id: user.id,
//       email: authData.user.email,
//       role: user.status_id,
//       status: user.user_status?.status_code,
//     };

//     return true;
//   }
// }
// 