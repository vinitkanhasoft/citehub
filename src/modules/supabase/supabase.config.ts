export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  anonKey?: string;
}

export const supabaseConfig = (): SupabaseConfig => ({
  url: process.env.SUPABASE_URL || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
});
