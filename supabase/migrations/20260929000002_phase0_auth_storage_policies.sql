-- ============================================================================
-- MIGRATION: PHASE 0 AUTH TRIGGER, ROLES SELF-ENROLLMENT & KYC STORAGE
-- ============================================================================

-- 1. Automatic profile creation when a user signs up through Supabase Auth (Phone/Email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email, first_name, last_name)
  values (
    new.id,
    new.phone,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, profiles.phone),
    email = coalesce(excluded.email, profiles.email),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Allow users to self-assign their initial role ('passenger' or 'driver') upon onboarding
drop policy if exists user_roles_insert_self on user_roles;
create policy user_roles_insert_self on user_roles for insert
with check (user_id = auth.uid() and role in ('passenger', 'driver'));

-- 3. Set up private KYC storage bucket in Supabase Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760, -- 10MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760;

-- 4. Storage RLS Policies
drop policy if exists "Authenticated users can upload KYC documents" on storage.objects;
create policy "Authenticated users can upload KYC documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users and admins can view KYC documents" on storage.objects;
create policy "Users and admins can view KYC documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'kyc-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text or is_admin()
  )
);

drop policy if exists "Users and admins can delete own KYC documents" on storage.objects;
create policy "Users and admins can delete own KYC documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'kyc-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text or is_admin()
  )
);
