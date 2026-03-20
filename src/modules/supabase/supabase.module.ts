import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseController } from './supabase.controller';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseModule as CoreSupabaseModule } from '../../core/supabase/supabase.module';

@Module({
  imports: [CoreSupabaseModule],
  controllers: [SupabaseController],
  providers: [SupabaseService, SupabaseAuthGuard],
  exports: [SupabaseService, SupabaseAuthGuard],
})
export class SupabaseModule {}
