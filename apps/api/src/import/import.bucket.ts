import { createClient } from '@supabase/supabase-js';

/**
 * Ensure the "imports" bucket exists in Supabase Storage.
 * Call this from main.ts or a NestJS OnModuleInit lifecycle hook.
 */
export async function ensureImportsBucket(supabaseUrl: string, serviceRoleKey: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === 'imports');
  if (!exists) {
    await supabase.storage.createBucket('imports', { public: false });
  }
}
