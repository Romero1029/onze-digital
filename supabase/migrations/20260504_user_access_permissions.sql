CREATE TABLE IF NOT EXISTS public.user_access_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view_dashboard boolean NOT NULL DEFAULT true,
  can_view_pipeline boolean NOT NULL DEFAULT true,
  can_view_lancamentos boolean NOT NULL DEFAULT true,
  can_view_all_lancamentos boolean NOT NULL DEFAULT true,
  allowed_lancamento_ids uuid[],
  can_view_npa boolean NOT NULL DEFAULT true,
  can_view_aula_secreta boolean NOT NULL DEFAULT true,
  can_view_chat boolean NOT NULL DEFAULT true,
  can_view_sheets boolean NOT NULL DEFAULT true,
  can_view_financeiro boolean NOT NULL DEFAULT true,
  can_view_balanco boolean NOT NULL DEFAULT true,
  can_view_operacoes boolean NOT NULL DEFAULT true,
  can_view_mapa_mental boolean NOT NULL DEFAULT true,
  can_view_rodrygo boolean NOT NULL DEFAULT true,
  can_view_pedagogico boolean NOT NULL DEFAULT true,
  can_view_all_turmas boolean NOT NULL DEFAULT true,
  allowed_turma_ids uuid[],
  can_view_team boolean NOT NULL DEFAULT false,
  can_view_settings boolean NOT NULL DEFAULT false,
  can_view_all_financeiro_turmas boolean NOT NULL DEFAULT true,
  allowed_financeiro_turma_ids uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_access_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage permissions" ON public.user_access_permissions;
DROP POLICY IF EXISTS "Users read own permissions" ON public.user_access_permissions;

CREATE POLICY "Admins manage permissions" ON public.user_access_permissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
