import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://wpwerdaiqyfhfhhioosp.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_BGgecij1uLNAr-2XWMTPCA_y8_lT9Go'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})
