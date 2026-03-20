import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Headers,
  UnauthorizedException,
  Res,
  Response,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Controller('auth')
export class SupabaseController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() body: { email: string; password: string }) {
    return this.supabaseService.signUp(body.email, body.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) response: ExpressResponse) {
    const result = await this.supabaseService.signIn(body.email, body.password);
    
    // Set cookie if login successful and no 2FA required
    if (result && !result.requires2FA && (result as any).accessToken) {
      response.cookie('access_token', (result as any).accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }
    
    // Set temp access token if 2FA required
    if (result && result.requires2FA && (result as any).access_token) {
      response.cookie('access_token', (result as any).access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000, // 5 minutes
      });
    }
    
    // Set full access token if 2FA setup in progress
    if (result && (result as any).needs2FASetup && (result as any).access_token) {
      response.cookie('access_token', (result as any).access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }
    
    return result;
  }

  @Post('signout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  async signOut() {
    return this.supabaseService.signOut();
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async sendEmailVerification(@Body() body: { email: string }) {
    return this.supabaseService.sendEmailVerification(body.email);
  }

  @Post('resend-confirmation')
  @HttpCode(HttpStatus.OK)
  async resendConfirmationEmail(@Body() body: { email: string }) {
    return this.supabaseService.resendConfirmationEmail(body.email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    return this.supabaseService.sendPasswordResetEmail(body.email);
  }

  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  async changeEmail(@Body() body: { newEmail: string }) {
    return this.supabaseService.sendEmailChangeEmail(body.newEmail);
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getProfile(@Request() req) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return this.supabaseService.getUser(token);
  }

  @Post('session')
  @HttpCode(HttpStatus.OK)
  getUserSession(
    @Body()
    tokens: {
      access_token: string;
      refresh_token: string;
    },
  ) {
    return this.supabaseService.getUserSession(tokens);
  }


  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection() {
    return this.supabaseService.testConnection();
  }


  @Post('sync-social')
  @HttpCode(HttpStatus.OK)
  async syncSocialUser(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.supabaseService.syncSocialUser(token);
  }

  /* ------------------------------------------------------------------
     2FA ENDPOINTS
  -------------------------------------------------------------------*/
  
  @Post('2fa/cleanup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  async cleanupUnverifiedFactors(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.supabaseService.cleanupUnverifiedFactors(token);
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  async setup2FA(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.supabaseService.setup2FA(token);
  }

  @Post('2fa/verify-setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  async verify2FASetup(
    @Headers('authorization') authHeader: string,
    @Body() body: { factorId: string; code: string }
  ) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.supabaseService.verify2FASetup(token, body.factorId, body.code);
  }

  @Get('2fa/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  async get2FAStatus(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.supabaseService.get2FAStatus(token);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  async disable2FA(
    @Headers('authorization') authHeader: string,
    @Body() body: { factorId: string }
  ) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.supabaseService.disable2FA(token, body.factorId);
  }

  @Post('2fa/challenge')
  @HttpCode(HttpStatus.OK)
  async challenge2FA(@Body() body: { factorId: string }) {
    return this.supabaseService.challenge2FA(body.factorId);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verify2FACode(
    @Body() body: { factorId: string; challengeId: string; code: string },
    @Res({ passthrough: true }) response: ExpressResponse
  ) {
    const result = await this.supabaseService.verify2FACode(body.factorId, body.challengeId, body.code);
    
    // Set access token cookie after successful 2FA verification
    if (result && result.success && (result as any).accessToken) {
      response.cookie('access_token', (result as any).accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }
    
    return result;
  }

  @Post('2fa/resume-setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  async resume2FASetup(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.supabaseService.resume2FASetup(token);
  }

  @Post('2fa/abort-setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  async abort2FASetup(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.supabaseService.abort2FASetup(token);
  }

  @Post('2fa/admin/cleanup-all')
  @HttpCode(HttpStatus.OK)
  async adminCleanupAll2FAFactors() {
    // Note: In production, add admin guards here
    return this.supabaseService.adminCleanupAll2FAFactors();
  }

  @Put('users/:userId/2fa-required')
  @HttpCode(HttpStatus.OK)
  async setUser2FARequirement(
    @Param('userId') userId: string,
    @Body() body: { required: boolean }
  ) {
    // Note: In production, add admin guards here
    return this.supabaseService.setUser2FARequirement(userId, body.required);
  }
}
