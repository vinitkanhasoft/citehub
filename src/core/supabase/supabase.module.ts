// // core/supabase/supabase.module.ts
// import { Module } from '@nestjs/common';
// import { createClient } from '@supabase/supabase-js';
// import { ConfigModule, ConfigService } from '@nestjs/config';

// export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

// @Module({
//   imports: [ConfigModule],
//   providers: [
//     {
//       provide: SUPABASE_CLIENT,
//       inject: [ConfigService],
//       useFactory: (config: ConfigService) => {
//         const { url, serviceRoleKey, anonKey } = config.get('supabase');
//         return createClient(url, serviceRoleKey, anonKey);
//       },
//     },
//   ],
//   exports: [SUPABASE_CLIENT],
// })
// export class SupabaseModule {}

import { Module } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const supabase = config.get<{
          url: string;
          serviceRoleKey: string;
        }>('supabase');

        if (!supabase?.url || !supabase?.serviceRoleKey) {
          throw new Error('Supabase config missing');
        }

        const client = createClient(
          supabase.url,
          supabase.serviceRoleKey,
        );
        
        return client as any;
      },
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}


