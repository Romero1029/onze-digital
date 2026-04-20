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
  Phone
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
  created_at: string;
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

export function Financeiro() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProdutoTab>('psicanalise');
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
    origem: 'direto' as 'direto' | 'lancamento' | 'npa'
  });

  // Carregar dados
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [turmasRes, alunosRes, pagamentosRes] = await Promise.all([
        supabase.from('turmas')
          .select('id, nome, produto, data_inicio, data_fim, dia_vencimento, valor_mensalidade, total_mensalidades, status, created_at')
          .order('created_at', { ascending: false }).limit(200),
        supabase.from('alunos')
          .select('id, turma_id, produto, nome, whatsapp, email, dia_vencimento, status, mensalidades_pagas, data_inicio, origem_lead, created_at')
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

  // Cálculos para resumo
  const currentMonth = new Date();
  const startOfCurrentMonth = startOfMonth(currentMonth);
  const endOfCurrentMonth = endOfMonth(currentMonth);

  const receitaMesAtual = useMemo(() => {
    return filteredPagamentos
      .filter(p => p.status === 'pago' && p.data_pagamento &&
        isSameMonth(parseISO(p.data_pagamento), currentMonth))
      .reduce((sum, p) => sum + p.valor, 0);
  }, [filteredPagamentos, currentMonth]);

  const previstoMesAtual = useMemo(() => {
    return filteredPagamentos
      .filter(p => isSameMonth(parseISO(p.data_vencimento), currentMonth))
      .reduce((sum, p) => sum + p.valor, 0);
  }, [filteredPagamentos, currentMonth]);

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

  const projecao14Meses = useMemo(() => {
    const alunosAtivos = filteredAlunos.filter(a => a.status === 'ativo').length;
    const mesesRestantes = 14; // Média de meses restantes
    return alunosAtivos * 109.90 * mesesRestantes;
  }, [filteredAlunos]);

  // Funções de formatação
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR });
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
        valor_mensalidade: parseFloat(newTurmaForm.valor_mensalidade),
        total_mensalidades: parseInt(newTurmaForm.total_mensalidades),
      });

      if (error) throw error;

      toast({ title: 'Turma criada!', description: 'Turma criada com sucesso.' });
      setShowTurmaDialog(false);
      setNewTurmaForm({
        nome: '',
        produto: 'psicanalise',
        data_inicio: '',
        data_fim: '',
        dia_vencimento: '10',
        valor_mensalidade: '109.90',
        total_mensalidades: '14'
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao criar turma'
      });
    }
  };

  const createAluno = async () => {
    if (!newAlunoForm.nome.trim() || !newAlunoForm.turma_id) return;

    try {
      const { data: alunoData, error: alunoError } = await supabase
        .from('alunos')
        .insert({
          turma_id: newAlunoForm.turma_id,
          produto: activeTab,
          nome: newAlunoForm.nome,
          whatsapp: newAlunoForm.whatsapp,
          email: newAlunoForm.email || null,
          dia_vencimento: parseInt(newAlunoForm.dia_vencimento),
          status: 'ativo',
          mensalidades_pagas: 0,
          data_inicio: newAlunoForm.data_inicio,
          origem_lead: newAlunoForm.origem
        })
        .select()
        .single();

      if (alunoError) throw alunoError;

      // Criar parcelas automaticamente (trigger do banco deveria fazer isso)
      toast({ title: 'Aluno adicionado!', description: 'Aluno adicionado com sucesso.' });
      setShowAlunoDialog(false);
      setNewAlunoForm({
        nome: '',
        whatsapp: '',
        email: '',
        turma_id: '',
        data_inicio: '',
        dia_vencimento: '10',
        origem: 'direto'
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao adicionar aluno'
      });
    }
  };

  const deleteAluno = async () => {
    if (!alunoToDelete) return;

    try {
      // Primeiro deletar pagamentos
      await supabase.from('pagamentos').delete().eq('aluno_id', alunoToDelete.id);

      // Depois deletar aluno
      const { error } = await supabase.from('alunos').delete().eq('id', alunoToDelete.id);

      if (error) throw error;

      toast({ title: 'Aluno removido!', description: 'Aluno e pagamentos removidos com sucesso.' });
      setShowDeleteDialog(false);
      setAlunoToDelete(null);
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao remover aluno'
      });
    }
  };

  const marcarComoPago = async (pagamentoId: string, alunoId: string) => {
    try {
      const hoje = new Date().toISOString();
      const { error: pagamentoError } = await supabase
        .from('pagamentos')
        .update({
          status: 'pago',
          data_pagamento: hoje
        })
        .eq('id', pagamentoId);

      if (pagamentoError) throw pagamentoError;

      // Atualizar contador de mensalidades pagas
      const { data: alunoData, error: alunoError } = await supabase
        .from('alunos')
        .select('mensalidades_pagas')
        .eq('id', alunoId)
        .single();

      if (alunoError) throw alunoError;

      const { error: updateError } = await supabase
        .from('alunos')
        .update({ mensalidades_pagas: (alunoData.mensalidades_pagas || 0) + 1 })
        .eq('id', alunoId);

      if (updateError) throw updateError;

      toast({ title: 'Pagamento confirmado!', description: 'Parcela marcada como paga.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao marcar como pago'
      });
    }
  };

  const estornarPagamento = async (pagamentoId: string, alunoId: string) => {
    try {
      const { error: pagamentoError } = await supabase
        .from('pagamentos')
        .update({
          status: 'pendente',
          data_pagamento: null
        })
        .eq('id', pagamentoId);

      if (pagamentoError) throw pagamentoError;

      // Decrementar contador de mensalidades pagas
      const { data: alunoData, error: alunoError } = await supabase
        .from('alunos')
        .select('mensalidades_pagas')
        .eq('id', alunoId)
        .single();

      if (alunoError) throw alunoError;

      const { error: updateError } = await supabase
        .from('alunos')
        .update({ mensalidades_pagas: Math.max(0, (alunoData.mensalidades_pagas || 0) - 1) })
        .eq('id', alunoId);

      if (updateError) throw updateError;

      toast({ title: 'Pagamento estornado!', description: 'Parcela estornada com sucesso.' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao estornar pagamento'
      });
    }
  };

  const openParcelasModal = (aluno: Aluno) => {
    setAlunoParcelas(aluno);
    setShowParcelasDialog(true);
  };

  const confirmDelete = (aluno: Aluno) => {
    setAlunoToDelete(aluno);
    setShowDeleteDialog(true);
  };

  // Componente de status do aluno
  const getStatusBadge = (status: Aluno['status']) => {
    const variants = {
      ativo: { variant: 'default' as const, color: 'bg-green-100 text-green-800' },
      inadimplente: { variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
      cancelado: { variant: 'secondary' as const, color: 'bg-gray-100 text-gray-800' },
      concluido: { variant: 'default' as const, color: 'bg-blue-100 text-blue-800' }
    };

    const config = variants[status];
    return (
      <Badge variant={config.variant} className={config.color}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

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

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-border flex-shrink-0">
        <div className="flex flex-col gap-4">
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

          <TabsContent value="psicanalise" className="flex-1 p-4 lg:p-6 space-y-6">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Receita do Mês</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(receitaMesAtual)}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Previsto do Mês</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(previstoMesAtual)}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Inadimplentes</p>
                    <p className="text-2xl font-bold text-red-600">{alunosInadimplentes.length}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(valorEmAberto)} em aberto</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Projeção 14 meses</p>
                    <p className="text-2xl font-bold text-purple-600">{formatCurrency(projecao14Meses)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Seletor de Turma */}
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

            {/* Lista de Alunos */}
            <div className="space-y-6">
              {/* Vence dia 10 */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    📅 Vence dia 10
                  </h3>
                  <Badge variant="secondary">
                    {filteredAlunos.filter(a => a.dia_vencimento === 10).length} alunos
                  </Badge>
                </div>

                {filteredAlunos.filter(a => a.dia_vencimento === 10).length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum aluno com vencimento no dia 10</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-4 font-medium">Nome</th>
                          <th className="text-left py-2 px-4 font-medium">WhatsApp</th>
                          <th className="text-left py-2 px-4 font-medium">Dia Venc.</th>
                          <th className="text-left py-2 px-4 font-medium">Mensalidades</th>
                          <th className="text-left py-2 px-4 font-medium">Status</th>
                          <th className="text-left py-2 px-4 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAlunos.filter(a => a.dia_vencimento === 10).map(aluno => (
                          <tr key={aluno.id} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">{aluno.nome}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                {aluno.whatsapp}
                              </div>
                            </td>
                            <td className="py-3 px-4">{aluno.dia_vencimento}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span>{aluno.mensalidades_pagas}/14</span>
                                <Progress
                                  value={(aluno.mensalidades_pagas / 14) * 100}
                                  className="w-16 h-2"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4">{getStatusBadge(aluno.status)}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openParcelasModal(aluno)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => confirmDelete(aluno)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Vence dia 20 */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    📅 Vence dia 20
                  </h3>
                  <Badge variant="secondary">
                    {filteredAlunos.filter(a => a.dia_vencimento === 20).length} alunos
                  </Badge>
                </div>

                {filteredAlunos.filter(a => a.dia_vencimento === 20).length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum aluno com vencimento no dia 20</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-4 font-medium">Nome</th>
                          <th className="text-left py-2 px-4 font-medium">WhatsApp</th>
                          <th className="text-left py-2 px-4 font-medium">Dia Venc.</th>
                          <th className="text-left py-2 px-4 font-medium">Mensalidades</th>
                          <th className="text-left py-2 px-4 font-medium">Status</th>
                          <th className="text-left py-2 px-4 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAlunos.filter(a => a.dia_vencimento === 20).map(aluno => (
                          <tr key={aluno.id} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">{aluno.nome}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                {aluno.whatsapp}
                              </div>
                            </td>
                            <td className="py-3 px-4">{aluno.dia_vencimento}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span>{aluno.mensalidades_pagas}/14</span>
                                <Progress
                                  value={(aluno.mensalidades_pagas / 14) * 100}
                                  className="w-16 h-2"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4">{getStatusBadge(aluno.status)}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openParcelasModal(aluno)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => confirmDelete(aluno)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="numerologia" className="flex-1 p-4 lg:p-6">
            <div className="text-center py-12">
              <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">Numerologia</h3>
              <p className="text-muted-foreground">Funcionalidade em desenvolvimento</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Nova Turma */}
      <Dialog open={showTurmaDialog} onOpenChange={setShowTurmaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Turma</DialogTitle>
            <DialogDescription>
              Crie uma nova turma para organizar seus alunos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome da Turma *</label>
              <Input
                value={newTurmaForm.nome}
                onChange={(e) => setNewTurmaForm({ ...newTurmaForm, nome: e.target.value })}
                placeholder="Ex: Turma Janeiro 2025"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Produto</label>
              <Select
                value={newTurmaForm.produto}
                onValueChange={(value) => setNewTurmaForm({ ...newTurmaForm, produto: value as ProdutoTab })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="psicanalise">Psicanálise</SelectItem>
                  <SelectItem value="numerologia">Numerologia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Data Início</label>
                <Input
                  type="date"
                  value={newTurmaForm.data_inicio}
                  onChange={(e) => setNewTurmaForm({ ...newTurmaForm, data_inicio: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data Fim</label>
                <Input
                  type="date"
                  value={newTurmaForm.data_fim}
                  onChange={(e) => setNewTurmaForm({ ...newTurmaForm, data_fim: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            {newTurmaForm.produto === 'psicanalise' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Valor Mensalidade</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newTurmaForm.valor_mensalidade}
                      onChange={(e) => setNewTurmaForm({ ...newTurmaForm, valor_mensalidade: e.target.value })}
                      placeholder="109.90"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Total Mensalidades</label>
                    <Input
                      type="number"
                      value={newTurmaForm.total_mensalidades}
                      onChange={(e) => setNewTurmaForm({ ...newTurmaForm, total_mensalidades: e.target.value })}
                      placeholder="14"
                      className="mt-1"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTurmaDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={createTurma} className="bg-primary hover:bg-primary/90">
              Criar Turma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Aluno */}
      <Dialog open={showAlunoDialog} onOpenChange={setShowAlunoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Aluno</DialogTitle>
            <DialogDescription>
              Adicione um novo aluno à turma selecionada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={newAlunoForm.nome}
                onChange={(e) => setNewAlunoForm({ ...newAlunoForm, nome: e.target.value })}
                placeholder="Nome completo"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">WhatsApp *</label>
              <Input
                value={newAlunoForm.whatsapp}
                onChange={(e) => setNewAlunoForm({ ...newAlunoForm, whatsapp: e.target.value })}
                placeholder="(11) 99999-9999"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={newAlunoForm.email}
                onChange={(e) => setNewAlunoForm({ ...newAlunoForm, email: e.target.value })}
                placeholder="email@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Turma *</label>
              <Select
                value={newAlunoForm.turma_id}
                onValueChange={(value) => setNewAlunoForm({ ...newAlunoForm, turma_id: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma turma" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTurmas.map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Data de Início</label>
                <Input
                  type="date"
                  value={newAlunoForm.data_inicio}
                  onChange={(e) => setNewAlunoForm({ ...newAlunoForm, data_inicio: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Dia Vencimento</label>
                <Select
                  value={newAlunoForm.dia_vencimento}
                  onValueChange={(value) => setNewAlunoForm({ ...newAlunoForm, dia_vencimento: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Dia 10</SelectItem>
                    <SelectItem value="20">Dia 20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Origem</label>
              <Select
                value={newAlunoForm.origem}
                onValueChange={(value) => setNewAlunoForm({ ...newAlunoForm, origem: value as any })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direto">Direto</SelectItem>
                  <SelectItem value="lancamento">Lançamento</SelectItem>
                  <SelectItem value="npa">NPA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlunoDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={createAluno} className="bg-primary hover:bg-primary/90">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Parcelas */}
      <Dialog open={showParcelasDialog} onOpenChange={setShowParcelasDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parcelas - {alunoParcelas?.nome}</DialogTitle>
            <DialogDescription>
              Gerencie todas as parcelas deste aluno
            </DialogDescription>
          </DialogHeader>

          {alunoParcelas && (
            <div className="space-y-4">
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => estornarPagamento(pagamento.id, alunoParcelas.id)}
                                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                              >
                                Estornar
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => marcarComoPago(pagamento.id, alunoParcelas.id)}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                              >
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
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowParcelasDialog(false)}>
              Fechar
            </Button>
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
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={deleteAluno}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
