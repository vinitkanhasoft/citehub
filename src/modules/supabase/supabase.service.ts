import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase.module';
import * as QRCode from 'qrcode';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: any) {}

  /* ------------------------------------------------------------------
     SIGN UP (EMAIL VERIFICATION HANDLED BY SUPABASE)
  -------------------------------------------------------------------*/
  async signUp(email: string, password: string, additionalData?: any) {
    this.logger.log(`[SIGNUP] Starting signup process for: ${email}`);

    // 1️⃣ Create user in Supabase Auth
    const { data, error: authError } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify`,
        data: {
          first_name: additionalData?.firstName,
          last_name: additionalData?.lastName,
          country: additionalData?.country,
          tips: additionalData?.tips ?? true,
          terms: additionalData?.terms,
        },
      },
    });

    if (authError) {
      throw new BadRequestException({
        code: 'AUTH_SIGNUP_FAILED',
        message: authError.message,
      });
    }

    const authUser = data?.user;

    if (!authUser?.id) {
      throw new BadRequestException({
        code: 'USER_CREATION_FAILED',
        message: 'Auth user could not be retrieved',
      });
    }

    // 2️⃣ Insert into custom users table
    const { error: dbError } = await this.supabase.from('users').insert({
      id: authUser.id,
      role_id: 8, // Default role: Learner
      learner_types_id: 1,
      status_id: 1,
      first_name: additionalData?.firstName || 'Unknown',
      last_name: additionalData?.lastName || 'User',
      email: email,
      country_code: "IN",
      is_email_verified: false,
      is_email_subscribed: additionalData?.tips ?? true,
      password_hash: 'managed-by-supabase',
      product_launches_announcement_pref: true,
      offers_promotions_pref: true,
      learning_statistics_announcement_pref: true,
    });

    if (dbError) {
      this.logger.error(`[SIGNUP] DB Insert failed: ${dbError.message}`);
      throw new BadRequestException({
        code: 'PROFILE_CREATION_FAILED',
        message: dbError.message,
      });
    }

    return {
      success: true,
      message: 'Verification email sent',
      userId: authUser.id,
    };
  }

  /* ------------------------------------------------------------------
     LOGIN (BLOCK IF EMAIL NOT VERIFIED, CHECK 2FA)
  -------------------------------------------------------------------*/
  async signIn(email: string, password: string) {
    // Attempt to sign in the user with the provided credentials.
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
  
    // Handle any error that occurs during the login attempt.
    if (error) {
      throw new BadRequestException({
        code: 'LOGIN_FAILED',
        message: error.message,
      });
    }
  
    // Check if the user's email is confirmed.
    if (!data.user?.email_confirmed_at) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email not verified. Please verify your email.',
      });
    }

    // Get user profile to check 2FA requirements
    const { data: userProfile, error: profileError } = await this.supabase
      .from('users')
      .select('requires_2fa, two_factor_setup_in_progress, two_factor_setup_started_at, role_id, first_name, last_name')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      this.logger.error(`[LOGIN] Failed to fetch user profile: ${profileError.message}`);
    }

    // Check if user has 2FA enabled
    const { data: factors, error: factorsError } = await this.supabase.auth.mfa.listFactors();
    
    let hasVerifiedFactors = false;
    let hasUnverifiedFactors = false;
    let primaryFactor: any = null;
    let setupFactor: any = null;
    
    if (!factorsError && factors.all) {
      const verifiedFactors = factors.all.filter(factor => factor.status === 'verified');
      const unverifiedFactors = factors.all.filter(factor => factor.status === 'unverified');
      
      hasVerifiedFactors = verifiedFactors.length > 0;
      hasUnverifiedFactors = unverifiedFactors.length > 0;
      primaryFactor = verifiedFactors[0] || null;
      setupFactor = unverifiedFactors[0] || null;
    }

    // Handle different 2FA scenarios
    if (hasVerifiedFactors && primaryFactor) {
      // User has 2FA fully enabled, return challenge info with temp token
      return {
        requires2FA: true,
        access_token: data.session?.access_token, // Temporary token for 2FA verification
        user: {
          id: data.user.id,
          email: data.user.email,
          email_confirmed_at: data.user.email_confirmed_at,
          requires_2fa: userProfile?.requires_2fa || false,
        },
        factorId: primaryFactor.id,
        factorType: primaryFactor.factor_type,
        friendlyName: primaryFactor.friendly_name,
        message: '2FA verification required. Please provide your authentication code.',
      };
    } else if (hasUnverifiedFactors && userProfile?.two_factor_setup_in_progress && setupFactor) {
      // User has started 2FA setup but not verified yet
      const setupStartTime = new Date(userProfile.two_factor_setup_started_at);
      const now = new Date();
      const timeDiff = now.getTime() - setupStartTime.getTime();
      const minutesDiff = timeDiff / (1000 * 60);
      
      // If setup is older than 15 minutes, clean it up
      if (minutesDiff > 15) {
        await this.cleanupUnverifiedFactors(data.session?.access_token);
        await this.updateUser2FASetupStatus(data.user.id, false, null);
        
        // Continue to normal login flow after cleanup
      } else {
        // Setup is still valid, allow completion
        return {
          requires2FA: false,
          needs2FASetup: true,
          setupExpiresIn: Math.max(0, 15 - Math.floor(minutesDiff)), // minutes remaining
          access_token: data.session?.access_token,
          user: {
            id: data.user.id,
            email: data.user.email,
            email_confirmed_at: data.user.email_confirmed_at,
            requires_2fa: false, // Not required until setup is complete
          },
          factorId: setupFactor.id,
          factorType: setupFactor.factor_type,
          friendlyName: setupFactor.friendly_name,
          message: '2FA setup in progress. Please complete the setup.',
        };
      }
    }
  
    // Fetch user profile from the custom schema (users.users).
    const finalProfile = userProfile || { role_id: null, first_name: null, last_name: null };
  
    // Return the user and session (no 2FA required)
    return {
      requires2FA: false,
      user: {
        ...data.user,
        role_id: finalProfile.role_id || null,
        first_name: finalProfile.first_name || null,
        last_name: finalProfile.last_name || null,
        requires_2fa: finalProfile.requires_2fa || false,
      },
      session: data.session,
    };
  }

  /* ------------------------------------------------------------------
     SIGN OUT
  -------------------------------------------------------------------*/
  async signOut() {
    // For server-side sign out, we need to use the service role key
    const { error } = await this.supabase.auth.signOut({ scope: 'global' });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: 'Signed out successfully' };
  }

  /* ------------------------------------------------------------------
     GET USER
  -------------------------------------------------------------------*/
  async getUser(jwt: string) {
    const { data: { user }, error } = await this.supabase.auth.getUser(jwt);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return user;
  }

  /* ------------------------------------------------------------------
     EMAIL METHODS
  -------------------------------------------------------------------*/
  async sendEmailVerification(email: string) {
    const { data, error } = await this.supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify`,
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true, message: 'Verification email sent', data };
  }

  async sendPasswordResetEmail(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/auth/reset-password`,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true, message: 'Password reset email sent', data };
  }

  async sendEmailChangeEmail(newEmail: string) {
    const { data, error } = await this.supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true, message: 'Email change confirmation sent', data };
  }

  async resendConfirmationEmail(email: string) {
    const { data, error } = await this.supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify`,
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true, message: 'Confirmation email resent', data };
  }

  /* ------------------------------------------------------------------
     SESSION MANAGEMENT
  -------------------------------------------------------------------*/
  async getUserSession(tokens: { access_token: string; refresh_token: string }) {
    await this.supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw new BadRequestException(error.message);
    return data;
  }






  async testConnection() {
    try {
      // Test basic Supabase connection
      const { data, error } = await this.supabase.from('users').select('count').limit(1);
      
      if (error) {
        return {
          success: false,
          message: 'Failed to connect to Supabase',
          error: error.message
        };
      }

      return {
        success: true,
        message: 'Supabase connection successful',
        database: {
          connected: true,
          tableAccessible: !error
        },
        config: {
          hasUrl: !!process.env.SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasAnonKey: !!process.env.SUPABASE_ANON_KEY
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Supabase connection failed',
        error: error.message
      };
    }
  }


  /* ------------------------------------------------------------------
     SOCIAL AUTHENTICATION
  -------------------------------------------------------------------*/
  async syncSocialUser(accessToken: string) {
    // 1. Verify token & get the user from Supabase Auth
    const { data: { user }, error: authError } = await this.supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // 2. Check if user already exists in your `users` table
    const { data: existingUser, error: dbError } = await this.supabase
      .from('users')
      .select('role_id')
      .eq('id', user.id)
      .maybeSingle();

    if (dbError) {
      throw new BadRequestException('Database error while checking user profile');
    }

    // 3. If they exist, return their role immediately
    if (existingUser) {
      return { 
        success: true, 
        roleId: existingUser.role_id 
      };
    }

    // 4. If they DO NOT exist (First time logging in via Social Auth), insert them
    const fullName = user.user_metadata?.full_name || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || '';

    const newUser = {
      id: user.id,
      role_id: 8, // Default role: Learner
      learner_types_id: 1, 
      status_id: 1, // Active status
      first_name: firstName,
      last_name: lastName,
      email: user.email,
      is_email_verified: true, // Social auth guarantees verified emails
      password_hash: 'social-auth', 
      is_email_subscribed: true,
      product_launches_announcement_pref: true,
      offers_promotions_pref: true,
      learning_statistics_announcement_pref: true,
    };

    const { error: insertError } = await this.supabase.from('users').insert(newUser);

    if (insertError) {
      this.logger.error(`[SYNC] User creation failed: ${insertError.message}`);
      throw new BadRequestException('Failed to create new user profile');
    }

    // Return the default Learner role back to the frontend
    return { 
      success: true, 
      roleId: 8 
    };
  }

  async socialLogin(provider: any) {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
      },
    });

    if (error) throw new BadRequestException(error.message);
    return { url: data?.url };
  }

  /* ------------------------------------------------------------------
     2FA HELPER METHODS
  -------------------------------------------------------------------*/
  
  private async updateUser2FASetupStatus(userId: string, inProgress: boolean, startedAt: Date | null) {
    try {
      const updateData: any = {
        two_factor_setup_in_progress: inProgress,
      };
      
      if (startedAt) {
        updateData.two_factor_setup_started_at = startedAt.toISOString();
      } else {
        updateData.two_factor_setup_started_at = null;
      }
      
      const { error } = await this.supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);
        
      if (error) {
        this.logger.error(`[2FA SETUP STATUS] Failed to update: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`[2FA SETUP STATUS] Error: ${error.message}`);
    }
  }

  private async updateUser2FARequirement(userId: string, required: boolean) {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ requires_2fa: required })
        .eq('id', userId);
        
      if (error) {
        this.logger.error(`[2FA REQUIREMENT] Failed to update: ${error.message}`);
        throw new BadRequestException({
          code: 'DB_UPDATE_FAILED',
          message: 'Failed to update 2FA requirement',
        });
      }
    } catch (error) {
      this.logger.error(`[2FA REQUIREMENT] Error: ${error.message}`);
      throw error;
    }
  }

  /* ------------------------------------------------------------------
     2FA METHODS
  -------------------------------------------------------------------*/
  
  async cleanupUnverifiedFactors(accessToken: string) {
    try {
      // 1. Get the current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // 2. List all factors
      const { data: factors, error: factorsError } = await this.supabase.auth.mfa.listFactors();
      
      if (!factorsError && factors.all) {
        const unverifiedFactors = factors.all.filter(factor => factor.status === 'unverified');
        
        // 3. Unenroll all unverified factors
        for (const factor of unverifiedFactors) {
          this.logger.log(`[2FA CLEANUP] Removing unverified factor: ${factor.id}`);
          await this.supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
        
        return {
          success: true,
          cleaned: unverifiedFactors.length,
          message: `Cleaned up ${unverifiedFactors.length} incomplete 2FA setups`,
        };
      }

      return {
        success: true,
        cleaned: 0,
        message: 'No incomplete 2FA setups found',
      };
    } catch (error) {
      this.logger.error(`[2FA CLEANUP] Error: ${error.message}`);
      throw error;
    }
  }

  async setup2FA(accessToken: string) {
    try {
      // 1. Get the current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      this.logger.log(`[2FA SETUP] User: ${user.email}`);

      // 2. Check for existing unverified factors first
      const { data: factors, error: factorsError } = await this.supabase.auth.mfa.listFactors();
      
      if (!factorsError && factors.all) {
        const unverifiedFactors = factors.all.filter(factor => factor.status === 'unverified');
        
        if (unverifiedFactors.length > 0) {
          // Use existing unverified factor - resume setup
          const existingFactor = unverifiedFactors[0];
          this.logger.log(`[2FA SETUP] Found existing unverified factor: ${existingFactor.id}`);
          
          // Update setup status in database
          await this.updateUser2FASetupStatus(user.id, true, new Date());
          
          // Extract QR code data from the existing factor
          const supabaseQrCode = existingFactor.qr_code || '';
          
          // 4. Convert SVG to proper data URL for HTML img tags
          let imageDataUrl: string;
          
          if (supabaseQrCode.startsWith('data:image/svg+xml')) {
            // Supabase already provides data URL format, use it directly
            imageDataUrl = supabaseQrCode;
          } else if (supabaseQrCode.startsWith('<?xml')) {
            // Convert raw SVG to base64 data URL
            const svgBase64 = Buffer.from(supabaseQrCode, 'utf8').toString('base64');
            imageDataUrl = `data:image/svg+xml;base64,${svgBase64}`;
          } else {
            throw new BadRequestException({
              code: 'QR_CODE_MISSING',
              message: 'QR code data not available for existing factor',
            });
          }

          return {
            success: true,
            factorId: existingFactor.id,
            qrCode: imageDataUrl,
            qrCodeSvg: supabaseQrCode,
            secret: 'Use your authenticator app to scan the QR code', // Don't expose secret
            backupCodes: [],
            message: '2FA setup resumed. Please scan QR code and verify.',
            setupExpiresIn: 15, // minutes
          };
        }
      }

      // 3. No existing unverified factor, create new one
      this.logger.log(`[2FA SETUP] Creating new TOTP factor`);
      
      // Mark setup as in progress in database
      await this.updateUser2FASetupStatus(user.id, true, new Date());
      
      const { data, error } = await this.supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `${user.email}'s Authenticator App`,
      });

      if (error) {
        // Cleanup setup status on failure
        await this.updateUser2FASetupStatus(user.id, false, null);
        throw new BadRequestException({
          code: 'MFA_ENROLL_FAILED',
          message: error.message,
        });
      }

      // 3. Extract QR code data from Supabase response
      const totpSecret = data?.totp?.secret;
      const supabaseQrCode = data?.totp?.qr_code; // Supabase provides SVG QR code
      
      this.logger.log(`[2FA SETUP] TOTP Secret: ${totpSecret ? 'Present' : 'Missing'}`);
      this.logger.log(`[2FA SETUP] Supabase QR Code: ${supabaseQrCode ? 'Present' : 'Missing'}`);
      
      if (!totpSecret || !supabaseQrCode) {
        // Cleanup setup status on failure
        await this.updateUser2FASetupStatus(user.id, false, null);
        throw new BadRequestException({
          code: 'QR_CODE_GENERATION_FAILED',
          message: `Failed to generate TOTP secret. Secret: ${totpSecret ? 'Present' : 'Missing'}, QR Code: ${supabaseQrCode ? 'Present' : 'Missing'}`,
        });
      }

      // 4. Convert SVG to proper data URL for HTML img tags
      let imageDataUrl: string;
      
      if (supabaseQrCode.startsWith('data:image/svg+xml')) {
        // Supabase already provides data URL format, use it directly
        imageDataUrl = supabaseQrCode;
      } else if (supabaseQrCode.startsWith('<?xml')) {
        // Convert raw SVG to base64 data URL
        const svgBase64 = Buffer.from(supabaseQrCode, 'utf8').toString('base64');
        imageDataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      } else {
        // Try to generate PNG QR code as fallback
        try {
          // Extract the TOTP URI from the SVG or use the secret
          const totpUri = `otpauth://totp/YourApp:${user.email}?secret=${totpSecret}&issuer=YourApp`;
          imageDataUrl = await QRCode.toDataURL(totpUri);
        } catch (qrError) {
          this.logger.error(`[2FA SETUP] PNG QR generation failed: ${qrError.message}`);
          // Final fallback - return SVG as data URL
          const svgBase64 = Buffer.from(supabaseQrCode, 'utf8').toString('base64');
          imageDataUrl = `data:image/svg+xml;base64,${svgBase64}`;
        }
      }

      return {
        success: true,
        factorId: data.id,
        qrCode: imageDataUrl, // Proper data URL for img tags
        qrCodeSvg: supabaseQrCode, // Original SVG for debugging
        secret: totpSecret,
        backupCodes: data.totp?.backup_codes || [],
        message: '2FA setup initiated. Scan QR code with your authenticator app.',
        setupExpiresIn: 15, // minutes
      };
    } catch (error) {
      this.logger.error(`[2FA SETUP] Error: ${error.message}`);
      throw error;
    }
  }

  async verify2FASetup(accessToken: string, factorId: string, code: string) {
    try {
      // 1. Get the current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // 2. Challenge the factor
      const { data: challengeData, error: challengeError } = await this.supabase.auth.mfa.challenge({
        factorId: factorId,
      });

      if (challengeError) {
        // Cleanup setup status on challenge failure
        await this.updateUser2FASetupStatus(user.id, false, null);
        throw new BadRequestException({
          code: 'MFA_CHALLENGE_FAILED',
          message: challengeError.message,
        });
      }

      // 3. Verify the challenge with the provided code
      const { data: verifyData, error: verifyError } = await this.supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeData.id,
        code: code,
      });

      if (verifyError) {
        // Don't cleanup on invalid code - user might retry
        throw new BadRequestException({
          code: 'MFA_VERIFY_FAILED',
          message: 'Invalid verification code. Please try again.',
        });
      }

      // 4. Setup completed successfully - update database
      await this.updateUser2FARequirement(user.id, true); // Set requires_2fa = true
      await this.updateUser2FASetupStatus(user.id, false, null); // Clear setup status
      
      // 5. Cleanup any other unverified factors for this user
      await this.cleanupUnverifiedFactors(accessToken);

      return {
        success: true,
        message: '2FA setup completed successfully!',
        verifiedAt: verifyData.created_at,
        requires2FA: true,
      };
    } catch (error) {
      this.logger.error(`[2FA VERIFY SETUP] Error: ${error.message}`);
      throw error;
    }
  }

  async get2FAStatus(accessToken: string) {
    try {
      // 1. Get the current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // 2. List all factors for the user
      const { data: factors, error: factorsError } = await this.supabase.auth.mfa.listFactors();

      if (factorsError) {
        throw new BadRequestException({
          code: 'MFA_LIST_FACTORS_FAILED',
          message: factorsError.message,
        });
      }

      const activeFactors = factors.all?.filter(factor => factor.status === 'verified') || [];
      
      return {
        success: true,
        is2FAEnabled: activeFactors.length > 0,
        factors: activeFactors.map(factor => ({
          id: factor.id,
          friendlyName: factor.friendly_name,
          factorType: factor.factor_type,
          createdAt: factor.created_at,
          updatedAt: factor.updated_at,
        })),
      };
    } catch (error) {
      this.logger.error(`[2FA STATUS] Error: ${error.message}`);
      throw error;
    }
  }

  async disable2FA(accessToken: string, factorId: string) {
    try {
      // 1. Get the current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // 2. Unenroll the factor
      const { data, error } = await this.supabase.auth.mfa.unenroll({
        factorId: factorId,
      });

      if (error) {
        throw new BadRequestException({
          code: 'MFA_UNENROLL_FAILED',
          message: error.message,
        });
      }

      // 3. Update database to reflect 2FA is no longer required
      await this.updateUser2FARequirement(user.id, false);
      
      // 4. Cleanup any remaining unverified factors
      await this.cleanupUnverifiedFactors(accessToken);

      return {
        success: true,
        message: '2FA disabled successfully',
        unenrolledAt: data.created_at,
        requires2FA: false,
      };
    } catch (error) {
      this.logger.error(`[2FA DISABLE] Error: ${error.message}`);
      throw error;
    }
  }

  async challenge2FA(factorId: string) {
    try {
      const { data, error } = await this.supabase.auth.mfa.challenge({
        factorId: factorId,
      });

      if (error) {
        throw new BadRequestException({
          code: 'MFA_CHALLENGE_FAILED',
          message: error.message,
        });
      }

      return {
        success: true,
        challengeId: data.id,
        expiresAt: data.expires_at,
        message: '2FA challenge created. Please provide verification code.',
      };
    } catch (error) {
      this.logger.error(`[2FA CHALLENGE] Error: ${error.message}`);
      throw error;
    }
  }

  async verify2FACode(factorId: string, challengeId: string, code: string) {
    try {
      this.logger.log(`[2FA VERIFY] Starting verification - Factor: ${factorId}, Challenge: ${challengeId}, Code: ${code}`);
      
      // If no challengeId provided, create one first
      let actualChallengeId = challengeId;
      
      if (!actualChallengeId || actualChallengeId === factorId) {
        this.logger.log(`[2FA VERIFY] No valid challenge, creating one first`);
        
        // 1. Get the user session first (temp token won't work for challenge)
        const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
        
        if (sessionError || !session) {
          throw new BadRequestException({
            code: 'SESSION_ERROR',
            message: 'No active session found. Please login again.',
          });
        }
        
        this.logger.log(`[2FA VERIFY] Using session for challenge creation`);
        
        // 2. Create challenge using the real session token
        const { data: challengeData, error: challengeError } = await this.supabase.auth.mfa.challenge({
          factorId: factorId,
        });

        if (challengeError) {
          this.logger.error(`[2FA VERIFY] Challenge creation failed: ${challengeError.message}`);
          this.logger.error(`[2FA VERIFY] Challenge error details:`, JSON.stringify(challengeError, null, 2));
          
          // Try alternative approach - use verify directly
          this.logger.log(`[2FA VERIFY] Trying direct verification without challenge`);
          
          const { data: directData, error: directError } = await this.supabase.auth.mfa.verify({
            factorId: factorId,
            code: code,
          });

          if (directError) {
            this.logger.error(`[2FA VERIFY] Direct verification failed: ${directError.message}`);
            throw new BadRequestException({
              code: 'MFA_VERIFY_FAILED',
              message: `Invalid verification code. Error: ${directError.message}`,
            });
          }

          this.logger.log(`[2FA VERIFY] Direct verification successful!`);

          return {
            success: true,
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            user: {
              id: session.user.id,
              email: session.user.email,
              email_confirmed_at: session.user.email_confirmed_at,
            },
            verifiedAt: directData.created_at,
            message: '2FA verification successful',
          };
        }

        actualChallengeId = challengeData.id;
        this.logger.log(`[2FA VERIFY] Created challenge: ${actualChallengeId}`);
      }

      // 3. Verify the challenge with the provided code
      const { data, error } = await this.supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: actualChallengeId,
        code: code,
      });

      if (error) {
        this.logger.error(`[2FA VERIFY] Verification failed: ${error.message}`);
        this.logger.error(`[2FA VERIFY] Full error:`, JSON.stringify(error, null, 2));
        throw new BadRequestException({
          code: 'MFA_VERIFY_FAILED',
          message: `Invalid verification code. Error: ${error.message}`,
        });
      }

      this.logger.log(`[2FA VERIFY] Verification successful!`);

      // 4. After successful 2FA verification, get the user session to return access token
      const { data: { session: finalSession }, error: finalSessionError } = await this.supabase.auth.getSession();
      
      if (finalSessionError || !finalSession) {
        throw new BadRequestException({
          code: 'SESSION_ERROR',
          message: 'Failed to get session after 2FA verification.',
        });
      }

      return {
        success: true,
        accessToken: finalSession.access_token,
        refreshToken: finalSession.refresh_token,
        user: {
          id: finalSession.user.id,
          email: finalSession.user.email,
          email_confirmed_at: finalSession.user.email_confirmed_at,
        },
        verifiedAt: data.created_at,
        message: '2FA verification successful',
      };
    } catch (error) {
      this.logger.error(`[2FA VERIFY] Error: ${error.message}`);
      throw error;
    }
  }

  /* ------------------------------------------------------------------
     2FA RECOVERY AND CLEANUP METHODS
  -------------------------------------------------------------------*/

  async resume2FASetup(accessToken: string) {
    try {
      // 1. Get the current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // 2. Get user profile to check setup status
      const { data: userProfile, error: profileError } = await this.supabase
        .from('users')
        .select('two_factor_setup_in_progress, two_factor_setup_started_at')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile?.two_factor_setup_in_progress) {
        throw new BadRequestException({
          code: 'NO_SETUP_IN_PROGRESS',
          message: 'No 2FA setup in progress. Please start a new setup.',
        });
      }

      // 3. Check if setup has expired (15 minutes)
      const setupStartTime = new Date(userProfile.two_factor_setup_started_at);
      const now = new Date();
      const timeDiff = now.getTime() - setupStartTime.getTime();
      const minutesDiff = timeDiff / (1000 * 60);
      
      if (minutesDiff > 15) {
        // Cleanup expired setup
        await this.cleanupUnverifiedFactors(accessToken);
        await this.updateUser2FASetupStatus(user.id, false, null);
        
        throw new BadRequestException({
          code: 'SETUP_EXPIRED',
          message: '2FA setup has expired. Please start a new setup.',
        });
      }

      // 4. Check for existing unverified factors
      const { data: factors, error: factorsError } = await this.supabase.auth.mfa.listFactors();
      
      if (factorsError || !factors.all) {
        throw new BadRequestException({
          code: 'NO_FACTORS_FOUND',
          message: 'No 2FA factors found. Please start a new setup.',
        });
      }

      const unverifiedFactors = factors.all.filter(factor => factor.status === 'unverified');
      
      if (unverifiedFactors.length === 0) {
        // Inconsistent state - cleanup and ask to restart
        await this.updateUser2FASetupStatus(user.id, false, null);
        throw new BadRequestException({
          code: 'INCONSISTENT_STATE',
          message: 'Setup state is inconsistent. Please start a new setup.',
        });
      }

      // 5. Return the existing factor for resume
      const existingFactor = unverifiedFactors[0];
      const supabaseQrCode = existingFactor.qr_code || '';
      
      // Convert SVG to proper data URL
      let imageDataUrl: string;
      
      if (supabaseQrCode.startsWith('data:image/svg+xml')) {
        imageDataUrl = supabaseQrCode;
      } else if (supabaseQrCode.startsWith('<?xml')) {
        const svgBase64 = Buffer.from(supabaseQrCode, 'utf8').toString('base64');
        imageDataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      } else {
        throw new BadRequestException({
          code: 'QR_CODE_MISSING',
          message: 'QR code data not available for existing factor',
        });
      }

      return {
        success: true,
        factorId: existingFactor.id,
        qrCode: imageDataUrl,
        qrCodeSvg: supabaseQrCode,
        message: '2FA setup resumed. Please scan QR code and verify.',
        setupExpiresIn: Math.max(0, 15 - Math.floor(minutesDiff)), // minutes remaining
      };
    } catch (error) {
      this.logger.error(`[2FA RESUME] Error: ${error.message}`);
      throw error;
    }
  }

  async abort2FASetup(accessToken: string) {
    try {
      // 1. Get the current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // 2. Cleanup all unverified factors
      const cleanupResult = await this.cleanupUnverifiedFactors(accessToken);
      
      // 3. Clear setup status in database
      await this.updateUser2FASetupStatus(user.id, false, null);

      return {
        success: true,
        message: '2FA setup aborted successfully',
        cleaned: cleanupResult.cleaned,
      };
    } catch (error) {
      this.logger.error(`[2FA ABORT] Error: ${error.message}`);
      throw error;
    }
  }

  async adminCleanupAll2FAFactors() {
    try {
      // This is an admin function to cleanup all orphaned factors
      // In a real implementation, you'd want to check admin permissions here
      
      // Get all users with setup_in_progress = true
      const { data: usersWithSetup, error: usersError } = await this.supabase
        .from('users')
        .select('id, email, two_factor_setup_started_at')
        .eq('two_factor_setup_in_progress', true);

      if (usersError) {
        throw new BadRequestException({
          code: 'DB_QUERY_FAILED',
          message: 'Failed to query users with 2FA setup in progress',
        });
      }

      let totalCleaned = 0;
      const cleanupResults: any[] = [];

      for (const user of usersWithSetup || []) {
        try {
          // Check if setup is older than 15 minutes
          const setupStartTime = new Date(user.two_factor_setup_started_at);
          const now = new Date();
          const timeDiff = now.getTime() - setupStartTime.getTime();
          const minutesDiff = timeDiff / (1000 * 60);
          
          if (minutesDiff > 15) {
            // Get service role client for admin operations
            // Note: This would require service role key setup
            // For now, we'll just update the database status
            await this.updateUser2FASetupStatus(user.id, false, null);
            
            cleanupResults.push({
              userId: user.id,
              email: user.email,
              status: 'cleaned',
              reason: 'expired_setup',
            });
            
            totalCleaned++;
          }
        } catch (error) {
          cleanupResults.push({
            userId: user.id,
            email: user.email,
            status: 'error',
            error: error.message,
          });
        }
      }

      return {
        success: true,
        totalCleaned,
        totalChecked: usersWithSetup?.length || 0,
        results: cleanupResults,
        message: `Cleaned up ${totalCleaned} expired 2FA setups`,
      };
    } catch (error) {
      this.logger.error(`[2FA ADMIN CLEANUP] Error: ${error.message}`);
      throw error;
    }
  }

  async setUser2FARequirement(userId: string, required: boolean) {
    try {
      // This is an admin function to set 2FA requirement for a user
      // In a real implementation, you'd want to check admin permissions here
      
      await this.updateUser2FARequirement(userId, required);

      return {
        success: true,
        message: `2FA requirement ${required ? 'enabled' : 'disabled'} for user ${userId}`,
        userId,
        requires2FA: required,
      };
    } catch (error) {
      this.logger.error(`[2FA SET REQUIREMENT] Error: ${error.message}`);
      throw error;
    }
  }

  /* ------------------------------------------------------------------
     ADMIN METHODS
  -------------------------------------------------------------------*/
  async updateUserRole(userId: string, roleId: number) {
    const { error } = await this.supabase
      .from('users')
      .update({ role_id: roleId })
      .eq('id', userId);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async archiveUser(userId: string, archivedStatusId: number) {
    const { error } = await this.supabase
      .from('users')
      .update({ status_id: archivedStatusId })
      .eq('id', userId);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async logout(accessToken: string) {
    // Using standard sign out with the provided token context
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return {
      success: true,
      message: 'Session expired successfully',
    };
  }
}
