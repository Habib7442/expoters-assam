-- Pin search_path on trigger functions per `supabase db advisors` (WARN:
-- function_search_path_mutable). None of these reference other schema
-- objects, so an empty search_path is safe.

alter function public.set_updated_at() set search_path = '';
alter function public.normalize_buyer_phone() set search_path = '';
alter function public.enquiries_require_reference() set search_path = '';
