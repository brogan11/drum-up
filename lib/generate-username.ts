import { supabase } from './supabase'

export async function generateUsername(displayName: string): Promise<string> {
  const base = displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) // leave room for -NN suffix
    || 'user'

  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', base)
    .maybeSingle()

  if (!data) return base

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`
    const { data: taken } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', candidate)
      .maybeSingle()
    if (!taken) return candidate
  }

  return `${base}-${Date.now().toString().slice(-4)}`
}
