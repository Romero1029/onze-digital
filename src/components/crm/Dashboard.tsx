import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, TrendingUp, Target, AlertTriangle, ArrowRight, DollarSign,
  TrendingDown, Zap, BarChart3, Clock, CheckCircle2, AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter, isPast, format, differenceInHours } from 'date-fns';

type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year';

interface Lead {
  id: string; nome: string; whatsapp?: string; email?: string;
  produto: 'direto' | 'lancamento' | 'npa'; etapa: string;
  responsavel_id?: string; ultima_atividade: string;
  valor_potencial: number; created_at: string;
}
interface Aluno {
  id: string; nome: string; produto: 'psicanalise' | 'numerologia';
  status: 'ativo' | 'inadimplente' | 'cancelado' | 'concluido';
  data_inicio: string; origem_lead: 'direto' | 'lancamento' | 'npa'; created_at: string;
}
interface Pagamento {
  id: string; aluno_id: string; valor: number; mes_referencia: string;
  status: 'pago' | 'pendente' | 'atrasado'; data_pagamento?: string; created_at: string;
}
interface Task {
  id: string; titulo: string; status: string; prioridade: string;
  responsavel_id?: string; responsaveis?: string[]; prazo?: string;
  categoria: string; pagina: string; created_at: string;
}
interface Turma {
  id: string; nome: string; produto: 'psicanalise' | 'numerologia';
  data_inicio?: string; data_fim?: string; status: string;
}

function isTruthyFlag(value: unknown) {
  return value === true || String(value || '').trim().toUpperCase() === 'SIM';
}

