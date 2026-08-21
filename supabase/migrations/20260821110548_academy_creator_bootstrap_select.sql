create policy "academies_select_creator"
on public.academies for select
to authenticated
using (created_by = (select auth.uid()));
