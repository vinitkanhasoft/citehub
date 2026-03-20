import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit
{
  constructor() {
    console.log('DATABASE_URL =', process.env.DATABASE_URL)

    super()

    console.log('PrismaService created')
  }

  async onModuleInit() {
    await this.$connect()
    console.log('Prisma connected')
  }
}