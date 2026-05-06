import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessFinanceiroTurma } from '@/lib/access-control';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  Plus, DollarSign, Users, AlertCircle, Eye, Trash2,
  TrendingUp, Target, Phone, Pencil, Building2, CheckCircle2
} from 'lucide-react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Turma {
  id: string;
  nome: string;
  produto?: string;
  tipo?: string;
  data_inicio?: string;
  data_fim?: string;
  valor_mensalidade?: number;
  total_mensalidades?: number;
  created_at: string;
}

interface Aluno {
  id: string;
  turma_id: string;
  produto: string;
  nome: string;
  whatsapp?: string;
  email?: string;
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  cep?: string;
  cidade_estado?: string;
  pais?: string;
  dia_vencimento?: number;
  dia_vencimento_contrato?: string;
  status: 'ativo' | 'inadimplente' | 'cancelado' | 'concluido';
  mensalidades_pagas?: number;
  total_mensalidades?: number;
  data_inicio?: string;
  data_fim?: string;
  data_matricula?: string;
  origem_lead?: string;
  valor_mensalidade?: number;
  forma_pagamento?: string;
  observacoes?: string;
  forms_respondido?: boolean;
  forms_respondido_em?: string;
  contrato_enviado?: boolean;
  contrato_enviado_em?: string;
  contrato_assinado?: boolean;
  contrato_assinado_em?: string;
  autentique_documento_id?: string;
  autentique_link_assinatura?: string;
  created_at: string;
}

interface Pagamento {
  id: string;
  aluno_id: string;
  turma_id: string;
  produto: string;
  valor: number;
  mes_referencia: string;
  data_vencimento: string;
  data_pagamento?: string;
  numero_parcela: number;
  status: 'pago' | 'pendente' | 'atrasado';
  created_at: string;
}

type ProdutoTab = 'psicanalise' | 'numerologia';
type SubView = 'alunos' | 'turmas';
type PaymentMethod = 'boleto' | 'cartao' | 'avista';
type PaymentFilter = 'todos' | PaymentMethod;
type DueFilter = 'todos' | 'vencidos' | 'hoje' | 'proximos_7' | 'proximos_30' | 'quitados';
type DueDayFilter = 'todos' | `dia_${number}`;

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const safeDate = (s?: string) => {
  if (!s) return '';
  try { return format(parseISO(s), 'dd/MM/yyyy', { locale: ptBR }); } catch { return s; }
};

const todayDateInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const toDateInput = (value?: string | null) => {
  if (!value) return '';
  return value.split('T')[0];
};

const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseDateOnly = (value?: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

const dateWithClampedDay = (year: number, month: number, day: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay), 12, 0, 0);
};

const normalizePaymentMethod = (value?: string | null): PaymentMethod => {
  const normalized = (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (normalized === 'cartao') return 'cartao';
  if (normalized === 'pix' || normalized === 'avista' || normalized === 'a_vista' || normalized === 'a vista') return 'avista';
  return 'boleto';
};

const paymentMethodTotal = (method?: string | null) => {
  const normalized = normalizePaymentMethod(method);
  if (normalized === 'cartao') return 12;
  if (normalized === 'avista') return 1;
  return 15;
};

const readDueDay = (value?: string | number | null) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : null;
};

const extractDueDay = (value?: string | number | null) => readDueDay(value) || 10;

const extractDateDay = (value?: string | null) => {
  const date = parseDateOnly(value);
  return date ? date.getDate() : null;
};

const getAlunoDueDay = (
  aluno: Pick<Aluno, 'dia_vencimento' | 'dia_vencimento_contrato'>,
  parcelas: Pick<Pagamento, 'data_vencimento' | 'numero_parcela'>[] = [],
) => {
  const alunoDay = readDueDay(aluno.dia_vencimento);
  if (alunoDay) return alunoDay;

  const contratoDay = readDueDay(aluno.dia_vencimento_contrato);
  if (contratoDay) return contratoDay;

  const parcelaBase = parcelas.find(p => p.numero_parcela > 1 && p.data_vencimento) || parcelas.find(p => p.data_vencimento);
  return extractDateDay(parcelaBase?.data_vencimento) || 10;
};

const buildInstallments = ({
  alunoId,
  turmaId,
  produto,
  valor,
  method,
  diaVencimento,
  dataMatricula,
  existingPaidNumbers = new Set<number>(),
  minTotal,
}: {
  alunoId: string;
  turmaId: string;
  produto: string;
  valor: number;
  method: PaymentMethod;
  diaVencimento: number;
  dataMatricula?: string | null;
  existingPaidNumbers?: Set<number>;
  minTotal?: number;
}) => {
  const matricula = parseDateOnly(dataMatricula) || new Date();
  const targetTotal = Math.max(paymentMethodTotal(method), minTotal || 0);
  const matriculaDate = formatLocalDate(matricula);

  return Array.from({ length: targetTotal }, (_, index) => {
    const numeroParcela = index + 1;
    if (existingPaidNumbers.has(numeroParcela)) return null;

    const dueDate = index === 0
      ? matricula
      : dateWithClampedDay(matricula.getFullYear(), matricula.getMonth() + index, diaVencimento);
    const dueDateText = formatLocalDate(dueDate);
    const mesReferencia = formatLocalDate(new Date(dueDate.getFullYear(), dueDate.getMonth(), 1, 12, 0, 0));
    const paidByPlan = method === 'cartao' || method === 'avista' || (method === 'boleto' && index === 0);

    return {
      aluno_id: alunoId,
      turma_id: turmaId,
      produto,
      valor,
      mes_referencia: mesReferencia,
      data_vencimento: dueDateText,
      numero_parcela: numeroParcela,
      status: paidByPlan ? 'pago' : 'pendente',
      data_pagamento: paidByPlan ? matriculaDate : null,
      observacoes: index === 0 ? 'Ato de matricula' : null,
    };
  }).filter(Boolean);
};

const statusColors: Record<string, string> = {
  ativo: 'bg-green-100 text-green-800',
  inadimplente: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
  concluido: 'bg-blue-100 text-blue-800',
};

const paymentLabels: Record<PaymentMethod, string> = {
  boleto: 'Boleto',
  cartao: 'Cartao',
  avista: 'A vista',
};

const getEmptyAlunoForm = () => ({
  nome: '',
  whatsapp: '',
  email: '',
  cpf: '',
  data_nascimento: '',
  pais: 'Brasil',
  endereco: '',
  cep: '',
  cidade_estado: '',
  turma_id: '',
  data_inicio: '',
  data_fim: '',
  data_matricula: todayDateInput(),
  dia_vencimento: '10',
  origem: 'direto',
  forma_pagamento: 'boleto' as PaymentMethod,
  valor_mensalidade: '',
  observacoes: '',
});

