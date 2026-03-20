import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AppController } from './app.controller'
import { AppService } from './app.service'

import { AppConfigModule } from './config/config.module'
import { PrismaModule } from './prisma/prisma.module'
import { CommonModule } from './common/common.module'
import { AvatarModule } from './modules/avatar/avatar.module'
import { UsersModule } from './modules/users/users.module'
import { SupabaseModule } from './modules/supabase/supabase.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ✅ VERY IMPORTANT
      envFilePath: '.env',
    }),

    AppConfigModule,

    PrismaModule,
    SupabaseModule,
    UsersModule,
    AvatarModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}