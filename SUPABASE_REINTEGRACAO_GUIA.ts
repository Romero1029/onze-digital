// GUIA DE REINTEGRAÇÃO SUPABASE - Aplicar estas mudanças em cada componente

// ============================================
// PIPELINE.tsx (Leads Diretos)
// ============================================
// Mudar de: useLeads() context
// Para: const leads = await supabase.from('leads').select('*').eq('origem', 'Direto')
const loadDirectLeads = async () => {
  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('origem', 'Direto')
    .order('created_at', { ascending: false });
  return data;
};

// ============================================
// LANCAMENTO30.tsx
// ============================================
// Mudar de: lancamento_30_leads table
// Para: leads table com origem filter
const loadLancamentoLeads = async (lancamentoTurma: string) => {
  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('origem', 'Lancamento')
    .order('created_at', { ascending: false });
  return data;
};

// ============================================
// NPAO VERVIEW.tsx
// ============================================
// Mudar de: npa_${turma}_leads tables
// Para: leads table com origem filter
const loadNpaLeads = async (npaTurma: string) => {
  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('origem', 'NPA')
    .order('created_at', { ascending: false });
  return data;
};

// ============================================
// FINANCEIRO.tsx
// ============================================
// Manter: turmas, alunos, pagamentos como novo design
const loadFinancialData = async () => {
  const [turmasRes, alunosRes, pagamentosRes] = await Promise.all([
    supabase.from('turmas').select('*'),
    supabase.from('alunos').select('*'),
    supabase.from('pagamentos').select('*'),
  ]);
  return { turmas: turmasRes.data, alunos: alunosRes.data, pagamentos: pagamentosRes.data };
};

// ============================================
// PRODUTIVIDADEAVANCADA.tsx
// ============================================
// Usar: tarefas table com pagina='produtividade'
const loadProductivityTasks = async () => {
  const { data } = await supabase
    .from('tarefas')
    .select('*')
    .eq('pagina', 'produtividade')
    .order('created_at', { ascending: false });
  return data;
};

// ============================================
// RODRYGO.tsx
// ============================================
// Usar: tarefas table com pagina='rodrygo'
const loadRodrygoTasks = async () => {
  const { data } = await supabase
    .from('tarefas')
    .select('*')
    .eq('pagina', 'rodrygo')
    .order('created_at', { ascending: false });
  return data;
};

// ============================================
// MAPAMENTAL.tsx
// ============================================
// Usar: mind_map_nodes and mind_map_edges
const loadMindMapData = async (userId: string) => {
  const [nodesRes, edgesRes] = await Promise.all([
    supabase.from('mind_map_nodes').select('*').eq('user_id', userId),
    supabase.from('mind_map_edges').select('*'),
  ]);
  return { nodes: nodesRes.data, edges: edgesRes.data };
};

// ============================================
// CHAT.tsx
// ============================================
// Usar: chat_messages table
const loadChatMessages = async () => {
  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);
  return data;
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================
// Para LEADS (Pipeline, Lancamento, NPA, Dashboard)
const leadsChannel = supabase.channel('realtime-leads')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
    console.log('Leads updated:', payload);
    loadLeads(); // Refetch
  })
  .subscribe();

// Para TAREFAS (Produtividade, Rodrygo)
const tarefasChannel = supabase.channel('realtime-tarefas')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, (payload) => {
    console.log('Tarefas updated:', payload);
    loadTasks();
  })
  .subscribe();

// Para CHAT
const chatChannel = supabase.channel('realtime-chat')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (payload) => {
    console.log('Chat updated:', payload);
    loadMessages();
  })
  .subscribe();

// Para MAPA MENTAL
const mindMapChannel = supabase.channel('realtime-mind-map')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'mind_map_nodes' }, () => loadMindMap())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'mind_map_edges' }, () => loadMindMap())
  .subscribe();

// ============================================
// CRUD OPERAÇÕES BÁSICAS
// ============================================

// CREATE LEAD
async function createLead(lead: any) {
  const { error } = await supabase.from('leads').insert([lead]);
  if (error) throw error;
}

// UPDATE LEAD
async function updateLead(id: string, updates: any) {
  const { error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// DELETE LEAD
async function deleteLead(id: string) {
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// CREATE TASK
async function createTask(task: any) {
  const { error } = await supabase.from('tarefas').insert([task]);
  if (error) throw error;
}

// UPDATE TASK
async function updateTask(id: string, updates: any) {
  const { error } = await supabase
    .from('tarefas')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// DELETE TASK
async function deleteTask(id: string) {
  const { error } = await supabase
    .from('tarefas')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// TABLE SCHEMAS (Referência)
// ============================================
/*
leads:
  - id (UUID)
  - nome (string)
  - whatsapp (string)
  - email (string)
  - origem (enum: 'Direto', 'Lancamento', 'NPA')
  - turma_id (UUID fk to turmas)
  - status (string)
  - responsavel_id (UUID fk to users)
  - observacoes (text)
  - created_at (timestamp)

tarefas:
  - id (UUID)
  - titulo (string)
  - descricao (text)
  - status (enum: 'a_fazer', 'em_andamento', 'revisao', 'concluido')
  - prioridade (enum: 'alta', 'media', 'baixa')
  - responsavel_id (UUID)
  - prazo (date)
  - categoria (string)
  - pagina (string) -- 'produtividade' ou 'rodrygo'
  - created_at (timestamp)

turmas:
  - id (UUID)
  - nome (string)
  - tipo (string)
  - data_inicio (date)
  - created_at (timestamp)

alunos:
  - id (UUID)
  - nome (string)
  - whatsapp (string)
  - email (string)
  - turma_id (UUID fk to turmas)
  - dia_vencimento (int: 10 ou 20)
  - valor_mensalidade (numeric)
  - created_at (timestamp)

pagamentos:
  - id (UUID)
  - aluno_id (UUID fk to alunos)
  - mes_referencia (string)
  - status (enum: 'pago', 'pendente', 'atrasado')
  - data_pagamento (date)
  - valor (numeric)
  - created_at (timestamp)

chat_messages:
  - id (UUID)
  - user_id (UUID)
  - conteudo (text)
  - created_at (timestamp)

mind_map_nodes:
  - id (UUID)
  - title (string)
  - type (string)
  - position_x (numeric)
  - position_y (numeric)
  - color (string)
  - user_id (UUID)
  - created_at (timestamp)

mind_map_edges:
  - id (UUID)
  - source_id (UUID fk to mind_map_nodes)
  - target_id (UUID fk to mind_map_nodes)
  - label (string)
  - style (string)
  - created_at (timestamp)
*/
