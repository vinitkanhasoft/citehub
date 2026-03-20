import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

export class SignUpDto {
  email: string;
  password: string;
}

export class SignInDto {
  email: string;
  password: string;
}

@Controller('supabase-auth')
export class SupabaseAuthController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.supabaseService.signUp(signUpDto.email, signUpDto.password);
  }

  @Post('signin')
  async signIn(@Body() signInDto: SignInDto) {
    return this.supabaseService.signIn(signInDto.email, signInDto.password);
  }

  @Post('signout')
  @UseGuards(SupabaseAuthGuard)
  async signOut() {
    return this.supabaseService.signOut();
  }

  @Get('user')
  @UseGuards(SupabaseAuthGuard)
  async getUser(@GetUser() user: any) {
    return { user };
  }
}
