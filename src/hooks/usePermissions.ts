import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserPermissions {
  can_view_dashboard: boolean;
  can_view_pipeline: boolean;
  can_view_lancamentos: boolean;
  can_view_all_lancamentos: boolean;
  allowed_lancamento_ids: string[];
  can_view_npa: boolean;
  can_view_aula_secreta: boolean;
  can_view_chat: boolean;
  can_view_sheets: boolean;
  can_view_financeiro: boolean;
  can_view_balanco: boolean;
  can_view_operacoes: boolean;
  can_view_mapa_mental: boolean;
  can_view_rodrygo: boolean;
  can_view_pedagogico: boolean;
  can_view_all_turmas: boolean;
  allowed_turma_ids: string[];
  can_view_team: boolean;
  can_view_settings: boolean;
  can_view_all_financeiro_turmas: boolean;
  allowed_financeiro_turma_ids: string[];
}

export const FULL_ACCESS: UserPermissions = {
  can_view_dashboard: true,
  can_view_pipeline: true,
  can_view_lancamentos: true,
  can_view_all_lancamentos: true,
  allowed_lancamento_ids: [],
  can_view_npa: true,
  can_view_aula_secreta: true,
  can_view_chat: true,
  can_view_sheets: true,
  can_view_financeiro: true,
  can_view_balanco: true,
  can_view_operacoes: true,
  can_view_mapa_mental: true,
  can_view_rodrygo: true,
  can_view_pedagogico: true,
  can_view_all_turmas: true,
  allowed_turma_ids: [],
  can_view_team: true,
  can_view_settings: true,
  can_view_all_financeiro_turmas: true,
  allowed_financeiro_turma_ids: [],
};

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>(FULL_ACCESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // Admins sempre têm acesso total
    if (user.tipo === 'admin') {
      setPermissions(FULL_ACCESS);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await (supabase as any)
        .from('user_access_permissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setPermissions({
          ...FULL_ACCESS,
          ...data,
          allowed_lancamento_ids: data.allowed_lancamento_ids || [],
          allowed_turma_ids: data.allowed_turma_ids || [],
          allowed_financeiro_turma_ids: data.allowed_financeiro_turma_ids || [],
        });
      } else {
        // Sem registro = acesso total por padrão
        setPermissions(FULL_ACCESS);
      }
      setLoading(false);
    };

    fetch();
  }, [user?.id]);

  return { permissions, loading };
}
