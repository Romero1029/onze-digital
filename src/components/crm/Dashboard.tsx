import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, TrendingUp, Target, AlertTriangle, ArrowRight } from 'lucide-react';
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

const LANCAMENTO_33_ID = 'b08aa4e0-33b9-45bf-bbab-45227c7a9a76';

function isTruthyFlag(value: unknown) {
  return value === true || String(value || '').trim().toUpperCase() === 'SIM';
}

function isLancamento33(lancamento: any) {
  const nome = String(lancamento?.nome || '').toLowerCase();
  return lancamento?.id === LANCAMENTO_33_ID || nome.includes('#33') || nome.includes('33');
}

function pickDashboardLancamento(lancamentos: any[]) {
  return lancamentos.find(isLancamento33) || lancamentos[0] || null;
}

function isPlanilhaLancamentoLead(lead: any) {
  return !isTruthyFlag(lead.no_grupo)
    && !isTruthyFlag(lead.grupo_oferta)
    && !isTruthyFlag(lead.follow_up_01)
    && !isTruthyFlag(lead.follow_up_02)
    && !isTruthyFlag(lead.follow_up_03)
    && !isTruthyFlag(lead.matriculado)
    && (lead.fase === 'planilha' || !lead.fase || /^[0-9a-f-]{36}$/i.test(String(lead.fase)));
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

export function Dashboard() {
  const { user, users } = useAuth();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [lancamentosAtivos, setLancamentosAtivos] = useState<any[]>([]);
  const [lancamentosLeads, setLancamentosLeads] = useState<any[]>([]);
  const [npaAtivo, setNpaAtivo] = useState<any>(null);
  const [npaLeads, setNpaLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.tipo === 'admin';
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async (showLoading = false) => {
      if (showLoading) setLoading(true);

      const [leadsRes, alunosRes, pagamentosRes, tasksRes, turmasRes, lancamentosRes, npaEventosRes] = await Promise.all([
        supabase.from('leads')
          .select('id, nome, produto, etapa:status, responsavel_id, ultima_atividade, valor_potencial, created_at')
          .order('created_at', { ascending: false }).limit(500),
        supabase.from('alunos')
          .select('id, nome, produto, status, data_inicio, origem_lead, created_at')
          .order('created_at', { ascending: false }).limit(500),
        supabase.from('pagamentos')
          .select('id, aluno_id, valor, mes_referencia, status, data_pagamento, created_at')
          .order('created_at', { ascending: false }).limit(1000),
        supabase.from('tarefas')
          .select('id, titulo, status, prioridade, responsavel_id, responsaveis, prazo, categoria, pagina, created_at')
          .order('prazo').limit(50),
        supabase.from('turmas').select('id, nome, produto, data_inicio, data_fim, status'),
        supabase.from('lancamentos').select('id, nome, ativo, created_at').eq('ativo', true).order('created_at', { ascending: false }).limit(10),
        supabase.from('npa_eventos').select('id, nome, ativo').eq('ativo', true).limit(1),
      ]);

      if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
      if (alunosRes.data) setAlunos(alunosRes.data as Aluno[]);
      if (pagamentosRes.data) setPagamentos(pagamentosRes.data as Pagamento[]);
      if (tasksRes.data) setTasks(tasksRes.data as Task[]);
      if (turmasRes.data) setTurmas(turmasRes.data as Turma[]);
      const sortedLancamentos = [...(lancamentosRes.data || [])].sort((a, b) => {
        if (isLancamento33(a)) return -1;
        if (isLancamento33(b)) return 1;
        return 0;
      });
      setLancamentosAtivos(sortedLancamentos);

      const dashboardLancamento = pickDashboardLancamento(sortedLancamentos);
      if (dashboardLancamento) {
        const lancId = dashboardLancamento.id;
        const allLancLeads: any[] = [];
        let from = 0;
        while (true) {
          const { data: page } = await supabase.from('lancamento_leads')
            .select('id, lancamento_id, fase, no_grupo, grupo_oferta, follow_up_01, follow_up_02, follow_up_03, matriculado')
            .eq('lancamento_id', lancId)
            .range(from, from + 999);
          if (!page || page.length === 0) break;
          allLancLeads.push(...page);
          if (page.length < 1000) break;
          from += 1000;
        }
        setLancamentosLeads(allLancLeads);
      }

      if (npaEventosRes.data && npaEventosRes.data.length > 0) {
        const npaEvento = npaEventosRes.data[0];
        setNpaAtivo(npaEvento);
        const allNpaLeads: any[] = [];
        let from = 0;
        while (true) {
          const { data: page } = await supabase.from('npa_evento_leads')
            .select('id, npa_evento_id, fase, matriculado')
            .eq('npa_evento_id', npaEvento.id)
            .range(from, from + 999);
          if (!page || page.length === 0) break;
          allNpaLeads.push(...page);
          if (page.length < 1000) break;
          from += 1000;
        }
        setNpaLeads(allNpaLeads);
      }

      if (showLoading) setLoading(false);
    };

    load(true);

    // 1 único canal realtime com debounce de 2s para evitar reload em cascata
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

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const getFilterStartDate = (filter: TimeFilter): Date | null => {
    const now = new Date();
    switch (filter) {
      case 'today': return startOfDay(now);
      case 'week': return startOfWeek(now, { weekStartsOn: 1 });
      case 'month': return startOfMonth(now);
      case 'year': return startOfYear(now);
      default: return null;
    }
  };

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (!isAdmin) result = result.filter(l => l.responsavel_id === user?.id);
    const startDate = getFilterStartDate(timeFilter);
    if (!startDate) return result;
    return result.filter(l => {
      const leadDate = new Date(l.created_at);
      return isAfter(leadDate, startDate) || leadDate.getTime() === startDate.getTime();
    });
  }, [leads, timeFilter, isAdmin, user?.id]);

  const filteredAlunos = useMemo(() => {
    let result = alunos;
    const startDate = getFilterStartDate(timeFilter);
    if (!startDate) return result;
    return result.filter(a => {
      const alunoDate = new Date(a.created_at);
      return isAfter(alunoDate, startDate) || alunoDate.getTime() === startDate.getTime();
    });
  }, [alunos, timeFilter]);

  const receitaPotencial = useMemo(() =>
    filteredLeads.filter(l => l.etapa !== 'matricula').reduce((sum, l) => sum + l.valor_potencial, 0),
  [filteredLeads]);

  const dinheiroNaMesa = useMemo(() => {
    const leadsParados = filteredLeads.filter(l =>
      ['closer','follow_up_01','follow_up_02','follow_up_03'].includes(l.etapa) &&
      differenceInHours(new Date(), new Date(l.ultima_atividade)) > 72
    );
    return leadsParados.reduce((sum, l) => sum + l.valor_potencial, 0);
  }, [filteredLeads]);

  const alunosAtivos = filteredAlunos.filter(a => a.status === 'ativo').length;
  const receitaRecorrente = alunosAtivos * 109.90;

  const ltvPotencial = useMemo(() => {
    const alunosAtivosPsicanalise = filteredAlunos.filter(a => a.status === 'ativo' && a.produto === 'psicanalise');
    const receitaJaRecebida = pagamentos.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.valor, 0);
    return (alunosAtivosPsicanalise.length * 1538.60) + receitaJaRecebida;
  }, [filteredAlunos, pagamentos]);

  const getFunilData = (produto: 'direto' | 'lancamento' | 'npa') => {
    if (produto === 'lancamento' && lancamentosAtivos.length > 0) {
      const dashboardLancamento = pickDashboardLancamento(lancamentosAtivos);
      const ll = dashboardLancamento ? lancamentosLeads.filter(l => l.lancamento_id === dashboardLancamento.id) : [];
      return {
        planilha: ll.filter(l => getLancamentoStage(l) === 'planilha').length,
        grupoLancamento: ll.filter(l => getLancamentoStage(l) === 'grupoLancamento').length,
        grupoOferta: ll.filter(l => getLancamentoStage(l) === 'grupoOferta').length,
        followUp01: ll.filter(l => getLancamentoStage(l) === 'followUp01').length,
        followUp02: ll.filter(l => getLancamentoStage(l) === 'followUp02').length,
        followUp03: ll.filter(l => getLancamentoStage(l) === 'followUp03').length,
        matricula: ll.filter(l => getLancamentoStage(l) === 'matricula').length,
      };
    } else if (produto === 'lancamento') {
      return { planilha: 0, grupoLancamento: 0, grupoOferta: 0, followUp01: 0, followUp02: 0, followUp03: 0, matricula: 0 };
    }
    if (produto === 'npa' && npaAtivo) {
      const nl = npaLeads.filter(l => l.npa_evento_id === npaAtivo.id);
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
    } else if (produto === 'npa') {
      return { novo:0, ingressoPago:0, noGrupo:0, confirmado:0, evento:0, closer:0, followUp01:0, followUp02:0, followUp03:0, matricula:0 };
    }
    const pl = filteredLeads.filter(l => l.produto === produto);
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

  const getConversaoPercent = (atual: number, total: number) => total === 0 ? 0 : Math.round((atual / total) * 100);

  const colaboradores = [
    { id: 'cac2f265-196c-4a40-98e4-55d661ddd648', nome: 'Vinicius', cargo: 'Relacionamento com Leads' },
    { id: '5ef08f96-4813-44e2-99ae-ddb289d72566', nome: 'Pedro', cargo: 'Tráfego/Sites' },
    { id: 'eb50adf0-14c8-4806-bd53-6c3258e6e045', nome: 'Igor', cargo: 'Automações/Design' },
    { id: 'rodrygo', nome: 'Rodrygo', cargo: 'Conteúdo/Aulas' },
  ];

  const getColaboradorStats = (colaboradorId: string) => {
    if (colaboradorId === 'cac2f265-196c-4a40-98e4-55d661ddd648') {
      const colabLeads = filteredLeads.filter(l => l.responsavel_id === colaboradorId);
      const matriculas = colabLeads.filter(l => l.etapa === 'matricula').length;
      return { leads: colabLeads.length, matriculas, conversao: colabLeads.length > 0 ? Math.round((matriculas / colabLeads.length) * 100) : 0 };
    }
    const colabTarefas = tasks.filter(t => t.responsavel_id === colaboradorId || (t.responsaveis && t.responsaveis.includes(colaboradorId)));
    return {
      tarefasPendentes: colabTarefas.filter(t => t.status === 'a_fazer').length,
      tarefasEmAndamento: colabTarefas.filter(t => t.status === 'em_andamento').length,
      proximaTarefa: colabTarefas.filter(t => t.status !== 'concluido').sort((a, b) => new Date(a.prazo || '9999').getTime() - new Date(b.prazo || '9999').getTime())[0],
    };
  };

  const tarefasCriticas = tasks.filter(t => t.status !== 'concluido' && t.prazo && isPast(new Date(t.prazo))).slice(0, 3);
  const dashboardLancamento = pickDashboardLancamento(lancamentosAtivos);

  const getSaudeFinanceira = (produto: 'psicanalise' | 'numerologia') => {
    const produtoAlunos = filteredAlunos.filter(a => a.produto === produto && a.status === 'ativo');
    const receitaRecorrente = produto === 'psicanalise' ? produtoAlunos.length * 109.90 : 0;
    const alunosIds = produtoAlunos.map(a => a.id);
    const receitaRealizadaMes = pagamentos
      .filter(p => p.status === 'pago' && alunosIds.includes(p.aluno_id) && new Date(p.created_at).getMonth() === new Date().getMonth())
      .reduce((sum, p) => sum + p.valor, 0);
    const inadimplentes = produtoAlunos.filter(a => pagamentos.filter(p => p.aluno_id === a.id).some(p => p.status === 'atrasado')).length;
    const proximaTurma = turmas.filter(t => t.produto === produto && t.status === 'ativa').sort((a, b) => new Date(a.data_inicio || '').getTime() - new Date(b.data_inicio || '').getTime())[0];
    const leadsProntos = filteredLeads.filter(l => l.produto === produto && ['matricula','follow_up_03'].includes(l.etapa)).length;
    return { receitaRecorrente, inadimplentes, receitaPrevistaMes: receitaRecorrente, receitaRealizadaMes, proximaTurma, leadsProntos };
  };

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (loading) return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Card key={i} className="p-4 animate-pulse"><div className="h-16 bg-muted rounded"></div></Card>)}
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-20 lg:pb-6 overflow-y-auto h-full bg-white">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? 'Visão executiva completa' : 'Meus leads'}</p>
        </div>
        <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border hover:shadow-md transition-all bg-green-50 border-green-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-green-700">Receita Potencial no Funil</p>
              <Target className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-800">{fmt(receitaPotencial)}</p>
            <p className="text-[11px] text-green-600">{filteredLeads.filter(l => l.etapa !== 'matricula').length} leads × R$109,90/mês</p>
          </div>
        </Card>
        <Card className="p-4 border hover:shadow-md transition-all bg-red-50 border-red-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-red-700">Dinheiro na Mesa</p>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-800">{fmt(dinheiroNaMesa)}</p>
            <p className="text-[11px] text-red-600">{filteredLeads.filter(l => ['closer','follow_up_01','follow_up_02','follow_up_03'].includes(l.etapa) && differenceInHours(new Date(), new Date(l.ultima_atividade)) > 72).length} leads parados</p>
          </div>
        </Card>
        <Card className="p-4 border hover:shadow-md transition-all bg-blue-50 border-blue-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-blue-700">Alunos Ativos Agora</p>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-800">{alunosAtivos}</p>
            <p className="text-[11px] text-blue-600">Receita recorrente: {fmt(receitaRecorrente)}</p>
          </div>
        </Card>
        <Card className="p-4 border hover:shadow-md transition-all bg-purple-50 border-purple-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-purple-700">LTV Potencial</p>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-800">{fmt(ltvPotencial)}</p>
            <p className="text-[11px] text-purple-600">Projeção 14 meses</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { titulo: 'Lead Direto', cor: 'text-blue-700', produto: 'direto' as const },
          { titulo: `Lançamento${lancamentosAtivos.length > 0 ? ` (${lancamentosAtivos[0].nome})` : ''}`, cor: 'text-purple-700', produto: 'lancamento' as const },
          { titulo: `NPA${npaAtivo ? ` (${npaAtivo.nome})` : ''}`, cor: 'text-orange-700', produto: 'npa' as const },
        ].map(({ titulo, cor, produto }) => {
          const funil = getFunilData(produto);
          const etapas = produto === 'lancamento'
            ? [['Planilha','planilha'],['Grupo Lançamento','grupoLancamento'],['Grupo Oferta','grupoOferta'],['Follow-up 01','followUp01'],['Follow-up 02','followUp02'],['Follow-up 03','followUp03'],['Matrícula','matricula']]
            : produto === 'npa'
            ? [['Novo','novo'],['Ingresso Pago','ingressoPago'],['No Grupo','noGrupo'],['Confirmado','confirmado'],['Evento','evento'],['Closer','closer'],['Follow-up 01','followUp01'],['Follow-up 02','followUp02'],['Follow-up 03','followUp03'],['Matrícula','matricula']]
            : [['Novo','novo'],['SDR','sdr'],['Closer','closer'],['Follow-up 01','followUp01'],['Follow-up 02','followUp02'],['Follow-up 03','followUp03'],['Matrícula','matricula']];
          const total = produto === 'lancamento'
            ? (dashboardLancamento ? lancamentosLeads.filter(l => l.lancamento_id === dashboardLancamento.id).length : 0)
            : produto === 'npa' ? (npaAtivo ? npaLeads.filter(l => l.npa_evento_id === npaAtivo.id).length : 0)
            : filteredLeads.filter(l => l.produto === 'direto').length;
          return (
            <Card key={produto} className="p-6 border">
              <h3 className={`font-600 mb-4 ${cor}`}>{titulo}</h3>
              <div className="space-y-3">
                {etapas.map(([label, key], i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{(funil as any)[key] ?? 0}</Badge>
                      {total > 0 && <><ArrowRight className="h-3 w-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">{getConversaoPercent((funil as any)[key] ?? 0, total)}%</span></>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Total: {total}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border">
          <h3 className="font-600 mb-4 text-gray-800">Performance do Time</h3>
          <div className="space-y-2">
            {colaboradores.map((colab, idx) => {
              const stats = getColaboradorStats(colab.id);
              const colors = [
                { bg:'bg-blue-50',border:'border-blue-100',dot:'bg-blue-400',text:'text-blue-700' },
                { bg:'bg-amber-50',border:'border-amber-100',dot:'bg-amber-400',text:'text-amber-700' },
                { bg:'bg-purple-50',border:'border-purple-100',dot:'bg-purple-400',text:'text-purple-700' },
                { bg:'bg-cyan-50',border:'border-cyan-100',dot:'bg-cyan-400',text:'text-cyan-700' },
              ];
              const c = colors[idx] || colors[0];
              const isVinicius = colab.id === 'cac2f265-196c-4a40-98e4-55d661ddd648';
              return (
                <div key={colab.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${c.bg} ${c.border}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{colab.nome}</p>
                      <p className="text-xs text-gray-400">{colab.cargo}</p>
                    </div>
                  </div>
                  {isVinicius ? (
                    <div className="flex items-center gap-4 text-right">
                      <div><p className="text-base font-bold text-gray-800">{stats.leads}</p><p className="text-xs text-gray-400">Leads</p></div>
                      <div><p className="text-base font-bold text-green-600">{stats.matriculas}</p><p className="text-xs text-gray-400">Matrículas</p></div>
                      <div><p className={`text-base font-bold ${c.text}`}>{stats.conversao}%</p><p className="text-xs text-gray-400">Conversão</p></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-right">
                      <div><p className="text-base font-bold text-amber-600">{stats.tarefasPendentes}</p><p className="text-xs text-gray-400">A Fazer</p></div>
                      <div><p className="text-base font-bold text-orange-500">{stats.tarefasEmAndamento}</p><p className="text-xs text-gray-400">Em Andamento</p></div>
                      <div className="text-right max-w-[120px]">
                        {stats.proximaTarefa ? (
                          <><p className="text-xs font-medium text-gray-700 truncate">{stats.proximaTarefa.titulo}</p><p className="text-xs text-gray-400">{stats.proximaTarefa.prazo ? format(new Date(stats.proximaTarefa.prazo), 'dd/MM') : '—'}</p></>
                        ) : <p className="text-xs text-gray-300">Sem tarefas</p>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {tarefasCriticas.length > 0 && (
            <div className="mt-4 pt-4 border-t border-red-100">
              <p className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wide">⚠ Tarefas Atrasadas</p>
              <div className="space-y-1.5">
                {tarefasCriticas.map(task => (
                  <div key={task.id} className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-sm text-gray-700 truncate flex-1">{task.titulo}</p>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      {task.prazo && <p className="text-xs text-red-500">{format(new Date(task.prazo), 'dd/MM')}</p>}
                      <Badge variant="destructive" className="text-xs px-1.5">{task.prioridade}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 border">
          <h3 className="font-600 mb-4">Saúde Financeira</h3>
          <Tabs defaultValue="psicanalise" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="psicanalise">Psicanálise</TabsTrigger>
              <TabsTrigger value="numerologia">Numerologia</TabsTrigger>
            </TabsList>
            {(['psicanalise', 'numerologia'] as const).map(prod => {
              const saude = getSaudeFinanceira(prod);
              return (
                <TabsContent key={prod} value={prod} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-700">{prod === 'psicanalise' ? 'Receita Recorrente Mensal' : 'Receita este Mês (Eventos)'}</p>
                      <p className="text-lg font-bold text-blue-800">{fmt(prod === 'psicanalise' ? saude.receitaRecorrente : saude.receitaRealizadaMes)}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded border border-red-200">
                      <p className="text-xs text-red-700">Inadimplência</p>
                      <p className="text-lg font-bold text-red-800">{saude.inadimplentes} alunos</p>
                    </div>
                  </div>
                  {prod === 'psicanalise' && (
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <p className="text-xs text-green-700">Receita vs Previsão (Mês Atual)</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm">Realizado: {fmt(saude.receitaRealizadaMes)}</span>
                        <span className="text-sm">Previsto: {fmt(saude.receitaPrevistaMes)}</span>
                      </div>
                      <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: `${Math.min((saude.receitaRealizadaMes / (saude.receitaPrevistaMes || 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  )}
                  <div className="p-3 bg-purple-50 rounded border border-purple-200">
                    <p className="text-xs text-purple-700">Próxima Turma{prod === 'numerologia' ? '/Evento' : ''}</p>
                    {saude.proximaTurma ? (
                      <div className="mt-1">
                        <p className="text-sm font-500">{saude.proximaTurma.nome}</p>
                        <p className="text-xs text-purple-600">{format(new Date(saude.proximaTurma.data_inicio || ''), 'dd/MM/yyyy')} • {saude.leadsProntos} leads prontos</p>
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Nenhuma turma ativa</p>}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
