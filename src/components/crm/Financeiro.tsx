import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  Plus,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle2,
  Eye,
  Trash2,
  Calendar,
  TrendingUp,
  Target,
  CalendarDays,
  Phone,
  FileText,
  FileCheck,
  Send,
  Clock,
  Copy,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Turma {
  id: string;
  nome: string;
  produto: 'psicanalise' | 'numerologia';
  data_inicio: string;
  data_fim: string;
  dia_vencimento: number;
  valor_mensalidade: number;
  total_mensalidades: number;
  status: string;
  created_at: string;
}

interface Aluno {
  id: string;
  turma_id: string;
  produto: 'psicanalise' | 'numerologia';
  nome: string;
  whatsapp: string;
  email?: string;
  dia_vencimento: number;
  status: 'ativo' | 'inadimplente' | 'cancelado' | 'concluido';
  mensalidades_pagas: number;
  data_inicio: string;
  origem_lead: 'direto' | 'lancamento' | 'npa';
  valor_mensalidade?: number;
  created_at: string;
  // Campos de contrato / formulário
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  cep?: string;
  cidade_estado?: string;
  pais?: string;
  forma_pagamento?: string;
  dia_vencimento_contrato?: string;
  forms_respondido?: boolean;
  forms_respondido_em?: string;
  contrato_enviado?: boolean;
  contrato_enviado_em?: string;
  contrato_assinado?: boolean;
  contrato_assinado_em?: string;
  autentique_documento_id?: string;
  autentique_link_assinatura?: string;
  observacoes?: string;
}

interface Pagamento {
  id: string;
  aluno_id: string;
  turma_id: string;
  produto: 'psicanalise' | 'numerologia';
  valor: number;
  mes_referencia: string;
  data_vencimento: string;
  data_pagamento?: string;
  numero_parcela: number;
  status: 'pago' | 'pendente' | 'atrasado';
  created_at: string;
}

type ProdutoTab = 'psicanalise' | 'numerologia';
type SubView = 'alunos' | 'turmas' | 'contratos';

type EtapaContrato = 'aguardando_forms' | 'forms_respondido' | 'contrato_enviado' | 'contrato_assinado';

function getEtapaContrato(aluno: Aluno): EtapaContrato {
  if (aluno.contrato_assinado) return 'contrato_assinado';
  if (aluno.contrato_enviado) return 'contrato_enviado';
  if (aluno.forms_respondido) return 'forms_respondido';
  return 'aguardando_forms';
}

function EtapaBadge({ etapa }: { etapa: EtapaContrato }) {
  const map: Record<EtapaContrato, { label: string; cls: string }> = {
    aguardando_forms:  { label: 'Aguardando Forms',  cls: 'bg-gray-100 text-gray-700' },
    forms_respondido:  { label: 'Forms Respondido',  cls: 'bg-blue-100 text-blue-700' },
    contrato_enviado:  { label: 'Contrato Enviado',  cls: 'bg-amber-100 text-amber-700' },
    contrato_assinado: { label: 'Contrato Assinado', cls: 'bg-green-100 text-green-700' },
  };
  const { label, cls } = map[etapa];
  return <Badge className={cls}>{label}</Badge>;
}

