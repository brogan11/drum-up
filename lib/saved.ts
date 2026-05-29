import { supabase } from '@/lib/supabase'

export type SavedItemType = 'gig' | 'venue' | 'musician'

export const savedKey = (type: SavedItemType, id: string) => `${type}:${id}`

// Returns a Set of "type:id" keys for everything the user has saved.
export async function getSavedSet(userId: string): Promise<Set<string>> {
  if (!userId) return new Set()
  const { data, error } = await supabase
    .from('saved_items')
    .select('item_type, item_id')
    .eq('user_id', userId)
  if (error || !data) return new Set()
  return new Set(data.map(r => savedKey(r.item_type as SavedItemType, r.item_id as string)))
}

// Toggle a saved item. `isSaved` is the CURRENT state — pass true to remove, false to add.
export async function toggleSaved(
  userId: string,
  type: SavedItemType,
  id: string,
  isSaved: boolean,
): Promise<void> {
  if (isSaved) {
    const { error } = await supabase
      .from('saved_items')
      .delete()
      .eq('user_id', userId)
      .eq('item_type', type)
      .eq('item_id', id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('saved_items')
      .insert({ user_id: userId, item_type: type, item_id: id })
    if (error) throw error
  }
}
