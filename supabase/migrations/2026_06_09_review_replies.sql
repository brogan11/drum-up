-- Drum Up — review replies
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Lets the reviewee (e.g. a musician) post a public reply to a review left for
-- them. RLS can't restrict which columns an UPDATE touches, so instead of a
-- broad reviewee UPDATE policy (which would let them alter the rating/text), we
-- expose a narrow SECURITY DEFINER function that only ever writes reply/replied_at.

alter table public.reviews add column if not exists reply text;
alter table public.reviews add column if not exists replied_at timestamptz;

create or replace function public.reply_to_review(review_id uuid, reply_text text)
returns void language plpgsql security definer set search_path = public as $$
declare
  cleaned text := nullif(btrim(reply_text), '');
begin
  update public.reviews
     set reply = cleaned,
         replied_at = case when cleaned is null then null else now() end
   where id = review_id and reviewee_id = auth.uid();
  if not found then
    raise exception 'Review not found or not owned by caller';
  end if;
end;
$$;

grant execute on function public.reply_to_review(uuid, text) to authenticated;