export function Financeiro() {
  const { permissions, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<ProdutoTab>('psicanalise');
  const [subView, setSubView] = useState<SubView>('alunos');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState('todas');
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('this_month');

  // Modais
  const [showTurmaDialog, setShowTurmaDialog] = useState(false);
  const [showAlunoDialog, setShowAlunoDialog] = useState(false);
  const [showAlunoDetail, setShowAlunoDetail] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditTurma, setShowEditTurma] = useState(false);
  const [alunoDetail, setAlunoDetail] = useState<Aluno | null>(null);
  const [alunoToDelete, setAlunoToDelete] = useState<Aluno | null>(null);
  const [turmaToEdit, setTurmaToEdit] = useState<Turma | null>(null);

  // Inline edit turma card
  const [editingTurmaCardId, setEditingTurmaCardId] = useState<string | null>(null);
  const [inlineTurmaForm, setInlineTurmaForm] = useState<Partial<Turma>>({});
  const [savingInlineTurma, setSavingInlineTurma] = useState(false);

  // Formularios
  const emptyTurmaForm = { nome: '', produto: 'psicanalise' as ProdutoTab, data_inicio: '', data_fim: '', valor_mensalidade: '109.90', total_mensalidades: '15' };
  const emptyAlunoForm = getEmptyAlunoForm();

  const [newTurmaForm, setNewTurmaForm] = useState(emptyTurmaForm);
  const [newAlunoForm, setNewAlunoForm] = useState(emptyAlunoForm);
  const [editAlunoForm, setEditAlunoForm] = useState<Partial<Aluno> & { turma_id_new?: string }>({});
  const [editTurmaForm, setEditTurmaForm] = useState<Partial<Turma>>({});
  const [savingAluno, setSavingAluno] = useState(false);
  const [savingTurma, setSavingTurma] = useState(false);
  const [showPagoDialog, setShowPagoDialog] = useState(false);
  const [pagoInfo, setPagoInfo] = useState<{ pagamentoId: string; alunoId: string; data: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inadimplente' | 'cancelado'>('todos');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('todos');
  const [dueDayFilter, setDueDayFilter] = useState<DueDayFilter>('todos');
  const [dueFilter, setDueFilter] = useState<DueFilter>('todos');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [turmasRes, alunosRes, pagamentosRes] = await Promise.all([
        supabase.from('turmas').select('id, nome, produto, tipo, data_inicio, data_fim, valor_mensalidade, total_mensalidades, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('alunos').select('id, turma_id, produto, nome, whatsapp, email, cpf, data_nascimento, endereco, cep, cidade_estado, pais, dia_vencimento, dia_vencimento_contrato, status, mensalidades_pagas, total_mensalidades, data_inicio, data_fim, data_matricula, origem_lead, valor_mensalidade, forma_pagamento, observacoes, forms_respondido, forms_respondido_em, contrato_enviado, contrato_enviado_em, contrato_assinado, contrato_assinado_em, autentique_documento_id, autentique_link_assinatura, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('pagamentos').select('id, aluno_id, turma_id, produto, valor, mes_referencia, data_vencimento, data_pagamento, numero_parcela, status, created_at').order('created_at', { ascending: false }).limit(2000),
      ]);
      if (turmasRes.data) setTurmas(turmasRes.data);
      if (alunosRes.data) setAlunos(alunosRes.data);
      if (pagamentosRes.data) setPagamentos(pagamentosRes.data);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  const filteredTurmas = useMemo(() => {
    return turmas.filter(t => {
      if ((t.tipo || t.produto) !== activeTab) return false;
      if (isAdmin) return true;
      if (!permissions) return true;
      return canAccessFinanceiroTurma(permissions, t.id);
    });
  }, [turmas, activeTab, permissions, isAdmin]);
  const filteredPagamentos = useMemo(() => pagamentos.filter(p => p.produto === activeTab), [pagamentos, activeTab]);
  const pagamentosPorAluno = useMemo(() => {
    const map: Record<string, Pagamento[]> = {};
    filteredPagamentos.forEach(p => {
      if (!map[p.aluno_id]) map[p.aluno_id] = [];
      map[p.aluno_id].push(p);
    });
    Object.values(map).forEach(lista => lista.sort((a, b) => (a.numero_parcela || 0) - (b.numero_parcela || 0)));
    return map;
  }, [filteredPagamentos]);

  // Inadimplencia calculada a partir dos pagamentos reais (nao do campo manual)
  const inadimplenciaMap = useMemo(() => {
    const map: Record<string, { diasAtraso: number; valorEmAtraso: number; parcelasAtrasadas: number }> = {};
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    filteredPagamentos.forEach(p => {
      const aluno = alunos.find(a => a.id === p.aluno_id);
      if (aluno && normalizePaymentMethod(aluno.forma_pagamento) !== 'boleto') return;

      if (p.status !== 'pago') {
        const venc = new Date(p.data_vencimento + 'T12:00:00');
        if (venc < hoje) {
          if (!map[p.aluno_id]) map[p.aluno_id] = { diasAtraso: 0, valorEmAtraso: 0, parcelasAtrasadas: 0 };
          const dias = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
          map[p.aluno_id].diasAtraso = Math.max(map[p.aluno_id].diasAtraso, dias);
          map[p.aluno_id].valorEmAtraso += p.valor;
          map[p.aluno_id].parcelasAtrasadas += 1;
        }
      }
    });
    return map;
  }, [filteredPagamentos, alunos]);

  const alunosNoEscopo = useMemo(() => {
    let r = alunos.filter(a => {
      if (a.produto !== activeTab) return false;
      if (isAdmin) return true;
      if (!permissions) return true;
      return canAccessFinanceiroTurma(permissions, a.turma_id);
    });
    if (selectedTurmaId !== 'todas') r = r.filter(a => a.turma_id === selectedTurmaId);
    if (statusFilter !== 'todos') {
      if (statusFilter === 'inadimplente') r = r.filter(a => inadimplenciaMap[a.id] || a.status === 'inadimplente');
      else r = r.filter(a => a.status === statusFilter);
    }
    return r;
  }, [alunos, activeTab, selectedTurmaId, permissions, isAdmin, statusFilter, inadimplenciaMap]);

  const paymentCounts = useMemo(() => {
    return alunosNoEscopo.reduce<Record<PaymentMethod, number>>((acc, aluno) => {
      acc[normalizePaymentMethod(aluno.forma_pagamento)] += 1;
      return acc;
    }, { boleto: 0, cartao: 0, avista: 0 });
  }, [alunosNoEscopo]);

  const dueDayOptions = useMemo(() => {
    const counts = new Map<number, number>();
    [10, 20, 30].forEach(day => counts.set(day, 0));

    alunosNoEscopo.forEach(aluno => {
      if (normalizePaymentMethod(aluno.forma_pagamento) !== 'boleto') return;
      const day = getAlunoDueDay(aluno, pagamentosPorAluno[aluno.id] || []);
      counts.set(day, (counts.get(day) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, count]) => ({ key: `dia_${day}` as DueDayFilter, day, count }));
  }, [alunosNoEscopo, pagamentosPorAluno]);

  const filteredAlunos = useMemo(() => {
    const today = parseDateOnly(todayDateInput())!;
    const matchesDueFilter = (aluno: Aluno) => {
      if (dueFilter === 'todos') return true;

      const method = normalizePaymentMethod(aluno.forma_pagamento);
      if (method !== 'boleto') return dueFilter === 'quitados';

      const parcelasAbertas = (pagamentosPorAluno[aluno.id] || [])
        .filter(p => p.status !== 'pago')
        .filter(p => p.data_vencimento)
        .sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)));

      if (dueFilter === 'quitados') return parcelasAbertas.length === 0;
      if (parcelasAbertas.length === 0) return false;

      const vencimento = parseDateOnly(parcelasAbertas[0].data_vencimento);
      if (!vencimento) return false;
      const diffDays = Math.floor((vencimento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (dueFilter === 'vencidos') return diffDays < 0;
      if (dueFilter === 'hoje') return diffDays === 0;
      if (dueFilter === 'proximos_7') return diffDays >= 0 && diffDays <= 7;
      if (dueFilter === 'proximos_30') return diffDays >= 0 && diffDays <= 30;
      return true;
    };

    let r = [...alunosNoEscopo];
    if (paymentFilter !== 'todos') {
      r = r.filter(a => normalizePaymentMethod(a.forma_pagamento) === paymentFilter);
    }
    if (dueDayFilter !== 'todos') {
      const selectedDay = Number(dueDayFilter.replace('dia_', ''));
      r = r.filter(a =>
        normalizePaymentMethod(a.forma_pagamento) === 'boleto' &&
        getAlunoDueDay(a, pagamentosPorAluno[a.id] || []) === selectedDay
      );
    }
    if (dueFilter !== 'todos') {
      r = r.filter(a => matchesDueFilter(a));
    }
    return r;
  }, [alunosNoEscopo, paymentFilter, dueDayFilter, dueFilter, pagamentosPorAluno]);

  const currentMonth = new Date();

  const periodoLabel: Record<string, string> = { this_month: 'Este mes', last_month: 'Mes passado', last_3m: 'Ultimos 3 meses', this_year: 'Este ano', all: 'Tudo' };

  const periodoFilter = (dateStr?: string | null) => {
    if (!dateStr) return false;
    try {
      const d = parseISO(dateStr);
      const now = new Date();
      if (periodo === 'this_month') return isSameMonth(d, now);
      if (periodo === 'last_month') { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return isSameMonth(d, lm); }
      if (periodo === 'last_3m') { const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1); return d >= cutoff; }
      if (periodo === 'this_year') return d.getFullYear() === now.getFullYear();
      return true;
    } catch { return false; }
  };

  const receitaMes = useMemo(() => filteredPagamentos.filter(p => p.status === 'pago' && periodoFilter(p.data_pagamento)).reduce((s, p) => s + p.valor, 0), [filteredPagamentos, periodo]);
  const previstoMes = useMemo(() => filteredPagamentos.filter(p => periodoFilter(p.data_vencimento)).reduce((s, p) => s + p.valor, 0), [filteredPagamentos, periodo]);

  const inadimplentes = useMemo(() => filteredAlunos.filter(a => inadimplenciaMap[a.id] || a.status === 'inadimplente'), [filteredAlunos, inadimplenciaMap]);
  const totalEmAtraso = useMemo(() => Object.values(inadimplenciaMap).reduce((s, v) => s + v.valorEmAtraso, 0), [inadimplenciaMap]);
  const contratosPendentes = useMemo(() => filteredAlunos.filter(a => !a.contrato_assinado && a.status === 'ativo').length, [filteredAlunos]);

  // Agrupar alunos por turma
  const alunosPorTurma = useMemo(() => {
    const groups: Record<string, Aluno[]> = {};
    filteredAlunos.forEach(a => {
      const key = a.turma_id || '__sem_turma__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    // Sort: turmas first (by nome), sem_turma last
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === '__sem_turma__') return 1;
      if (b === '__sem_turma__') return -1;
      const ta = turmas.find(t => t.id === a)?.nome || '';
      const tb = turmas.find(t => t.id === b)?.nome || '';
      return ta.localeCompare(tb);
    });
  }, [filteredAlunos, turmas]);

  // CRUD turma
  const createTurma = async () => {
    if (!newTurmaForm.nome.trim()) return;
    try {
      const { error } = await supabase.from('turmas').insert({
        nome: newTurmaForm.nome,
        produto: newTurmaForm.produto,
        tipo: newTurmaForm.produto,
        data_inicio: newTurmaForm.data_inicio || null,
        data_fim: newTurmaForm.data_fim || null,
        valor_mensalidade: parseFloat(newTurmaForm.valor_mensalidade) || null,
        total_mensalidades: parseInt(newTurmaForm.total_mensalidades) || null,
      });
      if (error) throw error;
      toast({ title: 'Turma criada!' });
      setShowTurmaDialog(false);
      setNewTurmaForm(emptyTurmaForm);
      loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    }
  };

  const openEditTurma = (t: Turma) => {
    setTurmaToEdit(t);
    setEditTurmaForm({ nome: t.nome, data_inicio: t.data_inicio || '', data_fim: t.data_fim || '', valor_mensalidade: t.valor_mensalidade, total_mensalidades: t.total_mensalidades });
    setShowEditTurma(true);
  };

  const saveEditTurma = async () => {
    if (!turmaToEdit) return;
    setSavingTurma(true);
    try {
      const { error } = await supabase.from('turmas').update({
        nome: editTurmaForm.nome,
        data_inicio: editTurmaForm.data_inicio || null,
        data_fim: editTurmaForm.data_fim || null,
        valor_mensalidade: editTurmaForm.valor_mensalidade || null,
        total_mensalidades: editTurmaForm.total_mensalidades || null,
      }).eq('id', turmaToEdit.id);
      if (error) throw error;
      toast({ title: 'Turma atualizada!' });
      setShowEditTurma(false);
      loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSavingTurma(false);
    }
  };

  const deleteTurma = async (id: string) => {
    if (!confirm('Excluir turma? Os alunos nao serao deletados.')) return;
    const { error } = await supabase.from('turmas').delete().eq('id', id);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: error.message }); return; }
    toast({ title: 'Turma removida!' });
    loadData();
  };

  const saveInlineTurma = async () => {
    if (!editingTurmaCardId) return;
    setSavingInlineTurma(true);
    const { error } = await supabase.from('turmas').update({
      nome: inlineTurmaForm.nome,
      data_inicio: inlineTurmaForm.data_inicio || null,
      data_fim: inlineTurmaForm.data_fim || null,
      valor_mensalidade: inlineTurmaForm.valor_mensalidade || null,
      total_mensalidades: inlineTurmaForm.total_mensalidades || null,
    }).eq('id', editingTurmaCardId);
    setSavingInlineTurma(false);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: error.message }); return; }
    toast({ title: 'Turma atualizada!' });
    setEditingTurmaCardId(null);
    loadData();
  };

  // CRUD aluno
  const getValorEfetivo = (turmaId: string, valorAluno?: number | null) => {
    const turma = turmas.find(t => t.id === turmaId);
    return Number(valorAluno ?? turma?.valor_mensalidade ?? 109.90);
  };

  const atualizarContadoresAluno = async (alunoId: string) => {
    const { data, error } = await supabase
      .from('pagamentos')
      .select('status')
      .eq('aluno_id', alunoId);

    if (error) return;

    await supabase
      .from('alunos')
      .update({
        mensalidades_pagas: (data || []).filter(p => p.status === 'pago').length,
        total_mensalidades: data?.length || 0,
      })
      .eq('id', alunoId);
  };

  const sincronizarParcelasAluno = async ({
    alunoId,
    turmaId,
    produto,
    method,
    diaVencimento,
    dataMatricula,
    valor,
  }: {
    alunoId: string;
    turmaId: string;
    produto: string;
    method: PaymentMethod;
    diaVencimento: number;
    dataMatricula?: string | null;
    valor: number;
  }) => {
    const existentes = pagamentos
      .filter(p => p.aluno_id === alunoId)
      .sort((a, b) => (a.numero_parcela || 0) - (b.numero_parcela || 0));
    const pagas = existentes.filter(p => p.status === 'pago');
    const numerosPagos = new Set(pagas.map(p => p.numero_parcela || 0).filter(Boolean));
    const maiorParcelaPaga = Math.max(0, ...Array.from(numerosPagos));
    const total = Math.max(paymentMethodTotal(method), maiorParcelaPaga, pagas.length);
    const abertas = existentes.filter(p => p.status !== 'pago');

    if (abertas.length > 0) {
      const { error } = await supabase.from('pagamentos').delete().in('id', abertas.map(p => p.id));
      if (error) throw error;
    }

    if (pagas.length > 0) {
      const { error } = await supabase
        .from('pagamentos')
        .update({ turma_id: turmaId, produto })
        .eq('aluno_id', alunoId)
        .eq('status', 'pago');
      if (error) throw error;
    }

    const rows = buildInstallments({
      alunoId,
      turmaId,
      produto,
      valor,
      method,
      diaVencimento,
      dataMatricula,
      existingPaidNumbers: numerosPagos,
      minTotal: total,
    });

    if (rows.length > 0) {
      const { error } = await supabase.from('pagamentos').insert(rows as any[]);
      if (error) throw error;
    }

    const pagasNoPlano = rows.filter((row: any) => row.status === 'pago').length + pagas.length;
    const { error } = await supabase
      .from('alunos')
      .update({ mensalidades_pagas: pagasNoPlano, total_mensalidades: total })
      .eq('id', alunoId);
    if (error) throw error;
  };

  const createAluno = async () => {
    if (!newAlunoForm.nome.trim() || !newAlunoForm.turma_id) return;
    try {
      const method = normalizePaymentMethod(newAlunoForm.forma_pagamento);
      const diaVenc = extractDueDay(newAlunoForm.dia_vencimento);
      const totalMens = paymentMethodTotal(method);
      const valorAluno = newAlunoForm.valor_mensalidade ? parseFloat(newAlunoForm.valor_mensalidade) : null;
      const valorEfetivo = getValorEfetivo(newAlunoForm.turma_id, valorAluno);
      const { data: inserted, error } = await supabase.from('alunos').insert({
        turma_id: newAlunoForm.turma_id,
        produto: activeTab,
        nome: newAlunoForm.nome,
        whatsapp: newAlunoForm.whatsapp || null,
        email: newAlunoForm.email || null,
        cpf: newAlunoForm.cpf || null,
        data_nascimento: newAlunoForm.data_nascimento || null,
        pais: newAlunoForm.pais || 'Brasil',
        endereco: newAlunoForm.endereco || null,
        cep: newAlunoForm.cep || null,
        cidade_estado: newAlunoForm.cidade_estado || null,
        dia_vencimento: diaVenc,
        dia_vencimento_contrato: `dia ${diaVenc}`,
        status: 'ativo',
        mensalidades_pagas: method === 'boleto' ? 1 : totalMens,
        total_mensalidades: totalMens,
        data_inicio: newAlunoForm.data_inicio || null,
        data_fim: newAlunoForm.data_fim || null,
        data_matricula: newAlunoForm.data_matricula || todayDateInput(),
        origem_lead: newAlunoForm.origem,
        valor_mensalidade: valorAluno,
        forma_pagamento: method,
        observacoes: newAlunoForm.observacoes || null,
      }).select().single();
      if (error) throw error;
      const rows = buildInstallments({
        alunoId: inserted.id,
        turmaId: newAlunoForm.turma_id,
        produto: activeTab,
        valor: valorEfetivo,
        method,
        diaVencimento: diaVenc,
        dataMatricula: newAlunoForm.data_matricula || todayDateInput(),
      });
      const { error: pagamentosError } = await supabase.from('pagamentos').insert(rows as any[]);
      if (pagamentosError) throw pagamentosError;
      toast({ title: 'Aluno adicionado!' });
      setShowAlunoDialog(false);
      setNewAlunoForm(emptyAlunoForm);
      loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    }
  };

  const openAlunoDetail = (a: Aluno) => {
    setAlunoDetail(a);
    setEditAlunoForm({
      nome: a.nome,
      whatsapp: a.whatsapp || '',
      email: a.email || '',
      cpf: a.cpf || '',
      data_nascimento: a.data_nascimento || '',
      pais: a.pais || 'Brasil',
      endereco: a.endereco || '',
      cep: a.cep || '',
      cidade_estado: a.cidade_estado || '',
      turma_id: a.turma_id,
      dia_vencimento: a.dia_vencimento || extractDueDay(a.dia_vencimento_contrato),
      dia_vencimento_contrato: a.dia_vencimento_contrato || '',
      data_inicio: a.data_inicio || '',
      data_fim: a.data_fim || '',
      data_matricula: a.data_matricula || todayDateInput(),
      status: a.status,
      origem_lead: a.origem_lead || '',
      mensalidades_pagas: a.mensalidades_pagas || 0,
      valor_mensalidade: a.valor_mensalidade ?? undefined,
      forma_pagamento: normalizePaymentMethod(a.forma_pagamento),
      forms_respondido: a.forms_respondido ?? false,
      forms_respondido_em: toDateInput(a.forms_respondido_em),
      contrato_enviado: a.contrato_enviado ?? false,
      contrato_enviado_em: toDateInput(a.contrato_enviado_em),
      contrato_assinado: a.contrato_assinado ?? false,
      contrato_assinado_em: toDateInput(a.contrato_assinado_em),
      autentique_documento_id: a.autentique_documento_id || '',
      autentique_link_assinatura: a.autentique_link_assinatura || '',
      total_mensalidades: a.total_mensalidades,
      observacoes: a.observacoes || '',
    });
    setShowAlunoDetail(true);
  };

  const saveAlunoDetail = async () => {
    if (!alunoDetail) return;
    setSavingAluno(true);
    try {
      const nextTurmaId = editAlunoForm.turma_id || alunoDetail.turma_id;
      const nextMethod = normalizePaymentMethod(editAlunoForm.forma_pagamento || alunoDetail.forma_pagamento);
      const nextDiaVenc = extractDueDay(editAlunoForm.dia_vencimento || editAlunoForm.dia_vencimento_contrato || alunoDetail.dia_vencimento || alunoDetail.dia_vencimento_contrato);
      const nextDataMatricula = editAlunoForm.data_matricula || alunoDetail.data_matricula || todayDateInput();
      const nextValorAluno = editAlunoForm.valor_mensalidade ?? null;
      const valorEfetivo = getValorEfetivo(nextTurmaId, nextValorAluno);
      const targetTotal = paymentMethodTotal(nextMethod);
      const nowIso = new Date().toISOString();
      const checkedDate = (checked?: boolean, formValue?: string, previousValue?: string) => {
        if (!checked) return null;
        if (formValue) return new Date(`${formValue}T12:00:00`).toISOString();
        return previousValue || nowIso;
      };
      const currentParcelas = pagamentos.filter(p => p.aluno_id === alunoDetail.id);
      const financialChanged =
        nextTurmaId !== alunoDetail.turma_id ||
        nextMethod !== normalizePaymentMethod(alunoDetail.forma_pagamento) ||
        nextDiaVenc !== extractDueDay(alunoDetail.dia_vencimento || alunoDetail.dia_vencimento_contrato) ||
        toDateInput(nextDataMatricula) !== toDateInput(alunoDetail.data_matricula) ||
        Number(nextValorAluno ?? 0) !== Number(alunoDetail.valor_mensalidade ?? 0) ||
        currentParcelas.length === 0 ||
        currentParcelas.length < targetTotal;

      const updateData: any = {
        nome: editAlunoForm.nome || alunoDetail.nome,
        whatsapp: editAlunoForm.whatsapp || null,
        email: editAlunoForm.email || null,
        cpf: editAlunoForm.cpf || null,
        data_nascimento: editAlunoForm.data_nascimento || null,
        pais: editAlunoForm.pais || 'Brasil',
        endereco: editAlunoForm.endereco || null,
        cep: editAlunoForm.cep || null,
        cidade_estado: editAlunoForm.cidade_estado || null,
        turma_id: nextTurmaId,
        dia_vencimento: nextDiaVenc,
        dia_vencimento_contrato: `dia ${nextDiaVenc}`,
        data_inicio: editAlunoForm.data_inicio || null,
        data_fim: editAlunoForm.data_fim || null,
        data_matricula: nextDataMatricula,
        status: editAlunoForm.status || alunoDetail.status,
        origem_lead: editAlunoForm.origem_lead || null,
        valor_mensalidade: nextValorAluno,
        forma_pagamento: nextMethod,
        forms_respondido: editAlunoForm.forms_respondido ?? false,
        forms_respondido_em: checkedDate(editAlunoForm.forms_respondido, editAlunoForm.forms_respondido_em, alunoDetail.forms_respondido_em),
        contrato_enviado: editAlunoForm.contrato_enviado ?? false,
        contrato_enviado_em: checkedDate(editAlunoForm.contrato_enviado, editAlunoForm.contrato_enviado_em, alunoDetail.contrato_enviado_em),
        contrato_assinado: editAlunoForm.contrato_assinado ?? false,
        contrato_assinado_em: checkedDate(editAlunoForm.contrato_assinado, editAlunoForm.contrato_assinado_em, alunoDetail.contrato_assinado_em),
        autentique_documento_id: editAlunoForm.autentique_documento_id || null,
        autentique_link_assinatura: editAlunoForm.autentique_link_assinatura || null,
        total_mensalidades: targetTotal,
        observacoes: editAlunoForm.observacoes || null,
      };
      const { error } = await supabase.from('alunos').update(updateData).eq('id', alunoDetail.id);
      if (error) throw error;

      if (financialChanged) {
        await sincronizarParcelasAluno({
          alunoId: alunoDetail.id,
          turmaId: nextTurmaId,
          produto: activeTab,
          method: nextMethod,
          diaVencimento: nextDiaVenc,
          dataMatricula: nextDataMatricula,
          valor: valorEfetivo,
        });
      } else {
        await atualizarContadoresAluno(alunoDetail.id);
      }

      toast({ title: 'Aluno atualizado!' });
      setShowAlunoDetail(false);
      loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSavingAluno(false);
    }
  };

  const deleteAluno = async () => {
    if (!alunoToDelete) return;
    await supabase.from('pagamentos').delete().eq('aluno_id', alunoToDelete.id);
    const { error } = await supabase.from('alunos').delete().eq('id', alunoToDelete.id);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: error.message }); return; }
    toast({ title: 'Aluno removido!' });
    setShowDeleteDialog(false);
    setAlunoToDelete(null);
    loadData();
  };

  const abrirPagoDialog = (pagamentoId: string, alunoId: string) => {
    const hoje = todayDateInput();
    setPagoInfo({ pagamentoId, alunoId, data: hoje });
    setShowPagoDialog(true);
  };

  const confirmarPago = async () => {
    if (!pagoInfo) return;
    const { error } = await supabase.from('pagamentos').update({ status: 'pago', data_pagamento: pagoInfo.data }).eq('id', pagoInfo.pagamentoId);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: error.message }); return; }
    await atualizarContadoresAluno(pagoInfo.alunoId);
    toast({ title: 'Pagamento confirmado!' });
    setShowPagoDialog(false);
    setPagoInfo(null);
    loadData();
  };

  const marcarComoPago = async (pagamentoId: string, alunoId: string) => {
    abrirPagoDialog(pagamentoId, alunoId);
  };

  const estornarPagamento = async (pagamentoId: string, alunoId: string) => {
    const pagamento = pagamentos.find(p => p.id === pagamentoId);
    const vencimento = pagamento?.data_vencimento ? parseDateOnly(pagamento.data_vencimento) : null;
    const hoje = parseDateOnly(todayDateInput())!;
    const status = vencimento && vencimento < hoje ? 'atrasado' : 'pendente';
    await supabase.from('pagamentos').update({ status, data_pagamento: null }).eq('id', pagamentoId);
    await atualizarContadoresAluno(alunoId);
    toast({ title: 'Estornado!' });
    loadData();
  };

  // Sub-componente compartilhado para Alunos e Turmas
  const ProdutoContent = () => (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border pb-2">
        <button onClick={() => setSubView('alunos')} className={`px-4 py-1.5 rounded-t text-sm font-medium transition-colors ${subView === 'alunos' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}>
          <Users className="h-3.5 w-3.5 inline mr-1" />Alunos
        </button>
        <button onClick={() => setSubView('turmas')} className={`px-4 py-1.5 rounded-t text-sm font-medium transition-colors ${subView === 'turmas' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}>
          <Building2 className="h-3.5 w-3.5 inline mr-1" />Turmas
        </button>
      </div>

      {subView === 'alunos' && (
        <>
          {/* Filtro de periodo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Periodo:</span>
            {Object.entries(periodoLabel).map(([key, label]) => (
              <button key={key} onClick={() => setPeriodo(key)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${periodo === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Filtro de status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            {([
              { key: 'todos', label: 'Todos', color: 'bg-muted text-muted-foreground', active: 'bg-gray-700 text-white' },
              { key: 'ativo', label: 'Ativos', color: 'bg-muted text-muted-foreground', active: 'bg-green-600 text-white' },
              { key: 'inadimplente', label: `Inadimplentes (${inadimplentes.length})`, color: 'bg-muted text-muted-foreground', active: 'bg-red-600 text-white' },
              { key: 'cancelado', label: 'Cancelados', color: 'bg-muted text-muted-foreground', active: 'bg-gray-500 text-white' },
            ] as { key: typeof statusFilter; label: string; color: string; active: string }[]).map(({ key, label, color, active }) => (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === key ? active : color + ' hover:bg-muted/70'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Filtros financeiros */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Pagamento:</span>
            {([
              { key: 'todos', label: 'Todos' },
              { key: 'boleto', label: `Boleto (${paymentCounts.boleto})` },
              { key: 'cartao', label: `Cartao pago (${paymentCounts.cartao})` },
              { key: 'avista', label: `A vista pago (${paymentCounts.avista})` },
            ] as { key: PaymentFilter; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => {
                setPaymentFilter(key);
                if (key === 'cartao' || key === 'avista') setDueDayFilter('todos');
              }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${paymentFilter === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Dia venc.:</span>
            <button onClick={() => setDueDayFilter('todos')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${dueDayFilter === 'todos' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
              Todos
            </button>
            {dueDayOptions.map(({ key, day, count }) => (
              <button key={key} onClick={() => {
                setDueDayFilter(key);
                setPaymentFilter('boleto');
              }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${dueDayFilter === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                Dia {day} ({count})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Situacao:</span>
            {([
              { key: 'todos', label: 'Todos' },
              { key: 'vencidos', label: 'Vencidos' },
              { key: 'hoje', label: 'Hoje' },
              { key: 'proximos_7', label: '7 dias' },
              { key: 'proximos_30', label: '30 dias' },
              { key: 'quitados', label: 'Quitados' },
            ] as { key: DueFilter; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => setDueFilter(key)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${dueFilter === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="h-4 w-4 text-green-600" /></div>
              <div><p className="text-xs text-muted-foreground">Recebido - {periodoLabel[periodo]}</p><p className="text-lg font-bold text-green-600">{formatCurrency(receitaMes)}</p></div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Target className="h-4 w-4 text-blue-600" /></div>
              <div><p className="text-xs text-muted-foreground">Previsto - {periodoLabel[periodo]}</p><p className="text-lg font-bold text-blue-600">{formatCurrency(previstoMes)}</p></div>
            </Card>
            <Card className="p-4 flex items-center gap-3 border-red-100">
              <div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="h-4 w-4 text-red-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Inadimplentes</p>
                <p className="text-lg font-bold text-red-600">{inadimplentes.length}</p>
                {totalEmAtraso > 0 && <p className="text-xs text-red-500 font-medium">{formatCurrency(totalEmAtraso)} em atraso</p>}
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg"><TrendingUp className="h-4 w-4 text-purple-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Alunos Ativos</p>
                <p className="text-lg font-bold text-purple-600">{filteredAlunos.filter(a => a.status === 'ativo').length}</p>
                <p className="text-xs text-muted-foreground">{contratosPendentes > 0 ? `${contratosPendentes} sem contrato` : 'Todos c/ contrato'}</p>
              </div>
            </Card>
          </div>

          {/* Filtro turma */}
          <Card className="p-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium whitespace-nowrap">Turma:</label>
              <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as turmas</SelectItem>
                  {filteredTurmas.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome} ({alunos.filter(a => a.turma_id === t.id).length} alunos)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Alunos agrupados por turma */}
          {filteredAlunos.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum aluno cadastrado</p>
              <Button onClick={() => setShowAlunoDialog(true)} className="mt-3 bg-primary text-white"><Plus className="h-4 w-4 mr-1" />Adicionar Aluno</Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {alunosPorTurma.map(([turmaId, grupo]) => {
                const turma = turmas.find(t => t.id === turmaId);
                const turmaLabel = turmaId === '__sem_turma__' ? 'Sem turma' : (turma?.nome || turmaId);
                return (
                  <Card key={turmaId} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />{turmaLabel}
                        {turma?.valor_mensalidade && <span className="text-xs font-normal text-muted-foreground ml-1">- {formatCurrency(turma.valor_mensalidade)}/mes</span>}
                      </h3>
                      <Badge variant="secondary">{grupo.length} aluno{grupo.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left py-2 px-3 font-medium">Nome</th>
                            <th className="text-left py-2 px-3 font-medium">WhatsApp</th>
                            <th className="text-left py-2 px-3 font-medium">Turma</th>
                            <th className="text-left py-2 px-3 font-medium">Pagamento</th>
                            <th className="text-left py-2 px-3 font-medium">Parcelas</th>
                            <th className="text-left py-2 px-3 font-medium">Prox. venc.</th>
                            <th className="text-left py-2 px-3 font-medium">Contrato</th>
                            <th className="text-left py-2 px-3 font-medium">Status</th>
                            <th className="text-left py-2 px-3 font-medium">Acoes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.map(aluno => {
                            const parcelasAluno = pagamentosPorAluno[aluno.id] || [];
                            const method = normalizePaymentMethod(aluno.forma_pagamento);
                            const dueDay = getAlunoDueDay(aluno, parcelasAluno);
                            const expectedTotal = paymentMethodTotal(method);
                            const total = method === 'boleto'
                              ? (parcelasAluno.length || aluno.total_mensalidades || turma?.total_mensalidades || expectedTotal)
                              : expectedTotal;
                            const pagas = method === 'boleto' ? parcelasAluno.filter(p => p.status === 'pago').length : expectedTotal;
                            const abertas = method === 'boleto'
                              ? parcelasAluno.filter(p => p.status !== 'pago').sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)))
                              : [];
                            const proximoVencimento = abertas[0]?.data_vencimento;
                            const pgBadge: Record<PaymentMethod, string> = { boleto: 'bg-orange-100 text-orange-700', cartao: 'bg-blue-100 text-blue-700', avista: 'bg-green-100 text-green-700' };

                            const inad = method === 'boleto' ? inadimplenciaMap[aluno.id] : undefined;
                            const contratoLabel = aluno.contrato_assinado ? 'Assinado' : aluno.contrato_enviado ? 'Enviado' : aluno.forms_respondido ? 'Forms ok' : 'Pendente';
                            const contratoClass = aluno.contrato_assinado
                              ? 'bg-green-100 text-green-800'
                              : aluno.contrato_enviado
                                ? 'bg-yellow-100 text-yellow-800'
                                : aluno.forms_respondido
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-700';
                            return (
                              <tr key={aluno.id} className={`border-b border-border/40 hover:bg-muted/40 ${inad ? 'bg-red-50/40' : ''}`}>
                                <td className="py-2.5 px-3 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    {aluno.nome}
                                    {aluno.contrato_assinado
                                      ? <span title="Contrato assinado" className="text-green-600 text-[10px] font-bold">-</span>
                                      : aluno.contrato_enviado
                                        ? <span title="Contrato enviado, aguardando assinatura" className="text-yellow-500 text-[10px] font-bold">-</span>
                                        : <span title="Sem contrato" className="text-gray-300 text-[10px]">-</span>
                                    }
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  {aluno.whatsapp ? <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{aluno.whatsapp}</span> : <span className="text-muted-foreground text-xs">-</span>}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground text-xs">{turma?.nome || '-'}</td>
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-col gap-1">
                                    <Badge className={pgBadge[method]}>{method === 'boleto' ? paymentLabels[method] : `${paymentLabels[method]} pago`}</Badge>
                                    <span className="text-[10px] text-muted-foreground">{method === 'boleto' ? `Dia ${dueDay}` : 'Quitado'}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <span>{pagas}/{total}</span>
                                    <Progress value={total ? (pagas / total) * 100 : 0} className="w-16 h-1.5" />
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-xs text-muted-foreground">
                                  {proximoVencimento ? safeDate(proximoVencimento) : 'Quitado'}
                                </td>
                                <td className="py-2.5 px-3">
                                  <Badge className={contratoClass}>{contratoLabel}</Badge>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-col gap-1">
                                    <Badge className={inad ? 'bg-red-100 text-red-800' : statusColors[aluno.status] || 'bg-gray-100 text-gray-800'}>
                                      {inad ? 'inadimplente' : aluno.status}
                                    </Badge>
                                    {inad && (
                                      <span className="text-[10px] text-red-600 font-medium leading-tight">
                                        {inad.parcelasAtrasadas}x - {inad.diasAtraso}d - {formatCurrency(inad.valorEmAtraso)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openAlunoDetail(aluno)} title="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => { setAlunoToDelete(aluno); setShowDeleteDialog(true); }} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {subView === 'turmas' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowTurmaDialog(true)} variant="outline"><Plus className="h-4 w-4 mr-1" />Nova Turma</Button>
          </div>
          {filteredTurmas.length === 0 ? (
            <Card className="p-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma turma cadastrada</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTurmas.map(turma => {
                const count = alunos.filter(a => a.turma_id === turma.id).length;
                const receitaTurma = pagamentos.filter(p => p.turma_id === turma.id && p.status === 'pago').reduce((s, p) => s + p.valor, 0);
                const isEditing = editingTurmaCardId === turma.id;
                return (
                  <Card key={turma.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {isEditing
                          ? <Input value={inlineTurmaForm.nome || ''} onChange={e => setInlineTurmaForm(f => ({ ...f, nome: e.target.value }))} className="font-bold text-base h-8 mb-1" autoFocus />
                          : <h4 className="font-bold text-base">{turma.nome}</h4>}
                        <Badge className="mt-1 text-xs bg-primary/10 text-primary">{turma.tipo || turma.produto}</Badge>
                      </div>
                      <div className="flex gap-1 ml-2">
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={saveInlineTurma} disabled={savingInlineTurma} className="h-7 text-xs bg-primary text-white">{savingInlineTurma ? '...' : 'Salvar'}</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingTurmaCardId(null)} className="h-7 text-xs">x</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingTurmaCardId(turma.id); setInlineTurmaForm({ nome: turma.nome, data_inicio: turma.data_inicio || '', data_fim: turma.data_fim || '', valor_mensalidade: turma.valor_mensalidade, total_mensalidades: turma.total_mensalidades }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteTurma(turma.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {isEditing ? (
                        <>
                          <div><label className="text-muted-foreground">Inicio</label><Input type="date" value={inlineTurmaForm.data_inicio || ''} onChange={e => setInlineTurmaForm(f => ({ ...f, data_inicio: e.target.value }))} className="h-7 mt-0.5 text-xs" /></div>
                          <div><label className="text-muted-foreground">Fim</label><Input type="date" value={inlineTurmaForm.data_fim || ''} onChange={e => setInlineTurmaForm(f => ({ ...f, data_fim: e.target.value }))} className="h-7 mt-0.5 text-xs" /></div>
                          <div><label className="text-muted-foreground">Mensalidade (R$)</label><Input type="number" step="0.01" value={inlineTurmaForm.valor_mensalidade ?? ''} onChange={e => setInlineTurmaForm(f => ({ ...f, valor_mensalidade: parseFloat(e.target.value) || undefined }))} className="h-7 mt-0.5 text-xs" /></div>
                          <div><label className="text-muted-foreground">Total Parcelas</label><Input type="number" value={inlineTurmaForm.total_mensalidades ?? ''} onChange={e => setInlineTurmaForm(f => ({ ...f, total_mensalidades: parseInt(e.target.value) || undefined }))} className="h-7 mt-0.5 text-xs" /></div>
                        </>
                      ) : (
                        <>
                          <div className="text-muted-foreground"><span className="font-medium text-foreground">Inicio:</span> {safeDate(turma.data_inicio) || '-'}</div>
                          <div className="text-muted-foreground"><span className="font-medium text-foreground">Fim:</span> {safeDate(turma.data_fim) || '-'}</div>
                          <div className="text-muted-foreground"><span className="font-medium text-foreground">Mensalidade:</span> {turma.valor_mensalidade ? formatCurrency(turma.valor_mensalidade) : '-'}</div>
                          <div className="text-muted-foreground"><span className="font-medium text-foreground">Parcelas:</span> {turma.total_mensalidades ?? '-'}</div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>{count} aluno{count !== 1 ? 's' : ''}</div>
                        {receitaTurma > 0 && <div className="text-green-600 font-medium">Recebido: {formatCurrency(receitaTurma)}</div>}
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setSelectedTurmaId(turma.id); setSubView('alunos'); }}>Ver alunos</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" /><p className="text-muted-foreground">Carregando...</p></div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Gestao completa de turmas e pagamentos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTurmaDialog(true)}><Plus className="h-4 w-4 mr-1" />Nova Turma</Button>
            <Button onClick={() => setShowAlunoDialog(true)} className="bg-primary text-white"><Plus className="h-4 w-4 mr-1" />Adicionar Aluno</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ProdutoTab); setSubView('alunos'); setSelectedTurmaId('todas'); }}>
          <TabsList className="grid w-full max-w-xs grid-cols-2 mb-4">
            <TabsTrigger value="psicanalise">Psicanalise</TabsTrigger>
            <TabsTrigger value="numerologia">Numerologia</TabsTrigger>
          </TabsList>
          <TabsContent value="psicanalise"><ProdutoContent /></TabsContent>
          <TabsContent value="numerologia"><ProdutoContent /></TabsContent>
        </Tabs>
      </div>

      {/* Modal Nova Turma */}
      <Dialog open={showTurmaDialog} onOpenChange={setShowTurmaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Turma</DialogTitle><DialogDescription>Crie uma nova turma</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome da Turma *</label>
              <Input value={newTurmaForm.nome} onChange={e => setNewTurmaForm({ ...newTurmaForm, nome: e.target.value })} placeholder="Ex: Turma 02226" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Produto</label>
              <Select value={newTurmaForm.produto} onValueChange={v => setNewTurmaForm({ ...newTurmaForm, produto: v as ProdutoTab })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="psicanalise">Psicanalise</SelectItem>
                  <SelectItem value="numerologia">Numerologia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Data Inicio</label><Input type="date" value={newTurmaForm.data_inicio} onChange={e => setNewTurmaForm({ ...newTurmaForm, data_inicio: e.target.value })} className="mt-1" /></div>
              <div><label className="text-sm font-medium">Data Fim</label><Input type="date" value={newTurmaForm.data_fim} onChange={e => setNewTurmaForm({ ...newTurmaForm, data_fim: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Valor Mensalidade</label><Input type="number" step="0.01" value={newTurmaForm.valor_mensalidade} onChange={e => setNewTurmaForm({ ...newTurmaForm, valor_mensalidade: e.target.value })} className="mt-1" /></div>
              <div><label className="text-sm font-medium">Total Parcelas</label><Input type="number" value={newTurmaForm.total_mensalidades} onChange={e => setNewTurmaForm({ ...newTurmaForm, total_mensalidades: e.target.value })} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTurmaDialog(false)}>Cancelar</Button>
            <Button onClick={createTurma} className="bg-primary text-white">Criar Turma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Turma */}
      <Dialog open={showEditTurma} onOpenChange={setShowEditTurma}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Turma</DialogTitle><DialogDescription>{turmaToEdit?.nome}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Nome</label><Input value={editTurmaForm.nome || ''} onChange={e => setEditTurmaForm({ ...editTurmaForm, nome: e.target.value })} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Data Inicio</label><Input type="date" value={editTurmaForm.data_inicio || ''} onChange={e => setEditTurmaForm({ ...editTurmaForm, data_inicio: e.target.value })} className="mt-1" /></div>
              <div><label className="text-sm font-medium">Data Fim</label><Input type="date" value={editTurmaForm.data_fim || ''} onChange={e => setEditTurmaForm({ ...editTurmaForm, data_fim: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Valor Mensalidade</label><Input type="number" step="0.01" value={editTurmaForm.valor_mensalidade || ''} onChange={e => setEditTurmaForm({ ...editTurmaForm, valor_mensalidade: parseFloat(e.target.value) })} className="mt-1" /></div>
              <div><label className="text-sm font-medium">Total Parcelas</label><Input type="number" value={editTurmaForm.total_mensalidades || ''} onChange={e => setEditTurmaForm({ ...editTurmaForm, total_mensalidades: parseInt(e.target.value) })} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTurma(false)}>Cancelar</Button>
            <Button onClick={saveEditTurma} disabled={savingTurma} className="bg-primary text-white">{savingTurma ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Aluno */}
      <Dialog open={showAlunoDialog} onOpenChange={setShowAlunoDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adicionar Aluno</DialogTitle><DialogDescription>Adicione um novo aluno na turma</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Nome *</label><Input value={newAlunoForm.nome} onChange={e => setNewAlunoForm({ ...newAlunoForm, nome: e.target.value })} placeholder="Nome completo" className="mt-1" /></div>
            <div><label className="text-sm font-medium">WhatsApp</label><Input value={newAlunoForm.whatsapp} onChange={e => setNewAlunoForm({ ...newAlunoForm, whatsapp: e.target.value })} placeholder="(11) 99999-9999" className="mt-1" /></div>
            <div><label className="text-sm font-medium">Email</label><Input type="email" value={newAlunoForm.email} onChange={e => setNewAlunoForm({ ...newAlunoForm, email: e.target.value })} placeholder="email@example.com" className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">CPF</label><Input value={newAlunoForm.cpf} onChange={e => setNewAlunoForm({ ...newAlunoForm, cpf: e.target.value })} placeholder="000.000.000-00" className="mt-1" /></div>
              <div><label className="text-sm font-medium">Data de nascimento</label><Input type="date" value={newAlunoForm.data_nascimento} onChange={e => setNewAlunoForm({ ...newAlunoForm, data_nascimento: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Pais</label><Input value={newAlunoForm.pais} onChange={e => setNewAlunoForm({ ...newAlunoForm, pais: e.target.value })} className="mt-1" /></div>
              <div><label className="text-sm font-medium">CEP</label><Input value={newAlunoForm.cep} onChange={e => setNewAlunoForm({ ...newAlunoForm, cep: e.target.value })} className="mt-1" /></div>
            </div>
            <div><label className="text-sm font-medium">Endereco completo</label><Input value={newAlunoForm.endereco} onChange={e => setNewAlunoForm({ ...newAlunoForm, endereco: e.target.value })} className="mt-1" /></div>
            <div><label className="text-sm font-medium">Cidade / Estado</label><Input value={newAlunoForm.cidade_estado} onChange={e => setNewAlunoForm({ ...newAlunoForm, cidade_estado: e.target.value })} className="mt-1" /></div>
            <div>
              <label className="text-sm font-medium">Turma *</label>
              <Select value={newAlunoForm.turma_id} onValueChange={v => setNewAlunoForm({ ...newAlunoForm, turma_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
                <SelectContent>{filteredTurmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Data de Matricula</label><Input type="date" value={newAlunoForm.data_matricula} onChange={e => setNewAlunoForm({ ...newAlunoForm, data_matricula: e.target.value })} className="mt-1" /><p className="text-[10px] text-muted-foreground mt-0.5">Data do 1o pagamento / ato de matricula</p></div>
              <div><label className="text-sm font-medium">Data de Inicio da Turma</label><Input type="date" value={newAlunoForm.data_inicio} onChange={e => setNewAlunoForm({ ...newAlunoForm, data_inicio: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Data fim</label><Input type="date" value={newAlunoForm.data_fim} onChange={e => setNewAlunoForm({ ...newAlunoForm, data_fim: e.target.value })} className="mt-1" /></div>
              <div><label className="text-sm font-medium">Valor personalizado</label><Input type="number" step="0.01" value={newAlunoForm.valor_mensalidade} onChange={e => setNewAlunoForm({ ...newAlunoForm, valor_mensalidade: e.target.value })} placeholder="Vazio = valor da turma" className="mt-1" /></div>
            </div>
            <div>
              <label className="text-sm font-medium">Dia Vencimento</label>
              <Select value={newAlunoForm.dia_vencimento} onValueChange={v => setNewAlunoForm({ ...newAlunoForm, dia_vencimento: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{[1,5,10,15,20,25,28,30].map(d => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Forma de Pagamento</label>
              <Select value={newAlunoForm.forma_pagamento} onValueChange={v => setNewAlunoForm({ ...newAlunoForm, forma_pagamento: v as PaymentMethod })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto - 15 mensalidades</SelectItem>
                  <SelectItem value="cartao">Cartao - 12x</SelectItem>
                  <SelectItem value="avista">A vista - 1/1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Origem</label>
              <Select value={newAlunoForm.origem} onValueChange={v => setNewAlunoForm({ ...newAlunoForm, origem: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direto">Direto</SelectItem>
                  <SelectItem value="lancamento">Lancamento</SelectItem>
                  <SelectItem value="npa">NPA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Observacoes</label>
              <Textarea value={newAlunoForm.observacoes} onChange={e => setNewAlunoForm({ ...newAlunoForm, observacoes: e.target.value })} placeholder="Informacoes do contrato, cobranca ou atendimento..." className="mt-1 min-h-16" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlunoDialog(false)}>Cancelar</Button>
            <Button onClick={createAluno} className="bg-primary text-white">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhe/Edicao do Aluno */}
      <Dialog open={showAlunoDetail} onOpenChange={setShowAlunoDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{alunoDetail?.nome}</DialogTitle>
            <DialogDescription>Edite os dados e gerencie pagamentos</DialogDescription>
          </DialogHeader>
          {alunoDetail && (() => {
            const parcelas = filteredPagamentos.filter(p => p.aluno_id === alunoDetail.id).sort((a, b) => a.numero_parcela - b.numero_parcela);
            const pagas = parcelas.filter(p => p.status === 'pago').length;
            const atrasadas = parcelas.filter(p => p.status === 'atrasado').length;
            const total = parcelas.length;
            const turmaAtual = turmas.find(t => t.id === (editAlunoForm.turma_id || alunoDetail.turma_id));
            const valorEfetivo = editAlunoForm.valor_mensalidade ?? turmaAtual?.valor_mensalidade ?? 0;
            return (
              <div className="space-y-5">

                {/* Contrato */}
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrato</span>
                  <button
                    onClick={() => setEditAlunoForm(f => ({ ...f, contrato_enviado: !f.contrato_enviado, contrato_enviado_em: !f.contrato_enviado ? (f.contrato_enviado_em || todayDateInput()) : '' }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${editAlunoForm.contrato_enviado ? 'bg-blue-500 text-white' : 'bg-white border border-border text-muted-foreground'}`}>
                    Enviado
                  </button>
                  <button
                    onClick={() => setEditAlunoForm(f => ({ ...f, contrato_assinado: !f.contrato_assinado, contrato_assinado_em: !f.contrato_assinado ? (f.contrato_assinado_em || todayDateInput()) : '', contrato_enviado: f.contrato_assinado ? f.contrato_enviado : true, contrato_enviado_em: f.contrato_assinado ? f.contrato_enviado_em : (f.contrato_enviado_em || todayDateInput()) }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${editAlunoForm.contrato_assinado ? 'bg-green-500 text-white' : 'bg-white border border-border text-muted-foreground'}`}>
                    Assinado
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Select value={editAlunoForm.status || 'ativo'} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, status: v as Aluno['status'] })}>
                      <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inadimplente">Inadimplente</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                        <SelectItem value="concluido">Concluido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full pt-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={!!editAlunoForm.forms_respondido} onCheckedChange={checked => setEditAlunoForm(f => ({ ...f, forms_respondido: checked, forms_respondido_em: checked ? (f.forms_respondido_em || todayDateInput()) : '' }))} />
                      <span className="text-xs font-medium">Forms respondido</span>
                    </div>
                    <div><label className="text-xs text-muted-foreground">Data forms</label><Input type="date" value={editAlunoForm.forms_respondido_em || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, forms_respondido_em: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">Contrato enviado em</label><Input type="date" value={editAlunoForm.contrato_enviado_em || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, contrato_enviado_em: e.target.value, contrato_enviado: !!e.target.value || editAlunoForm.contrato_enviado })} className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">Assinado em</label><Input type="date" value={editAlunoForm.contrato_assinado_em || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, contrato_assinado_em: e.target.value, contrato_assinado: !!e.target.value || editAlunoForm.contrato_assinado })} className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">ID Autentique</label><Input value={editAlunoForm.autentique_documento_id || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, autentique_documento_id: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div className="lg:col-span-3"><label className="text-xs text-muted-foreground">Link de assinatura</label><Input value={editAlunoForm.autentique_link_assinatura || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, autentique_link_assinatura: e.target.value })} placeholder="https://..." className="mt-1 h-8 text-sm" /></div>
                  </div>
                </div>

                {/* Dados pessoais */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dados Pessoais</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-muted-foreground">Nome</label><Input value={editAlunoForm.nome || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, nome: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={editAlunoForm.whatsapp || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, whatsapp: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">Email</label><Input type="email" value={editAlunoForm.email || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, email: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">CPF</label><Input value={editAlunoForm.cpf || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, cpf: e.target.value })} placeholder="000.000.000-00" className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">Data de nascimento</label><Input type="date" value={editAlunoForm.data_nascimento || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, data_nascimento: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">Pais</label><Input value={editAlunoForm.pais || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, pais: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">CEP</label><Input value={editAlunoForm.cep || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, cep: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div><label className="text-xs text-muted-foreground">Cidade / Estado</label><Input value={editAlunoForm.cidade_estado || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, cidade_estado: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div className="col-span-2"><label className="text-xs text-muted-foreground">Endereco completo</label><Input value={editAlunoForm.endereco || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, endereco: e.target.value })} className="mt-1 h-8 text-sm" /></div>
                    <div>
                      <label className="text-xs text-muted-foreground">Origem</label>
                      <Select value={editAlunoForm.origem_lead || 'direto'} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, origem_lead: v })}>
                        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direto">Direto</SelectItem>
                          <SelectItem value="lancamento">Lancamento</SelectItem>
                          <SelectItem value="npa">NPA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Observacoes</label>
                      <Textarea value={editAlunoForm.observacoes || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, observacoes: e.target.value })} placeholder="Observacoes sobre contrato, cobranca ou atendimento..." className="mt-1 min-h-16 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Financeiro */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Financeiro</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Turma</label>
                      <Select value={editAlunoForm.turma_id || ''} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, turma_id: v })}>
                        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{turmas.filter(t => t.produto === activeTab || t.tipo === activeTab).map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Forma de Pagamento</label>
                      <Select value={editAlunoForm.forma_pagamento || ''} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, forma_pagamento: v })}>
                        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                  <SelectItem value="boleto">Boleto - 15 mensalidades</SelectItem>
                  <SelectItem value="cartao">Cartao - 12x</SelectItem>
                  <SelectItem value="avista">A vista - 1/1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Valor mensalidade (R$)</label>
                      <Input type="number" step="0.01" value={editAlunoForm.valor_mensalidade ?? ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, valor_mensalidade: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder={turmaAtual?.valor_mensalidade ? `Padrao: R$ ${turmaAtual.valor_mensalidade}` : 'Padrao da turma'} className="mt-1 h-8 text-sm" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Vazio = usa valor da turma. Salvar atualiza parcelas pendentes.</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Dia vencimento</label>
                      <Select value={String(editAlunoForm.dia_vencimento || 10)} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, dia_vencimento: parseInt(v) })}>
                        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1,5,10,15,20,25,28,30].map(d => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Ato de matricula / 1a parcela</label>
                      <Input type="date" value={editAlunoForm.data_matricula || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, data_matricula: e.target.value })} className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Data de inicio da turma</label>
                      <Input type="date" value={editAlunoForm.data_inicio || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, data_inicio: e.target.value })} className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Data fim</label>
                      <Input type="date" value={editAlunoForm.data_fim || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, data_fim: e.target.value })} className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Parcelas calculadas</label>
                      <Input value={`${pagas}/${total || paymentMethodTotal(editAlunoForm.forma_pagamento)}`} readOnly className="mt-1 h-8 text-sm bg-muted/50" />
                    </div>
                  </div>
                </div>

                {/* Parcelas */}
                <div>
                  <div className="flex items-center justify-between mb-2 pt-1 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Parcelas - {total > 0 ? `${pagas}/${total} pagas` : 'nenhuma gerada'}
                      {atrasadas > 0 && <span className="ml-2 text-red-600">- {atrasadas} em atraso</span>}
                    </p>
                    {total > 0 && valorEfetivo > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Total: {formatCurrency(valorEfetivo * total)} - Recebido: {formatCurrency(parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0))}
                      </span>
                    )}
                  </div>
                  {total === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma parcela gerada. Adicione o aluno com forma de pagamento para gerar automaticamente.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left py-2 px-2 font-medium text-xs">No.</th>
                            <th className="text-left py-2 px-2 font-medium text-xs">Vencimento</th>
                            <th className="text-left py-2 px-2 font-medium text-xs">Pago em</th>
                            <th className="text-left py-2 px-2 font-medium text-xs">Valor</th>
                            <th className="text-left py-2 px-2 font-medium text-xs">Status</th>
                            <th className="text-left py-2 px-3 font-medium">Acoes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parcelas.map(p => (
                            <tr key={p.id} className={`border-b border-border/40 transition-colors ${p.status === 'atrasado' ? 'bg-red-50' : p.status === 'pago' ? 'bg-green-50/60' : 'hover:bg-muted/30'}`}>
                              <td className="py-2 px-2 font-medium text-xs">{p.numero_parcela}/{total}</td>
                              <td className="py-2 px-2 text-xs">{safeDate(p.data_vencimento)}</td>
                              <td className="py-2 px-2 text-xs">
                                {p.data_pagamento
                                  ? <span className="text-green-700 font-medium">{safeDate(p.data_pagamento)}</span>
                                  : <span className="text-muted-foreground">-</span>}
                              </td>
                              <td className="py-2 px-2 font-semibold text-xs">{formatCurrency(p.valor)}</td>
                              <td className="py-2 px-2">
                                <Badge className={`text-[10px] px-1.5 py-0.5 ${p.status === 'pago' ? 'bg-green-100 text-green-800' : p.status === 'atrasado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                  {p.status === 'pago' ? 'Pago' : p.status === 'atrasado' ? 'Atrasado' : 'Pendente'}
                                </Badge>
                              </td>
                              <td className="py-2 px-2">
                                {p.status === 'pago'
                                  ? <Button variant="ghost" size="sm" onClick={() => estornarPagamento(p.id, alunoDetail.id)} className="text-orange-500 hover:text-orange-700 h-6 px-2 text-[10px]">Estornar</Button>
                                  : <Button variant="ghost" size="sm" onClick={() => marcarComoPago(p.id, alunoDetail.id)} className="text-green-600 hover:text-green-800 h-6 px-2 text-[10px] font-semibold">Pago</Button>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlunoDetail(false)}>Fechar</Button>
            <Button onClick={saveAlunoDetail} disabled={savingAluno} className="bg-primary text-white"><CheckCircle2 className="h-4 w-4 mr-1" />{savingAluno ? 'Salvando...' : 'Salvar Alteracoes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Pagamento com Data */}
      <Dialog open={showPagoDialog} onOpenChange={setShowPagoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar Pagamento</DialogTitle><DialogDescription>Informe a data em que o pagamento foi realizado</DialogDescription></DialogHeader>
          <div>
            <label className="text-sm font-medium">Data do Pagamento</label>
            <Input type="date" value={pagoInfo?.data || ''} onChange={e => setPagoInfo(prev => prev ? { ...prev, data: e.target.value } : prev)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagoDialog(false)}>Cancelar</Button>
            <Button onClick={confirmarPago} className="bg-green-600 hover:bg-green-700 text-white">Confirmar Pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusao */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Confirmar Exclusao</DialogTitle><DialogDescription>Tem certeza que deseja remover <strong>{alunoToDelete?.nome}</strong>? Todos os pagamentos vinculados serao excluidos.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteAluno}>Confirmar Exclusao</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
