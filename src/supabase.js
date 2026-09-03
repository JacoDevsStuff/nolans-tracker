import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in your values.'
  )
}

export const supabase = createClient(url, key)

/* ------------------------------------------------------------------ */
/*  Storage helpers — all project data lives in the `projects` table.  */
/*  Each row: { id: text PK, data: jsonb, updated_at: timestamptz }    */
/* ------------------------------------------------------------------ */

export async function loadAll() {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .order('updated_at', { ascending: false })
  if (error) { console.error('loadAll:', error); return [] }
  return (data || []).map(r => ({
    ...r.data,
    openSnags: (r.data.snags || []).filter(s => !s.resolved).length,
  }))
}

export async function fetchProject(id) {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('id', id)
    .single()
  if (error) { console.error('fetchProject:', error); return null }
  return data?.data || null
}

export async function upsertProject(p) {
  p.updatedAt = Date.now()
  const { error } = await supabase.from('projects').upsert({
    id: p.id,
    data: p,
    updated_at: new Date().toISOString(),
  })
  if (error) console.error('upsertProject:', error)
  return p
}

export async function removeProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) console.error('removeProject:', error)
}