function getLancamentoStage(lead: any) {
  if (lead.fase === 'matricula' || isTruthyFlag(lead.matriculado)) return 'matricula';
  if (lead.fase === 'follow_up_03' || isTruthyFlag(lead.follow_up_03)) return 'followUp03';
  if (lead.fase === 'follow_up_02' || isTruthyFlag(lead.follow_up_02)) return 'followUp02';
  if (lead.fase === 'follow_up_01' || isTruthyFlag(lead.follow_up_01)) return 'followUp01';
  if (lead.fase === 'grupo_oferta' || isTruthyFlag(lead.grupo_oferta)) return 'grupoOferta';
  if (lead.fase === 'grupo_lancamento' || lead.fase === 'no_grupo' || isTruthyFlag(lead.no_grupo)) return 'grupoLancamento';
  return 'planilha';
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent = 'blue', trend,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: 'blue' | 'green' | 'red' | 'purple' | 'amber';
  trend?: { value: number; positive: boolean };
}) {
  const colors = {
    blue:   { border: 'border-l-blue-500',   icon: 'text-blue-500',   bg: 'bg-blue-50' },
    green:  { border: 'border-l-emerald-500', icon: 'text-emerald-500',bg: 'bg-emerald-50' },
    red:    { border: 'border-l-red-500',     icon: 'text-red-500',    bg: 'bg-red-50' },
    purple: { border: 'border-l-purple-500',  icon: 'text-purple-500', bg: 'bg-purple-50' },
    amber:  { border: 'border-l-amber-500',   icon: 'text-amber-500',  bg: 'bg-amber-50' },
  }[accent];

  return (
    <Card className={`border-l-4 ${colors.border} shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1 leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={18} className={colors.icon} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Funnel Bar ──────────────────────────────────────────────────────────────

function FunnelBar({
  label, count, total, isLast = false, accent = '#6366f1',
}: {
  label: string; count: number; total: number;
  isLast?: boolean; accent?: string;
}) {
  const pct = total > 0 ? Math.max((count / total) * 100, count > 0 ? 4 : 0) : 0;
  return (
    <div className="flex items-center gap-3 group">
      <div className="w-28 sm:w-36 text-right shrink-0">
        <span className={`text-xs font-medium ${isLast ? 'text-emerald-700' : 'text-muted-foreground'}`}>{label}</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: isLast ? '#10b981' : accent + 'cc' }}
          />
        </div>
        <span className={`text-sm font-semibold w-8 text-right tabular-nums ${isLast ? 'text-emerald-700' : 'text-foreground'}`}>
          {count}
        </span>
        {total > 0 && count > 0 && (
          <span className="text-xs text-muted-foreground w-9 tabular-nums">
            {Math.round((count / total) * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Dashboard() {
  const { user, users } = useAuth();
  const [timeFilter, setTimeFilter]           = useState<TimeFilter>('all');
  const [leads, setLeads]                     = useState<Lead[]>([]);
  const [alunos, setAlunos]                   = useState<Aluno[]>([]);
  const [pagamentos, setPagamentos]           = useState<Pagamento[]>([]);
  const [tasks, setTasks]                     = useState<Task[]>([]);
  const [turmas, setTurmas]                   = useState<Turma[]>([]);
  const [lancamentosAtivos, setLancamentosAtivos] = useState<any[]>([]);
  const [lancamentosLeads, setLancamentosLeads]   = useState<any[]>([]);
  const [npaEventos, setNpaEventos]           = useState<any[]>([]);
  const [npaLeads, setNpaLeads]               = useState<any[]>([]);
  const [selectedLancamentoId, setSelectedLancamentoId] = useState('');
  const [selectedNpaId, setSelectedNpaId]     = useState('');
  const [loading, setLoading]                 = useState(true);
  const isAdmin = user?.tipo === 'admin';
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async (showLoading = false) => {
      if (showLoading) setLoading(true);

      const [leadsRes, alunosRes, pagamentosRes, tasksRes, turmasRes, lancamentosRes, npaEventosRes] = await Promise.all([
        supabase.from('leads').select('id, nome, produto, etapa:status, responsavel_id, ultima_atividade, valor_potencial, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('alunos').select('id, nome, produto, status, data_inicio, origem_lead, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('pagamentos').select('id, aluno_id, valor, mes_referencia, status, data_pagamento, created_at').order('created_at', { ascending: false }).limit(1000),
        supabase.from('tarefas').select('id, titulo, status, prioridade, responsavel_id, responsaveis, prazo, categoria, pagina, created_at').order('prazo').limit(50),
        supabase.from('turmas').select('id, nome, produto, data_inicio, data_fim, status'),
        supabase.from('lancamentos').select('id, nome, ativo, created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('npa_eventos').select('id, nome, ativo').order('created_at', { ascending: false }).limit(20),
      ]);

      if (leadsRes.data)      setLeads(leadsRes.data as Lead[]);
      if (alunosRes.data)     setAlunos(alunosRes.data as Aluno[]);
      if (pagamentosRes.data) setPagamentos(pagamentosRes.data as Pagamento[]);
      if (tasksRes.data)      setTasks(tasksRes.data as Task[]);
      if (turmasRes.data)     setTurmas(turmasRes.data as Turma[]);

      const sortedLancamentos = lancamentosRes.data || [];
      const allNpas = npaEventosRes.data || [];
      setLancamentosAtivos(sortedLancamentos);
      setNpaEventos(allNpas);
      setSelectedLancamentoId(prev => prev || sortedLancamentos[0]?.id || '');
      setSelectedNpaId(prev => prev || allNpas[0]?.id || '');

      if (showLoading) setLoading(false);
    };

    load(true);

    const triggerReload = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => load(false), 2000);
    };

    const channel = supabase.channel('dashboard-unified')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, triggerReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alunos' }, triggerReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, triggerReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, triggerReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamento_leads' }, triggerReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'npa_eventos' }, triggerReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'npa_evento_leads' }, triggerReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, triggerReload)
      .subscribe();

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!selectedLancamentoId) return;
    const load = async () => {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data: page } = await supabase.from('lancamento_leads')
          .select('id, lancamento_id, fase, no_grupo, grupo_oferta, follow_up_01, follow_up_02, follow_up_03, matriculado')
          .eq('lancamento_id', selectedLancamentoId)
          .range(from, from + 999);
        if (!page || page.length === 0) break;
        all.push(...page);
        if (page.length < 1000) break;
        from += 1000;
      }
      setLancamentosLeads(all);
    };
    load();
  }, [selectedLancamentoId]);

  useEffect(() => {
    if (!selectedNpaId) return;
    const load = async () => {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data: page } = await supabase.from('npa_evento_leads')
          .select('id, npa_evento_id, fase, matriculado')
          .eq('npa_evento_id', selectedNpaId)
          .range(from, from + 999);
        if (!page || page.length === 0) break;
        all.push(...page);
        if (page.length < 1000) break;
        from += 1000;
      }
      setNpaLeads(all);
    };
    load();
  }, [selectedNpaId]);

  const getFilterStartDate = (f: TimeFilter): Date | null => {
    const now = new Date();
    if (f === 'today') return startOfDay(now);
    if (f === 'week')  return startOfWeek(now, { weekStartsOn: 1 });
    if (f === 'month') return startOfMonth(now);
    if (f === 'year')  return startOfYear(now);
    return null;
  };

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (!isAdmin) result = result.filter(l => l.responsavel_id === user?.id);
    const startDate = getFilterStartDate(timeFilter);
    if (!startDate) return result;
    return result.filter(l => isAfter(new Date(l.created_at), startDate) || new Date(l.created_at).getTime() === startDate.getTime());
  }, [leads, timeFilter, isAdmin, user?.id]);

  const filteredAlunos = useMemo(() => {
    const startDate = getFilterStartDate(timeFilter);
    if (!startDate) return alunos;
    return alunos.filter(a => isAfter(new Date(a.created_at), startDate) || new Date(a.created_at).getTime() === startDate.getTime());
  }, [alunos, timeFilter]);

  // ── Derived metrics ───────────────────────────────────────────────────────

  const alunosAtivos = filteredAlunos.filter(a => a.status === 'ativo').length;
  const alunoInadimplentesIds = new Set(
    pagamentos.filter(p => p.status === 'atrasado').map(p => p.aluno_id)
  );
  const inadimplenteCount = alunos.filter(a => a.status === 'ativo' && alunoInadimplentesIds.has(a.id)).length;

  const receitaRecorrente = useMemo(() => {
    const ativos = filteredAlunos.filter(a => a.status === 'ativo');
    const total = pagamentos.filter(p => p.status === 'pago' && ativos.some(a => a.id === p.aluno_id)).reduce((s, p) => s + p.valor, 0);
    return total;
  }, [filteredAlunos, pagamentos]);

  const receitaPotencial = useMemo(() =>
    filteredLeads.filter(l => l.etapa !== 'matricula').reduce((s, l) => s + l.valor_potencial, 0),
  [filteredLeads]);

  const leadsParados = useMemo(() =>
    filteredLeads.filter(l =>
      ['closer', 'follow_up_01', 'follow_up_02', 'follow_up_03'].includes(l.etapa) &&
      differenceInHours(new Date(), new Date(l.ultima_atividade)) > 72
    ),
  [filteredLeads]);

  const totalMatriculas = filteredLeads.filter(l => l.etapa === 'matricula').length;
  const txConversaoGeral = filteredLeads.length > 0
    ? Math.round((totalMatriculas / filteredLeads.length) * 100)
    : 0;

  const mesAtualStr = new Date().toISOString().slice(0, 7);
  const receitaMesAtual = pagamentos
    .filter(p => p.status === 'pago' && p.mes_referencia?.startsWith(mesAtualStr))
    .reduce((s, p) => s + p.valor, 0);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v);

  // ── Funnel data ───────────────────────────────────────────────────────────

  const getFunilData = (produto: 'direto' | 'lancamento' | 'npa') => {
    if (produto === 'lancamento') {
      const ll = lancamentosLeads.filter(l => l.lancamento_id === selectedLancamentoId);
      return {
        planilha: ll.filter(l => getLancamentoStage(l) === 'planilha').length,
        grupoLancamento: ll.filter(l => getLancamentoStage(l) === 'grupoLancamento').length,
        grupoOferta: ll.filter(l => getLancamentoStage(l) === 'grupoOferta').length,
        followUp01: ll.filter(l => getLancamentoStage(l) === 'followUp01').length,
        followUp02: ll.filter(l => getLancamentoStage(l) === 'followUp02').length,
        followUp03: ll.filter(l => getLancamentoStage(l) === 'followUp03').length,
        matricula: ll.filter(l => getLancamentoStage(l) === 'matricula').length,
      };
    }
    if (produto === 'npa') {
      const nl = npaLeads.filter(l => l.npa_evento_id === selectedNpaId);
      return {
        novo: nl.filter(l => l.fase === 'novo').length,
        ingressoPago: nl.filter(l => l.fase === 'ingresso_pago').length,
        noGrupo: nl.filter(l => l.fase === 'no_grupo').length,
        confirmado: nl.filter(l => l.fase === 'confirmado').length,
        evento: nl.filter(l => l.fase === 'evento').length,
        closer: nl.filter(l => l.fase === 'closer').length,
        followUp01: nl.filter(l => l.fase === 'follow_up_01').length,
        followUp02: nl.filter(l => l.fase === 'follow_up_02').length,
        followUp03: nl.filter(l => l.fase === 'follow_up_03').length,
        matricula: nl.filter(l => l.fase === 'matricula').length,
      };
    }
    const pl = filteredLeads.filter(l => l.produto === 'direto');
    return {
      novo: pl.filter(l => l.etapa === 'novo').length,
      sdr: pl.filter(l => l.etapa === 'sdr').length,
      closer: pl.filter(l => l.etapa === 'closer').length,
      followUp01: pl.filter(l => l.etapa === 'follow_up_01').length,
      followUp02: pl.filter(l => l.etapa === 'follow_up_02').length,
      followUp03: pl.filter(l => l.etapa === 'follow_up_03').length,
      matricula: pl.filter(l => l.etapa === 'matricula').length,
    };
  };

  // ── Team stats (dynamic from users context) ───────────────────────────────

  const teamMembers = useMemo(() =>
    users.filter(u => u.ativo && u.tipo !== 'admin'),
  [users]);

  const getColaboradorStats = (colaboradorId: string) => {
    const colabLeads = filteredLeads.filter(l => l.responsavel_id === colaboradorId);
    const matriculas = colabLeads.filter(l => l.etapa === 'matricula').length;
    const conversao  = colabLeads.length > 0 ? Math.round((matriculas / colabLeads.length) * 100) : 0;
    const colabTasks = tasks.filter(t => t.responsavel_id === colaboradorId || (t.responsaveis?.includes(colaboradorId)));
    return {
      leads: colabLeads.length,
      matriculas,
      conversao,
      tarefasPendentes:   colabTasks.filter(t => t.status === 'a_fazer').length,
      tarefasEmAndamento: colabTasks.filter(t => t.status === 'em_andamento').length,
      proximaTarefa: colabTasks.filter(t => t.status !== 'concluido').sort((a, b) => new Date(a.prazo || '9999').getTime() - new Date(b.prazo || '9999').getTime())[0],
    };
  };

  const tarefasCriticas = tasks.filter(t => t.status !== 'concluido' && t.prazo && isPast(new Date(t.prazo))).slice(0, 4);

  // ── Financial health ──────────────────────────────────────────────────────

  const getSaudeFinanceira = (produto: 'psicanalise' | 'numerologia') => {
    const produtoAlunos = alunos.filter(a => a.produto === produto && a.status === 'ativo');
    const alunosIds = produtoAlunos.map(a => a.id);
    const receitaMes = pagamentos.filter(p => p.status === 'pago' && alunosIds.includes(p.aluno_id) && p.mes_referencia?.startsWith(mesAtualStr)).reduce((s, p) => s + p.valor, 0);
    const inadimplentes = produtoAlunos.filter(a => pagamentos.some(p => p.aluno_id === a.id && p.status === 'atrasado')).length;
    const txInadimplencia = produtoAlunos.length > 0 ? Math.round((inadimplentes / produtoAlunos.length) * 100) : 0;
    const proximaTurma = turmas.filter(t => t.produto === produto && t.status === 'ativa').sort((a, b) => new Date(a.data_inicio || '').getTime() - new Date(b.data_inicio || '').getTime())[0];
    return { ativos: produtoAlunos.length, receitaMes, inadimplentes, txInadimplencia, proximaTurma };
  };

  if (loading) return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Card key={i} className="p-4 animate-pulse"><div className="h-16 bg-muted rounded"></div></Card>)}
      </div>
    </div>
  );

  const funnelConfigs = [
    {
      titulo: 'Lead Direto', produto: 'direto' as const, accent: '#3b82f6',
      etapas: [['Novo','novo'],['SDR','sdr'],['Closer','closer'],['Follow-up 01','followUp01'],['Follow-up 02','followUp02'],['Follow-up 03','followUp03'],['Matrícula','matricula']],
      total: filteredLeads.filter(l => l.produto === 'direto').length,
    },
    {
      titulo: 'Lançamento', produto: 'lancamento' as const, accent: '#8b5cf6', isSelect: true,
      etapas: [['Planilha','planilha'],['Grupo Lançamento','grupoLancamento'],['Grupo Oferta','grupoOferta'],['Follow-up 01','followUp01'],['Follow-up 02','followUp02'],['Follow-up 03','followUp03'],['Matrícula','matricula']],
      total: lancamentosLeads.filter(l => l.lancamento_id === selectedLancamentoId).length,
    },
    {
      titulo: 'NPA', produto: 'npa' as const, accent: '#f59e0b', isSelectNpa: true,
      etapas: [['Novo','novo'],['Ingresso Pago','ingressoPago'],['No Grupo','noGrupo'],['Confirmado','confirmado'],['Evento','evento'],['Closer','closer'],['Follow-up 01','followUp01'],['Follow-up 02','followUp02'],['Follow-up 03','followUp03'],['Matrícula','matricula']],
      total: npaLeads.filter(l => l.npa_evento_id === selectedNpaId).length,
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-20 lg:pb-6 overflow-y-auto h-full">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? 'Visão executiva · dados em tempo real' : `Meus leads · ${filteredLeads.length} ativos`}</p>
        </div>
        <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receita do Mês"
          value={fmtK(receitaMesAtual)}
          sub={`Total pago em ${format(new Date(), 'MMM/yy')}`}
          icon={DollarSign}
          accent="green"
        />
        <KpiCard
          label="Potencial no Funil"
          value={fmtK(receitaPotencial)}
          sub={`${filteredLeads.filter(l => l.etapa !== 'matricula').length} leads ainda não convertidos`}
          icon={Target}
          accent="blue"
        />
        <KpiCard
          label="Alunos Ativos"
          value={alunosAtivos}
          sub={inadimplenteCount > 0 ? `${inadimplenteCount} inadimplentes` : 'Sem inadimplência'}
          icon={Users}
          accent={inadimplenteCount > 0 ? 'red' : 'green'}
        />
        <KpiCard
          label="Conversão Geral"
          value={`${txConversaoGeral}%`}
          sub={`${totalMatriculas} matrículas de ${filteredLeads.length} leads`}
          icon={TrendingUp}
          accent="purple"
        />
      </div>

      {/* ── Alert: leads parados ──────────────────────────────────────────── */}
      {leadsParados.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <div className="flex-1 text-sm text-amber-800">
                <span className="font-semibold">{leadsParados.length} leads parados</span> por mais de 72h —{' '}
                <span className="font-semibold">{fmtK(leadsParados.reduce((s, l) => s + l.valor_potencial, 0))}</span> em risco
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Funnels ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {funnelConfigs.map(({ titulo, produto, accent, etapas, total, isSelect, isSelectNpa }) => {
          const funil = getFunilData(produto);
          const matriculaCount = (funil as any)['matricula'] ?? 0;
          const txConv = total > 0 ? Math.round((matriculaCount / total) * 100) : 0;
          return (
            <Card key={produto} className="flex flex-col">
              <CardHeader className="pb-3">
                {isSelect ? (
                  <Select value={selectedLancamentoId} onValueChange={setSelectedLancamentoId}>
                    <SelectTrigger className="h-8 text-sm font-semibold border-0 shadow-none px-0 focus:ring-0 -ml-0.5">
                      <SelectValue placeholder="Selecionar lançamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {lancamentosAtivos.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : isSelectNpa ? (
                  <Select value={selectedNpaId} onValueChange={setSelectedNpaId}>
                    <SelectTrigger className="h-8 text-sm font-semibold border-0 shadow-none px-0 focus:ring-0 -ml-0.5">
                      <SelectValue placeholder="Selecionar NPA" />
                    </SelectTrigger>
                    <SelectContent>
                      {npaEventos.map(n => <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <CardTitle className="text-sm font-semibold">{titulo}</CardTitle>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="outline" className="text-xs">{total} leads</Badge>
                  {txConv > 0 && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                      {txConv}% conversão
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2.5">
                {etapas.map(([label, key], i) => (
                  <FunnelBar
                    key={key}
                    label={label}
                    count={(funil as any)[key] ?? 0}
                    total={total}
                    isLast={i === etapas.length - 1}
                    accent={accent}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Team + Financial ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Team performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users size={15} className="text-muted-foreground" /> Performance do Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {users.filter(u => u.ativo).map((u, idx) => {
              const stats = getColaboradorStats(u.id);
              const hasLeads = stats.leads > 0;
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: u.cor }}
                  >
                    {u.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-none truncate">{u.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{u.tipo}</p>
                  </div>
                  {hasLeads ? (
                    <div className="flex items-center gap-3 text-right shrink-0">
                      <div>
                        <p className="text-sm font-bold tabular-nums">{stats.leads}</p>
                        <p className="text-xs text-muted-foreground">Leads</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-600 tabular-nums">{stats.matriculas}</p>
                        <p className="text-xs text-muted-foreground">Conv.</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary tabular-nums">{stats.conversao}%</p>
                        <p className="text-xs text-muted-foreground">Taxa</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-right shrink-0">
                      <div>
                        <p className="text-sm font-bold text-amber-600 tabular-nums">{stats.tarefasPendentes}</p>
                        <p className="text-xs text-muted-foreground">A fazer</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-orange-500 tabular-nums">{stats.tarefasEmAndamento}</p>
                        <p className="text-xs text-muted-foreground">Em andamento</p>
                      </div>
                      {stats.proximaTarefa && (
                        <div className="text-right max-w-[100px]">
                          <p className="text-xs font-medium text-foreground truncate">{stats.proximaTarefa.titulo}</p>
                          <p className="text-xs text-muted-foreground">{stats.proximaTarefa.prazo ? format(new Date(stats.proximaTarefa.prazo), 'dd/MM') : '—'}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Critical tasks */}
            {tarefasCriticas.length > 0 && (
              <div className="mt-3 pt-3 border-t border-red-100">
                <p className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertCircle size={11}/> Tarefas atrasadas
                </p>
                <div className="space-y-1.5">
                  {tarefasCriticas.map(task => (
                    <div key={task.id} className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                      <p className="text-sm text-foreground truncate flex-1">{task.titulo}</p>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {task.prazo && <p className="text-xs text-red-500 font-medium">{format(new Date(task.prazo), 'dd/MM')}</p>}
                        <Badge variant="destructive" className="text-xs px-1.5">{task.prioridade}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 size={15} className="text-muted-foreground" /> Saúde Financeira
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="psicanalise">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="psicanalise">Psicanálise</TabsTrigger>
                <TabsTrigger value="numerologia">Numerologia</TabsTrigger>
              </TabsList>
              {(['psicanalise', 'numerologia'] as const).map(prod => {
                const saude = getSaudeFinanceira(prod);
                const txText = saude.txInadimplencia;
                return (
                  <TabsContent key={prod} value={prod} className="space-y-3 mt-0">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-2xl font-bold text-blue-700">{saude.ativos}</p>
                        <p className="text-xs text-blue-600 mt-0.5">Ativos</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                        <p className="text-lg font-bold text-emerald-700 leading-tight">{fmtK(saude.receitaMes)}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">Recebido mês</p>
                      </div>
                      <div className={`text-center p-3 rounded-xl border ${saude.inadimplentes > 0 ? 'bg-red-50 border-red-100' : 'bg-muted border-border'}`}>
                        <p className={`text-2xl font-bold ${saude.inadimplentes > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>{saude.inadimplentes}</p>
                        <p className={`text-xs mt-0.5 ${saude.inadimplentes > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>Inadimpl.</p>
                      </div>
                    </div>

                    {/* Inadimplência bar */}
                    {saude.ativos > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">Taxa de inadimplência</span>
                          <span className={`text-xs font-semibold ${txText > 10 ? 'text-red-600' : txText > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {txText}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${txText > 10 ? 'bg-red-500' : txText > 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(txText, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Next class */}
                    {saude.proximaTurma ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                          <Zap size={14} className="text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-purple-700 truncate">{saude.proximaTurma.nome}</p>
                          <p className="text-xs text-purple-500">
                            {saude.proximaTurma.data_inicio
                              ? format(new Date(saude.proximaTurma.data_inicio), 'dd/MM/yyyy')
                              : 'Data a definir'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-muted border text-xs text-muted-foreground text-center">
                        Nenhuma turma ativa
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