export function Financeiro() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProdutoTab>('psicanalise');
  const [subView, setSubView] = useState<SubView>('alunos');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('todas');
  const [loading, setLoading] = useState(true);

  // Modais
  const [showTurmaDialog, setShowTurmaDialog] = useState(false);
  const [showAlunoDialog, setShowAlunoDialog] = useState(false);
  const [showParcelasDialog, setShowParcelasDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [alunoToDelete, setAlunoToDelete] = useState<Aluno | null>(null);
  const [alunoParcelas, setAlunoParcelas] = useState<Aluno | null>(null);

  // Formulários
  const [newTurmaForm, setNewTurmaForm] = useState({
    nome: '',
    produto: 'psicanalise' as ProdutoTab,
    data_inicio: '',
    data_fim: '',
    dia_vencimento: '10',
    valor_mensalidade: '109.90',
    total_mensalidades: '14'
  });

  const [newAlunoForm, setNewAlunoForm] = useState({
    nome: '',
    whatsapp: '',
    email: '',
    turma_id: '',
    data_inicio: '',
    dia_vencimento: '10',
    origem: 'direto' as 'direto' | 'lancamento' | 'npa',
    forma_pagamento: 'mensalidade' as 'mensalidade' | 'parcelado' | 'avista',
  });

  // Observações do aluno (edição inline no modal)
  const [obsValue, setObsValue] = useState('');
  const [savingObs, setSavingObs] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Reset sub-view when changing product tab
  useEffect(() => {
    setSubView('alunos');
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [turmasRes, alunosRes, pagamentosRes] = await Promise.all([
        supabase.from('turmas')
          .select('id, nome, produto, data_inicio, data_fim, dia_vencimento, valor_mensalidade, total_mensalidades, status, created_at')
          .order('created_at', { ascending: false }).limit(200),
        supabase.from('alunos')
          .select('id, turma_id, produto, nome, whatsapp, email, cpf, data_nascimento, endereco, cep, cidade_estado, pais, dia_vencimento, dia_vencimento_contrato, forma_pagamento, status, mensalidades_pagas, data_inicio, origem_lead, valor_mensalidade, forms_respondido, forms_respondido_em, contrato_enviado, contrato_enviado_em, contrato_assinado, contrato_assinado_em, autentique_documento_id, autentique_link_assinatura, observacoes, created_at')
          .order('created_at', { ascending: false }).limit(500),
        supabase.from('pagamentos')
          .select('id, aluno_id, turma_id, produto, valor, mes_referencia, data_vencimento, data_pagamento, numero_parcela, status, created_at')
          .order('created_at', { ascending: false }).limit(2000)
      ]);

      if (turmasRes.data) setTurmas(turmasRes.data);
      if (alunosRes.data) setAlunos(alunosRes.data);
      if (pagamentosRes.data) setPagamentos(pagamentosRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao carregar dados financeiros'
      });
    } finally {
      setLoading(false);
    }
  };

  // Dados filtrados por produto
  const filteredTurmas = useMemo(() => {
    return turmas.filter(t => t.produto === activeTab);
  }, [turmas, activeTab]);

  const filteredAlunos = useMemo(() => {
    let result = alunos.filter(a => a.produto === activeTab);
    if (selectedTurmaId !== 'todas') {
      result = result.filter(a => a.turma_id === selectedTurmaId);
    }
    return result;
  }, [alunos, activeTab, selectedTurmaId]);

  const filteredPagamentos = useMemo(() => {
    return pagamentos.filter(p => p.produto === activeTab);
  }, [pagamentos, activeTab]);

  // Pipeline de contratos
  const aguardandoForms = useMemo(() =>
    filteredAlunos.filter(a => !a.forms_respondido), [filteredAlunos]);
  const formsRespondido = useMemo(() =>
    filteredAlunos.filter(a => a.forms_respondido && !a.contrato_enviado), [filteredAlunos]);
  const contratoEnviado = useMemo(() =>
    filteredAlunos.filter(a => a.contrato_enviado && !a.contrato_assinado), [filteredAlunos]);
  const contratoAssinado = useMemo(() =>
    filteredAlunos.filter(a => !!a.contrato_assinado), [filteredAlunos]);

  // Cálculos para resumo financeiro
  const currentMonth = new Date();

  const receitaMesAtual = useMemo(() => {
    return filteredPagamentos
      .filter(p => p.status === 'pago' && p.data_pagamento &&
        isSameMonth(parseISO(p.data_pagamento), currentMonth))
      .reduce((sum, p) => sum + p.valor, 0);
  }, [filteredPagamentos]);

  const previstoMesAtual = useMemo(() => {
    return filteredPagamentos
      .filter(p => isSameMonth(parseISO(p.data_vencimento), currentMonth))
      .reduce((sum, p) => sum + p.valor, 0);
  }, [filteredPagamentos]);

  const alunosInadimplentes = useMemo(() => {
    return filteredAlunos.filter(a => a.status === 'inadimplente');
  }, [filteredAlunos]);

  const valorEmAberto = useMemo(() => {
    return alunosInadimplentes.reduce((sum, aluno) => {
      const pagamentosPendentes = filteredPagamentos.filter(p =>
        p.aluno_id === aluno.id && p.status !== 'pago'
      );
      return sum + pagamentosPendentes.reduce((pSum, p) => pSum + p.valor, 0);
    }, 0);
  }, [alunosInadimplentes, filteredPagamentos]);

  const totalAlunosAtivos = useMemo(() =>
    filteredAlunos.filter(a => a.status === 'ativo').length, [filteredAlunos]);

  // Valor esperado por aluno baseado na forma de pagamento
  const valorAluno = (fp?: string) => {
    if (fp === 'avista') return 997;
    if (fp === 'parcelado') return 109.49 * 12;
    return 110 * 14; // mensalidade padrão
  };

  // Parcelas a criar baseado na forma de pagamento
  const buildParcelas = (
    alunoId: string, turmaId: string, dataInicio: string, diavenc: number, fp: string
  ) => {
    const base = new Date(dataInicio || new Date().toISOString());
    if (fp === 'avista') {
      const venc = new Date(base);
      venc.setDate(diavenc);
      return [{ aluno_id: alunoId, turma_id: turmaId, produto: activeTab, valor: 997, mes_referencia: format(venc, 'yyyy-MM'), data_vencimento: venc.toISOString().split('T')[0], numero_parcela: 1, status: 'pendente' }];
    }
    const qtd = fp === 'parcelado' ? 12 : 14;
    const valor = fp === 'parcelado' ? 109.49 : 110;
    return Array.from({ length: qtd }, (_, i) => {
      const venc = new Date(base);
      venc.setMonth(venc.getMonth() + i);
      venc.setDate(diavenc);
      return { aluno_id: alunoId, turma_id: turmaId, produto: activeTab, valor, mes_referencia: format(venc, 'yyyy-MM'), data_vencimento: venc.toISOString().split('T')[0], numero_parcela: i + 1, status: 'pendente' };
    });
  };

  // Formatação
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateString: string) =>
    format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR });

  const safeDate = (d?: string | null) => {
    if (!d) return '—';
    try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); }
    catch { return '—'; }
  };

  // Funções de ação
  const createTurma = async () => {
    if (!newTurmaForm.nome.trim()) return;
    try {
      const { error } = await supabase.from('turmas').insert({
        nome: newTurmaForm.nome,
        produto: newTurmaForm.produto,
        data_inicio: newTurmaForm.data_inicio,
        data_fim: newTurmaForm.data_fim,
        dia_vencimento: parseInt(newTurmaForm.dia_vencimento),
        valor_mensalidade: parseFloat(newTurmaForm.valor_mensalidade),
        total_mensalidades: parseInt(newTurmaForm.total_mensalidades),
        status: 'ativo'
      });
      if (error) throw error;
      toast({ title: 'Turma criada!', description: 'Turma criada com sucesso.' });
      setShowTurmaDialog(false);
      setNewTurmaForm({ nome: '', produto: 'psicanalise', data_inicio: '', data_fim: '', dia_vencimento: '10', valor_mensalidade: '109.90', total_mensalidades: '14' });
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao criar turma' });
    }
  };

  const createAluno = async () => {
    if (!newAlunoForm.nome.trim() || !newAlunoForm.turma_id) return;
    try {
      const fp = newAlunoForm.forma_pagamento;
      const diaVenc = parseInt(newAlunoForm.dia_vencimento);
      const { data: alunoData, error: alunoError } = await supabase.from('alunos').insert({
        turma_id: newAlunoForm.turma_id,
        produto: activeTab,
        nome: newAlunoForm.nome,
        whatsapp: newAlunoForm.whatsapp,
        email: newAlunoForm.email || null,
        dia_vencimento: diaVenc,
        status: 'ativo',
        mensalidades_pagas: 0,
        data_inicio: newAlunoForm.data_inicio || new Date().toISOString().split('T')[0],
        origem_lead: newAlunoForm.origem,
        forma_pagamento: fp,
        valor_mensalidade: fp === 'avista' ? 997 : fp === 'parcelado' ? 109.49 : 110,
      }).select().single();
      if (alunoError) throw alunoError;

      // Criar parcelas conforme forma de pagamento
      const parcelas = buildParcelas(
        alunoData.id, newAlunoForm.turma_id,
        newAlunoForm.data_inicio || new Date().toISOString().split('T')[0],
        diaVenc, fp
      );
      if (parcelas.length > 0) {
        await supabase.from('pagamentos').insert(parcelas);
      }

      toast({ title: 'Aluno adicionado!', description: 'Aluno e parcelas criados com sucesso.' });
      setShowAlunoDialog(false);
      setNewAlunoForm({ nome: '', whatsapp: '', email: '', turma_id: '', data_inicio: '', dia_vencimento: '10', origem: 'direto', forma_pagamento: 'mensalidade' });
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao adicionar aluno' });
    }
  };

  const saveObservacoes = async () => {
    if (!alunoParcelas) return;
    setSavingObs(true);
    const { error } = await supabase.from('alunos')
      .update({ observacoes: obsValue })
      .eq('id', alunoParcelas.id);
    setSavingObs(false);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar observação' }); return; }
    setAlunos(prev => prev.map(a => a.id === alunoParcelas.id ? { ...a, observacoes: obsValue } : a));
    toast({ title: 'Salvo!', description: 'Observação salva com sucesso.' });
  };

  const deleteAluno = async () => {
    if (!alunoToDelete) return;
    try {
      await supabase.from('pagamentos').delete().eq('aluno_id', alunoToDelete.id);
      const { error } = await supabase.from('alunos').delete().eq('id', alunoToDelete.id);
      if (error) throw error;
      toast({ title: 'Aluno removido!', description: 'Aluno e pagamentos removidos com sucesso.' });
      setShowDeleteDialog(false);
      setAlunoToDelete(null);
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao remover aluno' });
    }
  };

  const marcarComoPago = async (pagamentoId: string, alunoId: string) => {
    try {
      const { error: pagamentoError } = await supabase.from('pagamentos')
        .update({ status: 'pago', data_pagamento: new Date().toISOString() })
        .eq('id', pagamentoId);
      if (pagamentoError) throw pagamentoError;
      const { data: alunoData, error: alunoError } = await supabase.from('alunos')
        .select('mensalidades_pagas').eq('id', alunoId).single();
      if (alunoError) throw alunoError;
      await supabase.from('alunos')
        .update({ mensalidades_pagas: (alunoData.mensalidades_pagas || 0) + 1 })
        .eq('id', alunoId);
      toast({ title: 'Pagamento confirmado!', description: 'Parcela marcada como paga.' });
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao marcar como pago' });
    }
  };

  const estornarPagamento = async (pagamentoId: string, alunoId: string) => {
    try {
      await supabase.from('pagamentos')
        .update({ status: 'pendente', data_pagamento: null })
        .eq('id', pagamentoId);
      const { data: alunoData } = await supabase.from('alunos')
        .select('mensalidades_pagas').eq('id', alunoId).single();
      await supabase.from('alunos')
        .update({ mensalidades_pagas: Math.max(0, (alunoData?.mensalidades_pagas || 0) - 1) })
        .eq('id', alunoId);
      toast({ title: 'Pagamento estornado!', description: 'Parcela estornada com sucesso.' });
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao estornar pagamento' });
    }
  };

  const openParcelasModal = (aluno: Aluno) => {
    setAlunoParcelas(aluno);
    setObsValue(aluno.observacoes || '');
    setShowParcelasDialog(true);
  };

  const confirmDelete = (aluno: Aluno) => {
    setAlunoToDelete(aluno);
    setShowDeleteDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: 'Copiado!', description: 'Link copiado para a área de transferência.' })
    );
  };

  const getStatusBadge = (status: Aluno['status']) => {
    const variants: Record<Aluno['status'], string> = {
      ativo: 'bg-green-100 text-green-800',
      inadimplente: 'bg-red-100 text-red-800',
      cancelado: 'bg-gray-100 text-gray-800',
      concluido: 'bg-blue-100 text-blue-800',
    };
    return (
      <Badge className={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Sub-tab buttons shared across products
  const SubTabs = () => (
    <div className="flex gap-1 border-b border-border pb-0 mb-4">
      {(['alunos', 'turmas', 'contratos'] as SubView[]).map(v => {
        const labels: Record<SubView, { label: string; icon: React.ReactNode }> = {
          alunos:    { label: 'Alunos',    icon: <Users className="h-3.5 w-3.5 inline mr-1" /> },
          turmas:    { label: 'Turmas',    icon: <CalendarDays className="h-3.5 w-3.5 inline mr-1" /> },
          contratos: { label: 'Contratos', icon: <FileText className="h-3.5 w-3.5 inline mr-1" /> },
        };
        return (
          <button
            key={v}
            onClick={() => setSubView(v)}
            className={`px-4 py-1.5 rounded-t text-sm font-medium transition-colors ${
              subView === v ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {labels[v].icon}{labels[v].label}
          </button>
        );
      })}
    </div>
  );

  // ── Contratos Kanban ────────────────────────────────────────────────────────
  const ContratosView = () => {
    const cols = [
      {
        id: 'aguardando_forms' as EtapaContrato,
        label: 'Aguardando Forms',
        icon: <Clock className="h-4 w-4" />,
        leads: aguardandoForms,
        color: 'border-gray-300',
        headerColor: 'bg-gray-50',
        badgeColor: 'bg-gray-100 text-gray-700',
      },
      {
        id: 'forms_respondido' as EtapaContrato,
        label: 'Forms Respondido',
        icon: <FileCheck className="h-4 w-4" />,
        leads: formsRespondido,
        color: 'border-blue-300',
        headerColor: 'bg-blue-50',
        badgeColor: 'bg-blue-100 text-blue-700',
      },
      {
        id: 'contrato_enviado' as EtapaContrato,
        label: 'Contrato Enviado',
        icon: <Send className="h-4 w-4" />,
        leads: contratoEnviado,
        color: 'border-amber-300',
        headerColor: 'bg-amber-50',
        badgeColor: 'bg-amber-100 text-amber-700',
      },
      {
        id: 'contrato_assinado' as EtapaContrato,
        label: 'Contrato Assinado',
        icon: <CheckCircle2 className="h-4 w-4" />,
        leads: contratoAssinado,
        color: 'border-green-300',
        headerColor: 'bg-green-50',
        badgeColor: 'bg-green-100 text-green-700',
      },
    ];

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cols.map(col => (
            <Card key={col.id} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-muted-foreground">{col.icon}</span>
                <p className="text-xs text-muted-foreground truncate">{col.label}</p>
              </div>
              <p className="text-2xl font-bold">{col.leads.length}</p>
            </Card>
          ))}
        </div>

        {/* Kanban board */}
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4 items-start">
            {cols.map(col => (
              <div key={col.id} className={`w-72 border-t-2 ${col.color} rounded-lg overflow-hidden`}>
                {/* Column header */}
                <div className={`${col.headerColor} px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    {col.icon}
                    {col.label}
                  </div>
                  <Badge className={`${col.badgeColor} text-xs`}>{col.leads.length}</Badge>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 max-h-[520px] overflow-y-auto bg-muted/30">
                  {col.leads.length === 0 && (
                    <p className="text-xs text-center text-muted-foreground py-6">Nenhum aluno</p>
                  )}
                  {col.leads.map(aluno => {
                    const stepDate =
                      col.id === 'aguardando_forms'  ? aluno.created_at :
                      col.id === 'forms_respondido'  ? aluno.forms_respondido_em :
                      col.id === 'contrato_enviado'  ? aluno.contrato_enviado_em :
                      aluno.contrato_assinado_em;

                    return (
                      <Card key={aluno.id} className="p-3 bg-white shadow-sm">
                        <p className="font-semibold text-sm leading-tight">{aluno.nome}</p>
                        {aluno.cpf && (
                          <p className="text-xs text-muted-foreground mt-0.5">CPF: {aluno.cpf}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">{aluno.whatsapp}</p>
                        </div>
                        {stepDate && (
                          <p className="text-xs text-muted-foreground mt-1">{safeDate(stepDate)}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          {aluno.forma_pagamento && (
                            <Badge className="text-xs bg-indigo-100 text-indigo-700 py-0">
                              {aluno.forma_pagamento === 'avista' ? 'À vista' : 'Parcelado'}
                            </Badge>
                          )}
                          {col.id === 'contrato_enviado' && aluno.autentique_link_assinatura && (
                            <button
                              onClick={() => copyToClipboard(aluno.autentique_link_assinatura!)}
                              className="flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
                            >
                              <Copy className="h-3 w-3" />
                              Copiar link
                            </button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Turmas View ─────────────────────────────────────────────────────────────
  const TurmasView = () => (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left py-3 px-4 font-medium">Nome</th>
              <th className="text-left py-3 px-4 font-medium">Início</th>
              <th className="text-left py-3 px-4 font-medium">Fim</th>
              <th className="text-left py-3 px-4 font-medium">Alunos</th>
              <th className="text-left py-3 px-4 font-medium">Mensalidade</th>
              <th className="text-left py-3 px-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTurmas.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhuma turma encontrada
                </td>
              </tr>
            )}
            {filteredTurmas.map(turma => (
              <tr key={turma.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-3 px-4 font-medium">{turma.nome}</td>
                <td className="py-3 px-4">{turma.data_inicio ? safeDate(turma.data_inicio) : '—'}</td>
                <td className="py-3 px-4">{turma.data_fim ? safeDate(turma.data_fim) : '—'}</td>
                <td className="py-3 px-4">
                  {alunos.filter(a => a.turma_id === turma.id).length}
                </td>
                <td className="py-3 px-4">{formatCurrency(turma.valor_mensalidade || 0)}</td>
                <td className="py-3 px-4">
                  <Badge className={turma.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {turma.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  // ── Tabela de Alunos reutilizável ───────────────────────────────────────────
  const fpLabel = (fp?: string) => {
    if (fp === 'avista') return { label: 'À vista', cls: 'bg-green-100 text-green-700' };
    if (fp === 'parcelado') return { label: '12x cartão', cls: 'bg-blue-100 text-blue-700' };
    return { label: 'Mensalidade', cls: 'bg-gray-100 text-gray-700' };
  };

  const totalParcelas = (fp?: string) => fp === 'avista' ? 1 : fp === 'parcelado' ? 12 : 14;

  const AlunoTable = ({ list }: { list: Aluno[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-4 font-medium">Nome</th>
            <th className="text-left py-2 px-4 font-medium">WhatsApp</th>
            <th className="text-left py-2 px-4 font-medium">Turma</th>
            <th className="text-left py-2 px-4 font-medium">Pagamento</th>
            <th className="text-left py-2 px-4 font-medium">Parcelas</th>
            <th className="text-left py-2 px-4 font-medium">Status</th>
            <th className="text-left py-2 px-4 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {list.map(aluno => {
            const fp = fpLabel(aluno.forma_pagamento);
            const total = totalParcelas(aluno.forma_pagamento);
            const turmaNome = turmas.find(t => t.id === aluno.turma_id)?.nome || '—';
            return (
              <tr key={aluno.id} className="border-b border-border/50 hover:bg-muted/50">
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium">{aluno.nome}</p>
                    {aluno.observacoes && (
                      <p className="text-xs text-amber-600 truncate max-w-[180px]" title={aluno.observacoes}>
                        📝 {aluno.observacoes}
                      </p>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {aluno.whatsapp}
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">{turmaNome}</td>
                <td className="py-3 px-4">
                  <Badge className={`${fp.cls} text-xs`}>{fp.label}</Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{aluno.mensalidades_pagas}/{total}</span>
                    <Progress value={(aluno.mensalidades_pagas / total) * 100} className="w-16 h-2" />
                  </div>
                </td>
                <td className="py-3 px-4">{getStatusBadge(aluno.status)}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openParcelasModal(aluno)} title="Ver detalhes">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => confirmDelete(aluno)} className="text-destructive hover:text-destructive" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ── Alunos View (existing content) ─────────────────────────────────────────
  const AlunosView = () => (
    <div className="space-y-6">
      {/* Vence dia 10 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">📅 Vence dia 10</h3>
          <Badge variant="secondary">{filteredAlunos.filter(a => a.dia_vencimento === 10).length} alunos</Badge>
        </div>
        {filteredAlunos.filter(a => a.dia_vencimento === 10).length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum aluno com vencimento no dia 10</p>
          </div>
        ) : (
          <AlunoTable list={filteredAlunos.filter(a => a.dia_vencimento === 10)} />
        )}
      </Card>

      {/* Vence dia 20 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">📅 Vence dia 20</h3>
          <Badge variant="secondary">{filteredAlunos.filter(a => a.dia_vencimento === 20).length} alunos</Badge>
        </div>
        {filteredAlunos.filter(a => a.dia_vencimento === 20).length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum aluno com vencimento no dia 20</p>
          </div>
        ) : (
          <AlunoTable list={filteredAlunos.filter(a => a.dia_vencimento === 20)} />
        )}
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados financeiros...</p>
        </div>
      </div>
    );
  }

  // ── Shared product content ──────────────────────────────────────────────────
  const ProductContent = () => (
    <div className="flex-1 p-4 lg:p-6 space-y-4">
      {/* Summary cards (always visible) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Receita do Mês</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(receitaMesAtual)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Target className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Previsto do Mês</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(previstoMesAtual)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Inadimplentes</p>
              <p className="text-2xl font-bold text-red-600">{alunosInadimplentes.length}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(valorEmAberto)} em aberto</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><Users className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Alunos Ativos</p>
              <p className="text-2xl font-bold text-purple-600">{totalAlunosAtivos}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Turma filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Turma:</label>
          <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Selecione uma turma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as turmas</SelectItem>
              {filteredTurmas.map(turma => (
                <SelectItem key={turma.id} value={turma.id}>
                  {turma.nome} ({filteredAlunos.filter(a => a.turma_id === turma.id).length} alunos)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Sub-tabs */}
      <SubTabs />

      {/* Sub-view content */}
      {subView === 'alunos'    && <AlunosView />}
      {subView === 'turmas'    && <TurmasView />}
      {subView === 'contratos' && <ContratosView />}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gestão completa de turmas e pagamentos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTurmaDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />Nova Turma
            </Button>
            <Button onClick={() => setShowAlunoDialog(true)} className="bg-primary hover:bg-primary/90 text-white">
              <Plus className="h-4 w-4 mr-2" />Adicionar Aluno
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProdutoTab)} className="h-full">
          <div className="px-4 lg:px-6 pt-4 border-b border-border">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="psicanalise">Psicanálise</TabsTrigger>
              <TabsTrigger value="numerologia">Numerologia</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="psicanalise" className="flex-1">
            <ProductContent />
          </TabsContent>

          <TabsContent value="numerologia" className="flex-1">
            <ProductContent />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Nova Turma */}
      <Dialog open={showTurmaDialog} onOpenChange={setShowTurmaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Turma</DialogTitle>
            <DialogDescription>Crie uma nova turma para organizar seus alunos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome da Turma *</label>
              <Input value={newTurmaForm.nome} onChange={(e) => setNewTurmaForm({ ...newTurmaForm, nome: e.target.value })} placeholder="Ex: Turma Janeiro 2025" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Produto</label>
              <Select value={newTurmaForm.produto} onValueChange={(value) => setNewTurmaForm({ ...newTurmaForm, produto: value as ProdutoTab })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="psicanalise">Psicanálise</SelectItem>
                  <SelectItem value="numerologia">Numerologia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Data Início</label>
                <Input type="date" value={newTurmaForm.data_inicio} onChange={(e) => setNewTurmaForm({ ...newTurmaForm, data_inicio: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Data Fim</label>
                <Input type="date" value={newTurmaForm.data_fim} onChange={(e) => setNewTurmaForm({ ...newTurmaForm, data_fim: e.target.value })} className="mt-1" />
              </div>
            </div>
            {newTurmaForm.produto === 'psicanalise' && (
              <>
                <div>
                  <label className="text-sm font-medium">Dia de Vencimento</label>
                  <Select value={newTurmaForm.dia_vencimento} onValueChange={(value) => setNewTurmaForm({ ...newTurmaForm, dia_vencimento: value })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">Dia 10</SelectItem>
                      <SelectItem value="20">Dia 20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Valor Mensalidade</label>
                    <Input type="number" step="0.01" value={newTurmaForm.valor_mensalidade} onChange={(e) => setNewTurmaForm({ ...newTurmaForm, valor_mensalidade: e.target.value })} placeholder="109.90" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Total Mensalidades</label>
                    <Input type="number" value={newTurmaForm.total_mensalidades} onChange={(e) => setNewTurmaForm({ ...newTurmaForm, total_mensalidades: e.target.value })} placeholder="14" className="mt-1" />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTurmaDialog(false)}>Cancelar</Button>
            <Button onClick={createTurma} className="bg-primary hover:bg-primary/90">Criar Turma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Aluno */}
      <Dialog open={showAlunoDialog} onOpenChange={setShowAlunoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Aluno</DialogTitle>
            <DialogDescription>Adicione um novo aluno à turma selecionada</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input value={newAlunoForm.nome} onChange={(e) => setNewAlunoForm({ ...newAlunoForm, nome: e.target.value })} placeholder="Nome completo" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">WhatsApp *</label>
              <Input value={newAlunoForm.whatsapp} onChange={(e) => setNewAlunoForm({ ...newAlunoForm, whatsapp: e.target.value })} placeholder="(11) 99999-9999" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={newAlunoForm.email} onChange={(e) => setNewAlunoForm({ ...newAlunoForm, email: e.target.value })} placeholder="email@example.com" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Turma *</label>
              <Select value={newAlunoForm.turma_id} onValueChange={(value) => setNewAlunoForm({ ...newAlunoForm, turma_id: value })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
                <SelectContent>
                  {filteredTurmas.map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Data de Início</label>
                <Input type="date" value={newAlunoForm.data_inicio} onChange={(e) => setNewAlunoForm({ ...newAlunoForm, data_inicio: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Dia Vencimento</label>
                <Select value={newAlunoForm.dia_vencimento} onValueChange={(value) => setNewAlunoForm({ ...newAlunoForm, dia_vencimento: value })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Dia 10</SelectItem>
                    <SelectItem value="20">Dia 20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Origem</label>
              <Select value={newAlunoForm.origem} onValueChange={(value) => setNewAlunoForm({ ...newAlunoForm, origem: value as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direto">Direto</SelectItem>
                  <SelectItem value="lancamento">Lançamento</SelectItem>
                  <SelectItem value="npa">NPA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Forma de Pagamento</label>
              <Select value={newAlunoForm.forma_pagamento} onValueChange={(value) => setNewAlunoForm({ ...newAlunoForm, forma_pagamento: value as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensalidade">Mensalidade — 14x R$ 110,00</SelectItem>
                  <SelectItem value="parcelado">Cartão — 12x R$ 109,49</SelectItem>
                  <SelectItem value="avista">À vista — R$ 997,00</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlunoDialog(false)}>Cancelar</Button>
            <Button onClick={createAluno} className="bg-primary hover:bg-primary/90">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Parcelas + Detalhes do Aluno */}
      <Dialog open={showParcelasDialog} onOpenChange={setShowParcelasDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes — {alunoParcelas?.nome}</DialogTitle>
            <DialogDescription>Parcelas e informações de contrato</DialogDescription>
          </DialogHeader>

          {alunoParcelas && (
            <div className="space-y-6">
              {/* Parcelas */}
              <div>
                <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Parcelas</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4 font-medium">Nº</th>
                        <th className="text-left py-2 px-4 font-medium">Mês Referência</th>
                        <th className="text-left py-2 px-4 font-medium">Vencimento</th>
                        <th className="text-left py-2 px-4 font-medium">Valor</th>
                        <th className="text-left py-2 px-4 font-medium">Status</th>
                        <th className="text-left py-2 px-4 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPagamentos
                        .filter(p => p.aluno_id === alunoParcelas.id)
                        .sort((a, b) => a.numero_parcela - b.numero_parcela)
                        .map(pagamento => (
                          <tr key={pagamento.id} className={`border-b border-border/50 ${
                            pagamento.status === 'atrasado' ? 'bg-red-50' :
                            pagamento.status === 'pago' ? 'bg-green-50' : ''
                          }`}>
                            <td className="py-3 px-4">{pagamento.numero_parcela}</td>
                            <td className="py-3 px-4">{pagamento.mes_referencia}</td>
                            <td className="py-3 px-4">{formatDate(pagamento.data_vencimento)}</td>
                            <td className="py-3 px-4 font-medium">{formatCurrency(pagamento.valor)}</td>
                            <td className="py-3 px-4">
                              <Badge className={
                                pagamento.status === 'pago' ? 'bg-green-100 text-green-800' :
                                pagamento.status === 'atrasado' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }>
                                {pagamento.status === 'pago' ? '✓ Pago' :
                                 pagamento.status === 'atrasado' ? '⚠ Atrasado' : '⏳ Pendente'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              {pagamento.status === 'pago' ? (
                                <Button variant="outline" size="sm" onClick={() => estornarPagamento(pagamento.id, alunoParcelas.id)} className="text-orange-600 border-orange-200 hover:bg-orange-50">
                                  Estornar
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => marcarComoPago(pagamento.id, alunoParcelas.id)} className="text-green-600 border-green-200 hover:bg-green-50">
                                  Marcar Pago
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Seção de Contrato (somente leitura) */}
              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Contrato</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Status do contrato</span>
                    <EtapaBadge etapa={getEtapaContrato(alunoParcelas)} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">CPF</span>
                    <span className="font-medium">{alunoParcelas.cpf || '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Forms respondido em</span>
                    <span className="font-medium">{safeDate(alunoParcelas.forms_respondido_em)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Contrato enviado em</span>
                    <span className="font-medium">{safeDate(alunoParcelas.contrato_enviado_em)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Contrato assinado em</span>
                    <span className="font-medium">{safeDate(alunoParcelas.contrato_assinado_em)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Endereço</span>
                    <span className="font-medium">{alunoParcelas.endereco || '—'}</span>
                  </div>
                  <div className="sm:col-span-2 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Link de assinatura</span>
                    {alunoParcelas.autentique_link_assinatura ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={alunoParcelas.autentique_link_assinatura}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-xs underline truncate max-w-xs"
                        >
                          {alunoParcelas.autentique_link_assinatura}
                        </a>
                        <button
                          onClick={() => copyToClipboard(alunoParcelas.autentique_link_assinatura!)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-medium">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Observações</h3>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={3}
              placeholder="Ex: ficou de pagar dia 15, combinar desconto, aguardando retorno..."
              value={obsValue}
              onChange={e => setObsValue(e.target.value)}
            />
            <Button size="sm" className="mt-2" onClick={saveObservacoes} disabled={savingObs}>
              {savingObs ? 'Salvando...' : 'Salvar Observação'}
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowParcelasDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <strong>{alunoToDelete?.nome}</strong>?<br />
              Todos os pagamentos vinculados serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteAluno} className="bg-red-600 hover:bg-red-700">
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
