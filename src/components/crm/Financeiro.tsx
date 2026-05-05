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
import { toast } from '@/components/ui/use-toast';
import {
  Plus, DollarSign, Users, AlertCircle, Eye, Trash2,
  TrendingUp, Target, Phone, Pencil, Building2, CheckCircle2
} from 'lucide-react';
import { format, isSameMonth, parseISO, startOfMonth, endOfMonth } from 'date-fns';
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
  dia_vencimento?: number;
  status: 'ativo' | 'inadimplente' | 'cancelado' | 'concluido';
  mensalidades_pagas?: number;
  total_mensalidades?: number;
  data_inicio?: string;
  data_fim?: string;
  origem_lead?: string;
  valor_mensalidade?: number;
  forma_pagamento?: string;
  observacoes?: string;
  contrato_enviado?: boolean;
  contrato_enviado_em?: string;
  contrato_assinado?: boolean;
  contrato_assinado_em?: string;
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

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const safeDate = (s?: string) => {
  if (!s) return '';
  try { return format(parseISO(s), 'dd/MM/yyyy', { locale: ptBR }); } catch { return s; }
};

const statusColors: Record<string, string> = {
  ativo: 'bg-green-100 text-green-800',
  inadimplente: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
  concluido: 'bg-blue-100 text-blue-800',
};

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

  // Formulários
  const emptyTurmaForm = { nome: '', produto: 'psicanalise' as ProdutoTab, data_inicio: '', data_fim: '', valor_mensalidade: '109.90', total_mensalidades: '15' };
  const emptyAlunoForm = { nome: '', whatsapp: '', email: '', turma_id: '', data_inicio: '', data_matricula: '', dia_vencimento: '10', origem: 'direto', forma_pagamento: 'boleto' };

  const [newTurmaForm, setNewTurmaForm] = useState(emptyTurmaForm);
  const [newAlunoForm, setNewAlunoForm] = useState(emptyAlunoForm);
  const [editAlunoForm, setEditAlunoForm] = useState<Partial<Aluno> & { turma_id_new?: string }>({});
  const [editTurmaForm, setEditTurmaForm] = useState<Partial<Turma>>({});
  const [savingAluno, setSavingAluno] = useState(false);
  const [savingTurma, setSavingTurma] = useState(false);
  const [showPagoDialog, setShowPagoDialog] = useState(false);
  const [pagoInfo, setPagoInfo] = useState<{ pagamentoId: string; alunoId: string; data: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inadimplente' | 'cancelado'>('todos');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [turmasRes, alunosRes, pagamentosRes] = await Promise.all([
        supabase.from('turmas').select('id, nome, produto, tipo, data_inicio, data_fim, valor_mensalidade, total_mensalidades, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('alunos').select('id, turma_id, produto, nome, whatsapp, email, cpf, dia_vencimento, status, mensalidades_pagas, total_mensalidades, data_inicio, data_fim, origem_lead, valor_mensalidade, forma_pagamento, observacoes, contrato_enviado, contrato_enviado_em, contrato_assinado, contrato_assinado_em, created_at').order('created_at', { ascending: false }).limit(500),
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

  // Inadimplência calculada a partir dos pagamentos reais (não do campo manual)
  const inadimplenciaMap = useMemo(() => {
    const map: Record<string, { diasAtraso: number; valorEmAtraso: number; parcelasAtrasadas: number }> = {};
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    filteredPagamentos.forEach(p => {
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
  }, [filteredPagamentos]);

  const filteredAlunos = useMemo(() => {
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

  const currentMonth = new Date();

  const periodoLabel: Record<string, string> = { this_month: 'Este mês', last_month: 'Mês passado', last_3m: 'Últimos 3 meses', this_year: 'Este ano', all: 'Tudo' };

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
    if (!confirm('Excluir turma? Os alunos não serão deletados.')) return;
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
  const gerarPagamentos = async (alunoId: string, turmaId: string, formaPgto: string, diaVenc: number, dataInicio: string | null) => {
    const turma = turmas.find(t => t.id === turmaId);
    const valor = turma?.valor_mensalidade || 109.90;
    const totalParcelas = formaPgto === 'boleto' ? 15 : formaPgto === 'cartao' ? 12 : 1;
    const start = dataInicio ? new Date(dataInicio + 'T12:00:00') : new Date();
    const hoje = new Date().toISOString().split('T')[0];
    const rows = Array.from({ length: totalParcelas }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, diaVenc);
      // mes_referencia is DATE type in DB — use first day of the month
      const mesRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return {
        aluno_id: alunoId,
        turma_id: turmaId,
        produto: activeTab,
        valor,
        mes_referencia: mesRef,
        data_vencimento: d.toISOString().split('T')[0],
        numero_parcela: i + 1,
        status: formaPgto === 'pix' ? 'pago' : 'pendente',
        ...(formaPgto === 'pix' ? { data_pagamento: hoje } : {}),
      };
    });
    const { error } = await supabase.from('pagamentos').insert(rows);
    if (error) console.error('Erro ao gerar pagamentos:', error.message);
  };

  const createAluno = async () => {
    if (!newAlunoForm.nome.trim() || !newAlunoForm.turma_id) return;
    try {
      const diaVenc = parseInt(newAlunoForm.dia_vencimento) || 10;
      const totalMens = newAlunoForm.forma_pagamento === 'pix' ? 1 : newAlunoForm.forma_pagamento === 'cartao' ? 12 : 15;
      const { data: inserted, error } = await supabase.from('alunos').insert({
        turma_id: newAlunoForm.turma_id,
        produto: activeTab,
        nome: newAlunoForm.nome,
        whatsapp: newAlunoForm.whatsapp || null,
        email: newAlunoForm.email || null,
        dia_vencimento: diaVenc,
        status: 'ativo',
        mensalidades_pagas: newAlunoForm.forma_pagamento === 'pix' ? 1 : 0,
        total_mensalidades: totalMens,
        data_inicio: newAlunoForm.data_inicio || null,
        data_matricula: newAlunoForm.data_matricula || newAlunoForm.data_inicio || null,
        origem_lead: newAlunoForm.origem,
        forma_pagamento: newAlunoForm.forma_pagamento || null,
      }).select().single();
      if (error) throw error;
      await gerarPagamentos(inserted.id, newAlunoForm.turma_id, newAlunoForm.forma_pagamento, diaVenc, newAlunoForm.data_inicio || null);
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
      turma_id: a.turma_id,
      dia_vencimento: a.dia_vencimento,
      data_inicio: a.data_inicio || '',
      status: a.status,
      origem_lead: a.origem_lead || '',
      mensalidades_pagas: a.mensalidades_pagas || 0,
      valor_mensalidade: a.valor_mensalidade ?? undefined,
      forma_pagamento: a.forma_pagamento || '',
      contrato_enviado: a.contrato_enviado ?? false,
      contrato_assinado: a.contrato_assinado ?? false,
      total_mensalidades: a.total_mensalidades,
      observacoes: a.observacoes || '',
    });
    setShowAlunoDetail(true);
  };

  const saveAlunoDetail = async () => {
    if (!alunoDetail) return;
    setSavingAluno(true);
    try {
      const updateData: any = {
        nome: editAlunoForm.nome || alunoDetail.nome,
        whatsapp: editAlunoForm.whatsapp || null,
        email: editAlunoForm.email || null,
        cpf: editAlunoForm.cpf || null,
        turma_id: editAlunoForm.turma_id || alunoDetail.turma_id,
        dia_vencimento: editAlunoForm.dia_vencimento || null,
        data_inicio: editAlunoForm.data_inicio || null,
        status: editAlunoForm.status || alunoDetail.status,
        origem_lead: editAlunoForm.origem_lead || null,
        mensalidades_pagas: editAlunoForm.mensalidades_pagas ?? alunoDetail.mensalidades_pagas,
        valor_mensalidade: editAlunoForm.valor_mensalidade || null,
        forma_pagamento: editAlunoForm.forma_pagamento || null,
        contrato_enviado: editAlunoForm.contrato_enviado ?? false,
        contrato_assinado: editAlunoForm.contrato_assinado ?? false,
        total_mensalidades: editAlunoForm.total_mensalidades ?? null,
        observacoes: editAlunoForm.observacoes || null,
      };
      const { error } = await supabase.from('alunos').update(updateData).eq('id', alunoDetail.id);
      // Se valor personalizado definido, atualiza parcelas pendentes deste aluno
      if (!error && editAlunoForm.valor_mensalidade) {
        await supabase.from('pagamentos')
          .update({ valor: editAlunoForm.valor_mensalidade })
          .eq('aluno_id', alunoDetail.id)
          .eq('status', 'pendente');
      }
      if (error) throw error;
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
    const hoje = new Date().toISOString().split('T')[0];
    setPagoInfo({ pagamentoId, alunoId, data: hoje });
    setShowPagoDialog(true);
  };

  const confirmarPago = async () => {
    if (!pagoInfo) return;
    const dataISO = new Date(pagoInfo.data + 'T12:00:00').toISOString();
    const { error } = await supabase.from('pagamentos').update({ status: 'pago', data_pagamento: dataISO }).eq('id', pagoInfo.pagamentoId);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: error.message }); return; }
    const { data } = await supabase.from('alunos').select('mensalidades_pagas').eq('id', pagoInfo.alunoId).single();
    await supabase.from('alunos').update({ mensalidades_pagas: (data?.mensalidades_pagas || 0) + 1 }).eq('id', pagoInfo.alunoId);
    toast({ title: 'Pagamento confirmado!' });
    setShowPagoDialog(false);
    setPagoInfo(null);
    loadData();
  };

  const marcarComoPago = async (pagamentoId: string, alunoId: string) => {
    abrirPagoDialog(pagamentoId, alunoId);
  };

  const estornarPagamento = async (pagamentoId: string, alunoId: string) => {
    await supabase.from('pagamentos').update({ status: 'pendente', data_pagamento: null }).eq('id', pagamentoId);
    const { data } = await supabase.from('alunos').select('mensalidades_pagas').eq('id', alunoId).single();
    await supabase.from('alunos').update({ mensalidades_pagas: Math.max(0, (data?.mensalidades_pagas || 0) - 1) }).eq('id', alunoId);
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
          {/* Filtro de período */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Período:</span>
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

          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="h-4 w-4 text-green-600" /></div>
              <div><p className="text-xs text-muted-foreground">Recebido — {periodoLabel[periodo]}</p><p className="text-lg font-bold text-green-600">{formatCurrency(receitaMes)}</p></div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Target className="h-4 w-4 text-blue-600" /></div>
              <div><p className="text-xs text-muted-foreground">Previsto — {periodoLabel[periodo]}</p><p className="text-lg font-bold text-blue-600">{formatCurrency(previstoMes)}</p></div>
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
                        {turma?.valor_mensalidade && <span className="text-xs font-normal text-muted-foreground ml-1">· {formatCurrency(turma.valor_mensalidade)}/mês</span>}
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
                            <th className="text-left py-2 px-3 font-medium">Status</th>
                            <th className="text-left py-2 px-3 font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.map(aluno => {
                            const total = aluno.total_mensalidades || turma?.total_mensalidades || 15;
                            const pgBadge: Record<string, string> = { boleto: 'bg-orange-100 text-orange-700', cartao: 'bg-blue-100 text-blue-700', pix: 'bg-green-100 text-green-700' };
                            const pgLabel: Record<string, string> = { boleto: 'Mensalidade', cartao: 'Cartão', pix: 'À vista' };
                            const inad = inadimplenciaMap[aluno.id];
                            return (
                              <tr key={aluno.id} className={`border-b border-border/40 hover:bg-muted/40 ${inad ? 'bg-red-50/40' : ''}`}>
                                <td className="py-2.5 px-3 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    {aluno.nome}
                                    {aluno.contrato_assinado
                                      ? <span title="Contrato assinado" className="text-green-600 text-[10px] font-bold">✓</span>
                                      : aluno.contrato_enviado
                                        ? <span title="Contrato enviado, aguardando assinatura" className="text-yellow-500 text-[10px] font-bold">✉</span>
                                        : <span title="Sem contrato" className="text-gray-300 text-[10px]">○</span>
                                    }
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  {aluno.whatsapp ? <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{aluno.whatsapp}</span> : <span className="text-muted-foreground text-xs">—</span>}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground text-xs">{turma?.nome || '—'}</td>
                                <td className="py-2.5 px-3">
                                  {aluno.forma_pagamento
                                    ? <Badge className={pgBadge[aluno.forma_pagamento] || 'bg-gray-100 text-gray-700'}>{pgLabel[aluno.forma_pagamento] || aluno.forma_pagamento}</Badge>
                                    : <span className="text-muted-foreground text-xs">—</span>}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <span>{aluno.mensalidades_pagas ?? 0}/{total}</span>
                                    <Progress value={((aluno.mensalidades_pagas ?? 0) / total) * 100} className="w-16 h-1.5" />
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-col gap-1">
                                    <Badge className={inad ? 'bg-red-100 text-red-800' : statusColors[aluno.status] || 'bg-gray-100 text-gray-800'}>
                                      {inad ? 'inadimplente' : aluno.status}
                                    </Badge>
                                    {inad && (
                                      <span className="text-[10px] text-red-600 font-medium leading-tight">
                                        {inad.parcelasAtrasadas}x · {inad.diasAtraso}d · {formatCurrency(inad.valorEmAtraso)}
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
                            <Button size="sm" variant="ghost" onClick={() => setEditingTurmaCardId(null)} className="h-7 text-xs">✕</Button>
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
                          <div><label className="text-muted-foreground">Início</label><Input type="date" value={inlineTurmaForm.data_inicio || ''} onChange={e => setInlineTurmaForm(f => ({ ...f, data_inicio: e.target.value }))} className="h-7 mt-0.5 text-xs" /></div>
                          <div><label className="text-muted-foreground">Fim</label><Input type="date" value={inlineTurmaForm.data_fim || ''} onChange={e => setInlineTurmaForm(f => ({ ...f, data_fim: e.target.value }))} className="h-7 mt-0.5 text-xs" /></div>
                          <div><label className="text-muted-foreground">Mensalidade (R$)</label><Input type="number" step="0.01" value={inlineTurmaForm.valor_mensalidade ?? ''} onChange={e => setInlineTurmaForm(f => ({ ...f, valor_mensalidade: parseFloat(e.target.value) || undefined }))} className="h-7 mt-0.5 text-xs" /></div>
                          <div><label className="text-muted-foreground">Total Parcelas</label><Input type="number" value={inlineTurmaForm.total_mensalidades ?? ''} onChange={e => setInlineTurmaForm(f => ({ ...f, total_mensalidades: parseInt(e.target.value) || undefined }))} className="h-7 mt-0.5 text-xs" /></div>
                        </>
                      ) : (
                        <>
                          <div className="text-muted-foreground"><span className="font-medium text-foreground">Início:</span> {safeDate(turma.data_inicio) || '—'}</div>
                          <div className="text-muted-foreground"><span className="font-medium text-foreground">Fim:</span> {safeDate(turma.data_fim) || '—'}</div>
                          <div className="text-muted-foreground"><span className="font-medium text-foreground">Mensalidade:</span> {turma.valor_mensalidade ? formatCurrency(turma.valor_mensalidade) : '—'}</div>
                          <div className="text-muted-foreground"><span className="font-medium text-foreground">Parcelas:</span> {turma.total_mensalidades ?? '—'}</div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>{count} aluno{count !== 1 ? 's' : ''}</div>
                        {receitaTurma > 0 && <div className="text-green-600 font-medium">Recebido: {formatCurrency(receitaTurma)}</div>}
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setSelectedTurmaId(turma.id); setSubView('alunos'); }}>Ver alunos →</Button>
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
            <p className="text-sm text-muted-foreground">Gestão completa de turmas e pagamentos</p>
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
            <TabsTrigger value="psicanalise">Psicanálise</TabsTrigger>
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
                  <SelectItem value="psicanalise">Psicanálise</SelectItem>
                  <SelectItem value="numerologia">Numerologia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Data Início</label><Input type="date" value={newTurmaForm.data_inicio} onChange={e => setNewTurmaForm({ ...newTurmaForm, data_inicio: e.target.value })} className="mt-1" /></div>
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
              <div><label className="text-sm font-medium">Data Início</label><Input type="date" value={editTurmaForm.data_inicio || ''} onChange={e => setEditTurmaForm({ ...editTurmaForm, data_inicio: e.target.value })} className="mt-1" /></div>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Aluno</DialogTitle><DialogDescription>Adicione um novo aluno à turma</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Nome *</label><Input value={newAlunoForm.nome} onChange={e => setNewAlunoForm({ ...newAlunoForm, nome: e.target.value })} placeholder="Nome completo" className="mt-1" /></div>
            <div><label className="text-sm font-medium">WhatsApp</label><Input value={newAlunoForm.whatsapp} onChange={e => setNewAlunoForm({ ...newAlunoForm, whatsapp: e.target.value })} placeholder="(11) 99999-9999" className="mt-1" /></div>
            <div><label className="text-sm font-medium">Email</label><Input type="email" value={newAlunoForm.email} onChange={e => setNewAlunoForm({ ...newAlunoForm, email: e.target.value })} placeholder="email@example.com" className="mt-1" /></div>
            <div>
              <label className="text-sm font-medium">Turma *</label>
              <Select value={newAlunoForm.turma_id} onValueChange={v => setNewAlunoForm({ ...newAlunoForm, turma_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
                <SelectContent>{filteredTurmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Data de Matrícula</label><Input type="date" value={newAlunoForm.data_matricula} onChange={e => setNewAlunoForm({ ...newAlunoForm, data_matricula: e.target.value })} className="mt-1" /><p className="text-[10px] text-muted-foreground mt-0.5">Data do 1º pagamento / ato de matrícula</p></div>
              <div><label className="text-sm font-medium">Data de Início da Turma</label><Input type="date" value={newAlunoForm.data_inicio} onChange={e => setNewAlunoForm({ ...newAlunoForm, data_inicio: e.target.value })} className="mt-1" /></div>
            </div>
            <div>
              <label className="text-sm font-medium">Dia Vencimento</label>
              <Select value={newAlunoForm.dia_vencimento} onValueChange={v => setNewAlunoForm({ ...newAlunoForm, dia_vencimento: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{[1,5,10,15,20,25,28].map(d => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Forma de Pagamento</label>
              <Select value={newAlunoForm.forma_pagamento} onValueChange={v => setNewAlunoForm({ ...newAlunoForm, forma_pagamento: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto — 15 mensalidades</SelectItem>
                  <SelectItem value="cartao">Cartão — 12x</SelectItem>
                  <SelectItem value="pix">PIX — À vista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Origem</label>
              <Select value={newAlunoForm.origem} onValueChange={v => setNewAlunoForm({ ...newAlunoForm, origem: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direto">Direto</SelectItem>
                  <SelectItem value="lancamento">Lançamento</SelectItem>
                  <SelectItem value="npa">NPA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlunoDialog(false)}>Cancelar</Button>
            <Button onClick={createAluno} className="bg-primary text-white">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhe/Edição do Aluno */}
      <Dialog open={showAlunoDetail} onOpenChange={setShowAlunoDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dados do Aluno</DialogTitle><DialogDescription>Visualize e edite as informações do aluno</DialogDescription></DialogHeader>
          {alunoDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground uppercase">Nome</label><Input value={editAlunoForm.nome || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, nome: e.target.value })} className="mt-1" /></div>
                <div><label className="text-xs font-medium text-muted-foreground uppercase">WhatsApp</label><Input value={editAlunoForm.whatsapp || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, whatsapp: e.target.value })} className="mt-1" /></div>
                <div><label className="text-xs font-medium text-muted-foreground uppercase">Email</label><Input type="email" value={editAlunoForm.email || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, email: e.target.value })} className="mt-1" /></div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Turma</label>
                  <Select value={editAlunoForm.turma_id || ''} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, turma_id: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{filteredTurmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground uppercase">Data de Início</label><Input type="date" value={editAlunoForm.data_inicio || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, data_inicio: e.target.value })} className="mt-1" /></div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Dia Vencimento</label>
                  <Select value={String(editAlunoForm.dia_vencimento || 10)} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, dia_vencimento: parseInt(v) })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,5,10,15,20,25,28].map(d => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Status</label>
                  <Select value={editAlunoForm.status || 'ativo'} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, status: v as Aluno['status'] })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inadimplente">Inadimplente</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Origem</label>
                  <Select value={editAlunoForm.origem_lead || 'direto'} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, origem_lead: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direto">Direto</SelectItem>
                      <SelectItem value="lancamento">Lançamento</SelectItem>
                      <SelectItem value="npa">NPA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground uppercase">Mensalidades Pagas</label><Input type="number" value={editAlunoForm.mensalidades_pagas ?? 0} onChange={e => setEditAlunoForm({ ...editAlunoForm, mensalidades_pagas: parseInt(e.target.value) })} className="mt-1" /></div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Valor Personalizado (R$)</label>
                  <Input type="number" step="0.01" value={editAlunoForm.valor_mensalidade ?? ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, valor_mensalidade: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder={`Padrão da turma`} className="mt-1" />
                  <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para usar o valor da turma. Ao salvar, parcelas pendentes serão atualizadas.</p>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground uppercase">CPF</label><Input value={editAlunoForm.cpf || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, cpf: e.target.value })} placeholder="000.000.000-00" className="mt-1" /></div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Forma de Pagamento</label>
                  <Select value={editAlunoForm.forma_pagamento || ''} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, forma_pagamento: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boleto">Boleto 1+15</SelectItem>
                      <SelectItem value="cartao">Cartão 12x</SelectItem>
                      <SelectItem value="pix">PIX à vista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Contrato Enviado</label>
                  <Select value={editAlunoForm.contrato_enviado ? 'sim' : 'nao'} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, contrato_enviado: v === 'sim' })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não enviado</SelectItem>
                      <SelectItem value="sim">Enviado ✉️</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Status do Contrato</label>
                  <Select value={editAlunoForm.contrato_assinado ? 'sim' : 'nao'} onValueChange={v => setEditAlunoForm({ ...editAlunoForm, contrato_assinado: v === 'sim' })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não assinado</SelectItem>
                      <SelectItem value="sim">Assinado ✅</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground uppercase">Total Parcelas</label><Input type="number" value={editAlunoForm.total_mensalidades ?? ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, total_mensalidades: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="Padrão da turma" className="mt-1" /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Observações</label>
                <textarea value={editAlunoForm.observacoes || ''} onChange={e => setEditAlunoForm({ ...editAlunoForm, observacoes: e.target.value })} placeholder="Observações sobre o aluno..." className="mt-1 w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
              </div>

              {/* Parcelas */}
              {(() => {
                const parcelas = filteredPagamentos.filter(p => p.aluno_id === alunoDetail.id).sort((a, b) => a.numero_parcela - b.numero_parcela);
                if (parcelas.length === 0) return null;
                return (
                  <div>
                    <h4 className="font-medium text-sm mb-2 pt-2 border-t border-border">Parcelas</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-1.5 px-2">Nº</th><th className="text-left py-1.5 px-2">Mês</th><th className="text-left py-1.5 px-2">Vencimento</th><th className="text-left py-1.5 px-2">Pago em</th><th className="text-left py-1.5 px-2">Valor</th><th className="text-left py-1.5 px-2">Status</th><th className="text-left py-1.5 px-2">Ação</th></tr></thead>
                        <tbody>
                          {parcelas.map(p => (
                            <tr key={p.id} className={`border-b border-border/40 ${p.status === 'atrasado' ? 'bg-red-50' : p.status === 'pago' ? 'bg-green-50' : ''}`}>
                              <td className="py-2 px-2">{p.numero_parcela}</td>
                              <td className="py-2 px-2">{p.mes_referencia}</td>
                              <td className="py-2 px-2">{safeDate(p.data_vencimento)}</td>
                              <td className="py-2 px-2">{p.data_pagamento ? <span className="text-green-700 font-medium">{safeDate(p.data_pagamento)}</span> : <span className="text-muted-foreground text-xs">—</span>}</td>
                              <td className="py-2 px-2 font-medium">{formatCurrency(p.valor)}</td>
                              <td className="py-2 px-2">
                                <Badge className={p.status === 'pago' ? 'bg-green-100 text-green-800' : p.status === 'atrasado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                                  {p.status === 'pago' ? '✓ Pago' : p.status === 'atrasado' ? '⚠ Atrasado' : '⏳ Pendente'}
                                </Badge>
                              </td>
                              <td className="py-2 px-2">
                                {p.status === 'pago'
                                  ? <Button variant="outline" size="sm" onClick={() => estornarPagamento(p.id, alunoDetail.id)} className="text-orange-600 border-orange-200 h-7 text-xs">Estornar</Button>
                                  : <Button variant="outline" size="sm" onClick={() => marcarComoPago(p.id, alunoDetail.id)} className="text-green-600 border-green-200 h-7 text-xs">Marcar Pago</Button>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlunoDetail(false)}>Fechar</Button>
            <Button onClick={saveAlunoDetail} disabled={savingAluno} className="bg-primary text-white"><CheckCircle2 className="h-4 w-4 mr-1" />{savingAluno ? 'Salvando...' : 'Salvar Alterações'}</Button>
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

      {/* Modal Confirmar Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Confirmar Exclusão</DialogTitle><DialogDescription>Tem certeza que deseja remover <strong>{alunoToDelete?.nome}</strong>? Todos os pagamentos vinculados serão excluídos.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteAluno}>Confirmar Exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
