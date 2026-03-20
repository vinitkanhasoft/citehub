import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import supabaseConfig from './supabase.config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [supabaseConfig],
    }),
  ],
})
export class AppConfigModule {}