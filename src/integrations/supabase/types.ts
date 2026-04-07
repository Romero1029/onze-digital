export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: { [_ in never]: never }
    Views: { [_ in never]: never }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
        Returns: Json
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
  public: {
    Tables: {
      alunos: {
        Row: { created_at: string | null; data_fim: string | null; data_inicio: string | null; dia_vencimento: number | null; email: string | null; id: string; mensalidades_pagas: number | null; nome: string; origem_lead: string | null; produto: string | null; status: string | null; total_mensalidades: number | null; turma_id: string | null; updated_at: string | null; valor_mensalidade: number | null; whatsapp: string | null }
        Insert: { created_at?: string | null; data_fim?: string | null; data_inicio?: string | null; dia_vencimento?: number | null; email?: string | null; id?: string; mensalidades_pagas?: number | null; nome: string; origem_lead?: string | null; produto?: string | null; status?: string | null; total_mensalidades?: number | null; turma_id?: string | null; updated_at?: string | null; valor_mensalidade?: number | null; whatsapp?: string | null }
        Update: { created_at?: string | null; data_fim?: string | null; data_inicio?: string | null; dia_vencimento?: number | null; email?: string | null; id?: string; mensalidades_pagas?: number | null; nome?: string; origem_lead?: string | null; produto?: string | null; status?: string | null; total_mensalidades?: number | null; turma_id?: string | null; updated_at?: string | null; valor_mensalidade?: number | null; whatsapp?: string | null }
        Relationships: [{ foreignKeyName: "alunos_turma_id_fkey"; columns: ["turma_id"]; isOneToOne: false; referencedRelation: "turmas"; referencedColumns: ["id"] }]
      }
      aula_secreta_eventos: {
        Row: { ativo: boolean | null; created_at: string | null; data_evento: string | null; descricao: string | null; id: string; local: string | null; meta_matriculas: number | null; nome: string; sheets_id: string | null; status: string | null; updated_at: string | null }
        Insert: { ativo?: boolean | null; created_at?: string | null; data_evento?: string | null; descricao?: string | null; id?: string; local?: string | null; meta_matriculas?: number | null; nome: string; sheets_id?: string | null; status?: string | null; updated_at?: string | null }
        Update: { ativo?: boolean | null; created_at?: string | null; data_evento?: string | null; descricao?: string | null; id?: string; local?: string | null; meta_matriculas?: number | null; nome?: string; sheets_id?: string | null; status?: string | null; updated_at?: string | null }
        Relationships: []
      }
      aula_secreta_leads: {
        Row: { aula_secreta_evento_id: string; closer: boolean | null; created_at: string | null; data_entrada: string | null; email: string | null; erro: string | null; fase: string; follow_up_01: boolean | null; follow_up_02: boolean | null; follow_up_03: boolean | null; id: string; ingresso_pago: boolean | null; matriculado: boolean | null; nome: string; observacoes: string | null; presente_evento: boolean | null; responsavel_id: string | null; sheets_row_index: number | null; ultima_atividade: string | null; updated_at: string | null; valor_ingresso: number | null; valor_matricula: number | null; whatsapp: string | null }
        Insert: { aula_secreta_evento_id: string; closer?: boolean | null; created_at?: string | null; data_entrada?: string | null; email?: string | null; erro?: string | null; fase?: string; follow_up_01?: boolean | null; follow_up_02?: boolean | null; follow_up_03?: boolean | null; id?: string; ingresso_pago?: boolean | null; matriculado?: boolean | null; nome: string; observacoes?: string | null; presente_evento?: boolean | null; responsavel_id?: string | null; sheets_row_index?: number | null; ultima_atividade?: string | null; updated_at?: string | null; valor_ingresso?: number | null; valor_matricula?: number | null; whatsapp?: string | null }
        Update: { aula_secreta_evento_id?: string; closer?: boolean | null; created_at?: string | null; data_entrada?: string | null; email?: string | null; erro?: string | null; fase?: string; follow_up_01?: boolean | null; follow_up_02?: boolean | null; follow_up_03?: boolean | null; id?: string; ingresso_pago?: boolean | null; matriculado?: boolean | null; nome?: string; observacoes?: string | null; presente_evento?: boolean | null; responsavel_id?: string | null; sheets_row_index?: number | null; ultima_atividade?: string | null; updated_at?: string | null; valor_ingresso?: number | null; valor_matricula?: number | null; whatsapp?: string | null }
        Relationships: [{ foreignKeyName: "aula_secreta_leads_evento_id_fkey"; columns: ["aula_secreta_evento_id"]; isOneToOne: false; referencedRelation: "aula_secreta_eventos"; referencedColumns: ["id"] }]
      }
      aula_secreta_log: {
        Row: { aula_secreta_evento_id: string | null; created_at: string | null; evento: string; id: string; payload: Json | null }
        Insert: { aula_secreta_evento_id?: string | null; created_at?: string | null; evento: string; id?: string; payload?: Json | null }
        Update: { aula_secreta_evento_id?: string | null; created_at?: string | null; evento?: string; id?: string; payload?: Json | null }
        Relationships: [{ foreignKeyName: "aula_secreta_log_evento_id_fkey"; columns: ["aula_secreta_evento_id"]; isOneToOne: false; referencedRelation: "aula_secreta_eventos"; referencedColumns: ["id"] }]
      }
      chat_messages: {
        Row: { conteudo: string; created_at: string | null; id: string; user_id: string | null; usuario_id: string | null }
        Insert: { conteudo: string; created_at?: string | null; id?: string; user_id?: string | null; usuario_id?: string | null }
        Update: { conteudo?: string; created_at?: string | null; id?: string; user_id?: string | null; usuario_id?: string | null }
        Relationships: []
      }
      conteudo_calendario: {
        Row: { created_at: string | null; created_by: string | null; data_publicacao: string | null; formato: string | null; id: string; legenda: string | null; link: string | null; observacoes: string | null; plataforma: string | null; responsavel: string | null; status: string | null; titulo: string }
        Insert: { created_at?: string | null; created_by?: string | null; data_publicacao?: string | null; formato?: string | null; id?: string; legenda?: string | null; link?: string | null; observacoes?: string | null; plataforma?: string | null; responsavel?: string | null; status?: string | null; titulo: string }
        Update: { created_at?: string | null; created_by?: string | null; data_publicacao?: string | null; formato?: string | null; id?: string; legenda?: string | null; link?: string | null; observacoes?: string | null; plataforma?: string | null; responsavel?: string | null; status?: string | null; titulo?: string }
        Relationships: []
      }
      equipe: {
        Row: { ativo: boolean | null; cargo: string | null; cor: string | null; created_at: string | null; email: string | null; id: string; nome: string }
        Insert: { ativo?: boolean | null; cargo?: string | null; cor?: string | null; created_at?: string | null; email?: string | null; id?: string; nome: string }
        Update: { ativo?: boolean | null; cargo?: string | null; cor?: string | null; created_at?: string | null; email?: string | null; id?: string; nome?: string }
        Relationships: []
      }
      eventos_calendario: {
        Row: { cor: string | null; created_at: string | null; created_by: string | null; data_fim: string | null; data_inicio: string; descricao: string | null; id: string; tipo: string | null; titulo: string }
        Insert: { cor?: string | null; created_at?: string | null; created_by?: string | null; data_fim?: string | null; data_inicio: string; descricao?: string | null; id?: string; tipo?: string | null; titulo: string }
        Update: { cor?: string | null; created_at?: string | null; created_by?: string | null; data_fim?: string | null; data_inicio?: string; descricao?: string | null; id?: string; tipo?: string | null; titulo?: string }
        Relationships: []
      }
      lancamento_eventos: {
        Row: { created_at: string | null; evento: string; id: string; lancamento_id: string | null; payload: Json | null }
        Insert: { created_at?: string | null; evento: string; id?: string; lancamento_id?: string | null; payload?: Json | null }
        Update: { created_at?: string | null; evento?: string; id?: string; lancamento_id?: string | null; payload?: Json | null }
        Relationships: [{ foreignKeyName: "lancamento_eventos_lancamento_id_fkey"; columns: ["lancamento_id"]; isOneToOne: false; referencedRelation: "lancamentos"; referencedColumns: ["id"] }]
      }
      lancamento_leads: {
        Row: { created_at: string | null; crm: boolean | null; data_entrada: string | null; disparo: boolean | null; email: string | null; enviado: boolean | null; erro: string | null; fase: string; follow_up_01: boolean | null; follow_up_02: boolean | null; follow_up_03: boolean | null; grupo_oferta: boolean | null; id: string; lancamento_id: string; matriculado: boolean | null; no_grupo: boolean | null; nome: string; observacoes: string | null; responsavel_id: string | null; sheets_row_index: number | null; ultima_atividade: string | null; updated_at: string | null; whatsapp: string | null }
        Insert: { created_at?: string | null; crm?: boolean | null; data_entrada?: string | null; disparo?: boolean | null; email?: string | null; enviado?: boolean | null; erro?: string | null; fase?: string; follow_up_01?: boolean | null; follow_up_02?: boolean | null; follow_up_03?: boolean | null; grupo_oferta?: boolean | null; id?: string; lancamento_id: string; matriculado?: boolean | null; no_grupo?: boolean | null; nome: string; observacoes?: string | null; responsavel_id?: string | null; sheets_row_index?: number | null; ultima_atividade?: string | null; updated_at?: string | null; whatsapp?: string | null }
        Update: { created_at?: string | null; crm?: boolean | null; data_entrada?: string | null; disparo?: boolean | null; email?: string | null; enviado?: boolean | null; erro?: string | null; fase?: string; follow_up_01?: boolean | null; follow_up_02?: boolean | null; follow_up_03?: boolean | null; grupo_oferta?: boolean | null; id?: string; lancamento_id?: string; matriculado?: boolean | null; no_grupo?: boolean | null; nome?: string; observacoes?: string | null; responsavel_id?: string | null; sheets_row_index?: number | null; ultima_atividade?: string | null; updated_at?: string | null; whatsapp?: string | null }
        Relationships: [{ foreignKeyName: "lancamento_leads_lancamento_id_fkey"; columns: ["lancamento_id"]; isOneToOne: false; referencedRelation: "lancamentos"; referencedColumns: ["id"] }]
      }
      lancamentos: {
        Row: { ativo: boolean | null; created_at: string | null; data_live: string | null; descricao: string | null; id: string; meta_leads: number | null; meta_matriculas: number | null; nome: string; sheets_id: string | null; status: string | null; updated_at: string | null }
        Insert: { ativo?: boolean | null; created_at?: string | null; data_live?: string | null; descricao?: string | null; id?: string; meta_leads?: number | null; meta_matriculas?: number | null; nome: string; sheets_id?: string | null; status?: string | null; updated_at?: string | null }
        Update: { ativo?: boolean | null; created_at?: string | null; data_live?: string | null; descricao?: string | null; id?: string; meta_leads?: number | null; meta_matriculas?: number | null; nome?: string; sheets_id?: string | null; status?: string | null; updated_at?: string | null }
        Relationships: []
      }
      leads: {
        Row: { created_at: string | null; email: string | null; id: string; lancamento_id: string | null; nome: string; observacoes: string | null; origem: string | null; produto: string | null; responsavel_id: string | null; status: string | null; telefone: string | null; turma_id: string | null; ultima_atividade: string | null; valor_potencial: number | null; whatsapp: string | null }
        Insert: { created_at?: string | null; email?: string | null; id?: string; lancamento_id?: string | null; nome: string; observacoes?: string | null; origem?: string | null; produto?: string | null; responsavel_id?: string | null; status?: string | null; telefone?: string | null; turma_id?: string | null; ultima_atividade?: string | null; valor_potencial?: number | null; whatsapp?: string | null }
        Update: { created_at?: string | null; email?: string | null; id?: string; lancamento_id?: string | null; nome?: string; observacoes?: string | null; origem?: string | null; produto?: string | null; responsavel_id?: string | null; status?: string | null; telefone?: string | null; turma_id?: string | null; ultima_atividade?: string | null; valor_potencial?: number | null; whatsapp?: string | null }
        Relationships: [{ foreignKeyName: "leads_lancamento_id_fkey"; columns: ["lancamento_id"]; isOneToOne: false; referencedRelation: "lancamentos"; referencedColumns: ["id"] }, { foreignKeyName: "leads_turma_id_fkey"; columns: ["turma_id"]; isOneToOne: false; referencedRelation: "turmas"; referencedColumns: ["id"] }]
      }
      npa_evento_leads: {
        Row: { closer: boolean | null; created_at: string | null; data_entrada: string | null; email: string | null; erro: string | null; fase: string; follow_up_01: boolean | null; follow_up_02: boolean | null; follow_up_03: boolean | null; id: string; ingresso_pago: boolean | null; matriculado: boolean | null; nome: string; npa_evento_id: string; observacoes: string | null; presente_evento: boolean | null; responsavel_id: string | null; sheets_row_index: number | null; ultima_atividade: string | null; updated_at: string | null; valor_ingresso: number | null; valor_matricula: number | null; whatsapp: string | null }
        Insert: { closer?: boolean | null; created_at?: string | null; data_entrada?: string | null; email?: string | null; erro?: string | null; fase?: string; follow_up_01?: boolean | null; follow_up_02?: boolean | null; follow_up_03?: boolean | null; id?: string; ingresso_pago?: boolean | null; matriculado?: boolean | null; nome: string; npa_evento_id: string; observacoes?: string | null; presente_evento?: boolean | null; responsavel_id?: string | null; sheets_row_index?: number | null; ultima_atividade?: string | null; updated_at?: string | null; valor_ingresso?: number | null; valor_matricula?: number | null; whatsapp?: string | null }
        Update: { closer?: boolean | null; created_at?: string | null; data_entrada?: string | null; email?: string | null; erro?: string | null; fase?: string; follow_up_01?: boolean | null; follow_up_02?: boolean | null; follow_up_03?: boolean | null; id?: string; ingresso_pago?: boolean | null; matriculado?: boolean | null; nome?: string; npa_evento_id?: string; observacoes?: string | null; presente_evento?: boolean | null; responsavel_id?: string | null; sheets_row_index?: number | null; ultima_atividade?: string | null; updated_at?: string | null; valor_ingresso?: number | null; valor_matricula?: number | null; whatsapp?: string | null }
        Relationships: [{ foreignKeyName: "npa_leads_npa_evento_id_fkey"; columns: ["npa_evento_id"]; isOneToOne: false; referencedRelation: "npa_eventos"; referencedColumns: ["id"] }]
      }
      npa_eventos: {
        Row: { ativo: boolean | null; created_at: string | null; data_evento: string | null; descricao: string | null; id: string; local: string | null; meta_matriculas: number | null; nome: string; sheets_id: string | null; status: string | null; updated_at: string | null }
        Insert: { ativo?: boolean | null; created_at?: string | null; data_evento?: string | null; descricao?: string | null; id?: string; local?: string | null; meta_matriculas?: number | null; nome: string; sheets_id?: string | null; status?: string | null; updated_at?: string | null }
        Update: { ativo?: boolean | null; created_at?: string | null; data_evento?: string | null; descricao?: string | null; id?: string; local?: string | null; meta_matriculas?: number | null; nome?: string; sheets_id?: string | null; status?: string | null; updated_at?: string | null }
        Relationships: []
      }
      npa_eventos_log: {
        Row: { created_at: string | null; evento: string; id: string; npa_evento_id: string | null; payload: Json | null }
        Insert: { created_at?: string | null; evento: string; id?: string; npa_evento_id?: string | null; payload?: Json | null }
        Update: { created_at?: string | null; evento?: string; id?: string; npa_evento_id?: string | null; payload?: Json | null }
        Relationships: [{ foreignKeyName: "npa_eventos_log_npa_evento_id_fkey"; columns: ["npa_evento_id"]; isOneToOne: false; referencedRelation: "npa_eventos"; referencedColumns: ["id"] }]
      }
      pagamentos: {
        Row: { aluno_id: string | null; created_at: string | null; data_pagamento: string | null; data_vencimento: string | null; id: string; mes_referencia: string; numero_parcela: number | null; observacoes: string | null; produto: string | null; status: string | null; turma_id: string | null; updated_at: string | null; valor: number | null }
        Insert: { aluno_id?: string | null; created_at?: string | null; data_pagamento?: string | null; data_vencimento?: string | null; id?: string; mes_referencia: string; numero_parcela?: number | null; observacoes?: string | null; produto?: string | null; status?: string | null; turma_id?: string | null; updated_at?: string | null; valor?: number | null }
        Update: { aluno_id?: string | null; created_at?: string | null; data_pagamento?: string | null; data_vencimento?: string | null; id?: string; mes_referencia?: string; numero_parcela?: number | null; observacoes?: string | null; produto?: string | null; status?: string | null; turma_id?: string | null; updated_at?: string | null; valor?: number | null }
        Relationships: [{ foreignKeyName: "pagamentos_aluno_id_fkey"; columns: ["aluno_id"]; isOneToOne: false; referencedRelation: "alunos"; referencedColumns: ["id"] }, { foreignKeyName: "pagamentos_turma_id_fkey"; columns: ["turma_id"]; isOneToOne: false; referencedRelation: "turmas"; referencedColumns: ["id"] }]
      }
      profiles: {
        Row: { ativo: boolean; avatar: string | null; cor: string; created_at: string; email: string; id: string; nome: string; updated_at: string }
        Insert: { ativo?: boolean; avatar?: string | null; cor?: string; created_at?: string; email: string; id?: string; nome: string; updated_at?: string }
        Update: { ativo?: boolean; avatar?: string | null; cor?: string; created_at?: string; email?: string; id?: string; nome?: string; updated_at?: string }
        Relationships: []
      }
      subtarefas: {
        Row: { concluida: boolean | null; created_at: string | null; id: string; tarefa_id: string | null; titulo: string }
        Insert: { concluida?: boolean | null; created_at?: string | null; id?: string; tarefa_id?: string | null; titulo: string }
        Update: { concluida?: boolean | null; created_at?: string | null; id?: string; tarefa_id?: string | null; titulo?: string }
        Relationships: [{ foreignKeyName: "subtarefas_tarefa_id_fkey"; columns: ["tarefa_id"]; isOneToOne: false; referencedRelation: "tarefas"; referencedColumns: ["id"] }]
      }
      tarefas: {
        Row: { categoria: string | null; created_at: string | null; created_by: string | null; data_inicio: string | null; descricao: string | null; id: string; pagina: string | null; prazo: string | null; prioridade: string | null; responsaveis: string[] | null; responsavel_id: string | null; status: string | null; tags: string[] | null; tipo: string | null; titulo: string; updated_at: string | null }
        Insert: { categoria?: string | null; created_at?: string | null; created_by?: string | null; data_inicio?: string | null; descricao?: string | null; id?: string; pagina?: string | null; prazo?: string | null; prioridade?: string | null; responsaveis?: string[] | null; responsavel_id?: string | null; status?: string | null; tags?: string[] | null; tipo?: string | null; titulo: string; updated_at?: string | null }
        Update: { categoria?: string | null; created_at?: string | null; created_by?: string | null; data_inicio?: string | null; descricao?: string | null; id?: string; pagina?: string | null; prazo?: string | null; prioridade?: string | null; responsaveis?: string[] | null; responsavel_id?: string | null; status?: string | null; tags?: string[] | null; tipo?: string | null; titulo?: string; updated_at?: string | null }
        Relationships: []
      }
      tarefas_checklists: {
        Row: { concluido: boolean | null; created_at: string | null; id: string; ordem: number | null; tarefa_id: string | null; texto: string }
        Insert: { concluido?: boolean | null; created_at?: string | null; id?: string; ordem?: number | null; tarefa_id?: string | null; texto: string }
        Update: { concluido?: boolean | null; created_at?: string | null; id?: string; ordem?: number | null; tarefa_id?: string | null; texto?: string }
        Relationships: [{ foreignKeyName: "tarefas_checklists_tarefa_id_fkey"; columns: ["tarefa_id"]; isOneToOne: false; referencedRelation: "tarefas"; referencedColumns: ["id"] }]
      }
      tarefas_comentarios: {
        Row: { autor_id: string | null; created_at: string | null; id: string; tarefa_id: string | null; texto: string }
        Insert: { autor_id?: string | null; created_at?: string | null; id?: string; tarefa_id?: string | null; texto: string }
        Update: { autor_id?: string | null; created_at?: string | null; id?: string; tarefa_id?: string | null; texto?: string }
        Relationships: [{ foreignKeyName: "tarefas_comentarios_tarefa_id_fkey"; columns: ["tarefa_id"]; isOneToOne: false; referencedRelation: "tarefas"; referencedColumns: ["id"] }]
      }
      tarefas_etapas: {
        Row: { created_at: string | null; desbloqueada: boolean | null; descricao: string | null; id: string; ordem: number; prazo: string | null; responsavel: string | null; status: string | null; tarefa_id: string | null; titulo: string }
        Insert: { created_at?: string | null; desbloqueada?: boolean | null; descricao?: string | null; id?: string; ordem?: number; prazo?: string | null; responsavel?: string | null; status?: string | null; tarefa_id?: string | null; titulo: string }
        Update: { created_at?: string | null; desbloqueada?: boolean | null; descricao?: string | null; id?: string; ordem?: number; prazo?: string | null; responsavel?: string | null; status?: string | null; tarefa_id?: string | null; titulo?: string }
        Relationships: [{ foreignKeyName: "tarefas_etapas_tarefa_id_fkey"; columns: ["tarefa_id"]; isOneToOne: false; referencedRelation: "tarefas"; referencedColumns: ["id"] }]
      }
      turmas: {
        Row: { created_at: string | null; data_fim: string | null; data_inicio: string | null; descricao: string | null; dia_vencimento: number | null; id: string; nome: string; produto: string | null; tipo: string; total_mensalidades: number | null; vagas: number | null; valor_mensalidade: number | null }
        Insert: { created_at?: string | null; data_fim?: string | null; data_inicio?: string | null; descricao?: string | null; dia_vencimento?: number | null; id?: string; nome: string; produto?: string | null; tipo: string; total_mensalidades?: number | null; vagas?: number | null; valor_mensalidade?: number | null }
        Update: { created_at?: string | null; data_fim?: string | null; data_inicio?: string | null; descricao?: string | null; dia_vencimento?: number | null; id?: string; nome?: string; produto?: string | null; tipo?: string; total_mensalidades?: number | null; vagas?: number | null; valor_mensalidade?: number | null }
        Relationships: []
      }
      user_roles: {
        Row: { id: string; role: Database["public"]["Enums"]["app_role"]; user_id: string }
        Insert: { id?: string; role?: Database["public"]["Enums"]["app_role"]; user_id: string }
        Update: { id?: string; role?: Database["public"]["Enums"]["app_role"]; user_id?: string }
        Relationships: []
      }
    }
    Views: {
      alunos_financeiro: {
        Row: { alunos_ativos: number | null; alunos_inadimplentes: number | null; ltv_potencial: number | null; produto: string | null; receita_mensal_atual: number | null }
        Relationships: []
      }
      dashboard_metricas: {
        Row: { leads_direto: number | null; leads_em_risco: number | null; leads_lancamento: number | null; leads_npa: number | null; receita_potencial_funil: number | null; valor_em_risco: number | null }
        Relationships: []
      }
      financeiro_resumo: {
        Row: { alunos_ativos: number | null; alunos_cancelados: number | null; alunos_concluidos: number | null; alunos_inadimplentes: number | null; data_fim: string | null; data_inicio: string | null; dia_vencimento: number | null; previsao_mes_atual: number | null; produto: string | null; receita_mes_atual: number | null; total_alunos: number | null; total_atrasado: number | null; total_em_aberto: number | null; total_mensalidades: number | null; total_recebido: number | null; turma_id: string | null; turma_nome: string | null; valor_mensalidade: number | null }
        Relationships: []
      }
      lancamento_kanban: {
        Row: { fase: string | null; lancamento_id: string | null; lancamento_nome: string | null; lancamento_status: string | null; matriculados: number | null; total: number | null }
        Relationships: []
      }
      npa_kanban: {
        Row: { evento_nome: string | null; evento_status: string | null; fase: string | null; npa_evento_id: string | null; receita_ingressos: number | null; receita_matriculas: number | null; total: number | null }
        Relationships: []
      }
    }
    Functions: {
      has_role: { Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string }; Returns: boolean }
      marcar_pagamentos_atrasados: { Args: Record<PropertyKey, never>; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "vendedor"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R } ? R : never
  : never

export type TablesInsert
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I } ? I : never
  : never

export type TablesUpdate
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U } ? U : never
  : never

export type Enums
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  graphql_public: { Enums: {} },
  public: { Enums: { app_role: ["admin", "vendedor"] } },
} as const
