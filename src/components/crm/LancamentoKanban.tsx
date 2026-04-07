import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Plus, Search, AlertCircle, Users, Target, DollarSign, Loader2, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type LaunchPhase = 'planilha' | 'grupo_lancamento' | 'grupo_oferta' | 'follow_up_01' | 'follow_up_02' | 'follow_up_03' | 'matricula';

interface Launch {
  id: string;
  nome: string;
  status: 'planejamento' | 'em_andamento' | 'finalizado';
  ativo: boolean;
  created_at: string;
}

interface LaunchLead {
  id: string;
  lancamento_id: string;
  nome: string;
  whatsapp: string;
  email?: string;
  fase: LaunchPhase;
  no_grupo: boolean;
  grupo_oferta: boolean;
  follow_up_01?: string;
  follow_up_02?: string;
  follow_up_03?: string;
  matriculado: boolean;
  erro?: string;
  observacoes?: string;
  sheets_row_index?: number;
  responsavel_id?: string;
  created_at: string;
}

interface LancamentoKanbanProps {
  lancamentoId: string;
}

export function LancamentoKanban({ lancamentoId }: LancamentoKanbanProps) {
  const { user, users } = useAuth();
  const navigate = useNavigate();
  const [lancamento, setLancamento] = useState<Launch | null>(null);
  const [leads, setLeads] = useState<LaunchLead[]>([]);
  const [searchWhatsapp, setSearchWhatsapp] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ nome: '', whatsapp: '', email: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<LaunchLead | null>(null);

  const vinicius = users.find(u => u.nome?.toLowerCase().includes('vinicius'));

  // Fetch lançamento
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('id', lancamentoId)
        .single();
      
      if (data) setLancamento(data as Launch);
      setLoading(false);
    };
    load();
  }, [lancamentoId]);

  // Fetch leads
  useEffect(() => {
    if (!lancamentoId) return;
    
    const load = async () => {
      const { data } = await supabase
        .from('lancamento_leads')
        .select('*')
        .eq('lancamento_id', lancamentoId)
        .order('created_at', { ascending: false });
      
      if (data) setLeads(data as LaunchLead[]);
    };
    load();

    // Real-time subscription
    const channel = supabase.channel(`launch-leads-${lancamentoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamento_leads' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lancamentoId]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => 
      searchWhatsapp === '' || l.whatsapp.includes(searchWhatsapp)
    );
  }, [leads, searchWhatsapp]);

  const getLeadsByPhase = (phase: LaunchPhase) => {
    return filteredLeads.filter(l => l.fase === phase);
  };

  const phases: { id: LaunchPhase; label: string }[] = [
    { id: 'planilha', label: 'Planilha' },
    { id: 'grupo_lancamento', label: 'Grupo Lançamento' },
    { id: 'grupo_oferta', label: 'Grupo Oferta' },
    { id: 'follow_up_01', label: 'Follow Up 01' },
    { id: 'follow_up_02', label: 'Follow Up 02' },
    { id: 'follow_up_03', label: 'Follow Up 03' },
    { id: 'matricula', label: 'Matrícula' },
  ];

  const handleAddLead = async () => {
    if (!lancamentoId || !newLeadForm.nome || !newLeadForm.whatsapp) return;
    
    setIsAddingLead(true);
    const { error } = await supabase.from('lancamento_leads').insert({
      lancamento_id: lancamentoId,
      nome: newLeadForm.nome,
      whatsapp: newLeadForm.whatsapp,
      email: newLeadForm.email || null,
      fase: 'planilha',
      no_grupo: false,
      grupo_oferta: false,
      matriculado: false,
      responsavel_id: vinicius?.id,
      created_at: new Date().toISOString(),
    });

    if (!error) {
      setNewLeadForm({ nome: '', whatsapp: '', email: '' });
      const { data } = await supabase
        .from('lancamento_leads')
        .select('*')
        .eq('lancamento_id', lancamentoId);
      if (data) setLeads(data as LaunchLead[]);
    }
    setIsAddingLead(false);
  };

  const handleMoveLead = async (leadId: string, novaFase: LaunchPhase) => {
    const { error } = await supabase
      .from('lancamento_leads')
      .update({ fase: novaFase })
      .eq('id', leadId);

    if (!error) {
      setLeads(prev => prev.map(l => 
        l.id === leadId ? { ...l, fase: novaFase } : l
      ));
    }
  };

  const handleToggleActive = async () => {
    if (!lancamento) return;

    try {
      // Atualizar visual imediatamente (otimistic update)
      const novoAtivo = !lancamento.ativo;
      const novoStatus = novoAtivo ? 'em_andamento' : 'finalizado';
      setLancamento({ ...lancamento, ativo: novoAtivo, status: novoStatus });

      if (novoAtivo) {
        // Se ativando, desativar todos os outros lançamentos primeiro
        const { error: desactivateError } = await supabase
          .from('lancamentos')
          .update({ ativo: false })
          .neq('id', lancamentoId);

        if (desactivateError) {
          console.error('Erro ao desativar outros lançamentos:', desactivateError);
          // Reverter mudança visual
          setLancamento(lancamento);
          toast.error('Erro ao desativar outros lançamentos. Tente novamente.');
          return;
        }
      }

      // Atualizar o lançamento atual
      const { error } = await supabase
        .from('lancamentos')
        .update({ ativo: novoAtivo, status: novoStatus })
        .eq('id', lancamentoId);

      if (error) {
        console.error('Erro ao atualizar lançamento:', error);
        // Reverter mudança visual
        setLancamento(lancamento);
        toast.error(`Erro ao ${novoAtivo ? 'ativar' : 'desativar'} lançamento: ${error.message}`);
        return;
      }

      // Sucesso - mostrar toast de confirmação
      toast.success(`Lançamento ${novoAtivo ? 'ativado' : 'desativado'} com sucesso!`);

    } catch (err) {
      console.error('Erro inesperado ao alterar status do lançamento:', err);
      // Reverter mudança visual
      setLancamento(lancamento);
      toast.error('Erro inesperado. Tente novamente.');
    }
  };

  const handleDeleteLancamento = async () => {
    try {
      const { error } = await supabase
        .from('lancamentos')
        .delete()
        .eq('id', lancamentoId);

      if (error) {
        console.error('Erro ao deletar lançamento:', error);
        toast.error(`Erro ao deletar lançamento: ${error.message}`);
        return;
      }

      toast.success('Lançamento deletado com sucesso!');
      setShowDeleteModal(false);
      navigate('/dashboard');
    } catch (err) {
      console.error('Erro inesperado ao deletar lançamento:', err);
      toast.error('Erro inesperado. Tente novamente.');
    }
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;

    try {
      const { error } = await supabase
        .from('lancamento_leads')
        .delete()
        .eq('id', leadToDelete.id);

      if (error) {
        console.error('Erro ao deletar lead:', error);
        toast.error(`Erro ao deletar lead: ${error.message}`);
        return;
      }

      // Remover o lead da lista localmente
      setLeads(prev => prev.filter(l => l.id !== leadToDelete.id));
      toast.success('Lead deletado com sucesso!');
      setLeadToDelete(null);
    } catch (err) {
      console.error('Erro inesperado ao deletar lead:', err);
      toast.error('Erro inesperado. Tente novamente.');
    }
  };

  // Metrics
  const totalLeads = leads.length;
  const grupoLancamento = leads.filter(l => l.no_grupo).length;
  const grupoOferta = leads.filter(l => l.grupo_oferta).length;
  const matriculas = leads.filter(l => l.matriculado).length;
  const receitaMatriculas = matriculas * 109.90;

  if (loading || !lancamento) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-20 lg:pb-6 overflow-y-auto h-full bg-white">
      {/* Header com Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{lancamento.nome}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {lancamento.status === 'finalizado' ? '✅ Finalizado' : '🚀 Em Andamento'}
            </p>
          </div>
          {lancamento.status === 'finalizado' && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              Finalizado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Apagar
          </Button>
          <button
            onClick={handleToggleActive}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-600 transition-all text-white ${
              lancamento.ativo
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-500 hover:bg-gray-600'
            }`}
            title={lancamento.ativo ? 'Desativar lançamento' : 'Ativar lançamento'}
          >
            <Power className="h-4 w-4" />
            {lancamento.ativo ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-500 text-muted-foreground">Total de Leads</p>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{totalLeads}</p>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-500 text-muted-foreground">Grupo Lançamento</p>
            <Target className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold">{grupoLancamento}</p>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-500 text-muted-foreground">Grupo Oferta</p>
            <Target className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">{grupoOferta}</p>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-500 text-muted-foreground">Matrículas</p>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{matriculas}</p>
          <p className="text-xs text-muted-foreground mt-1">R$ {receitaMatriculas.toLocaleString('pt-BR')}</p>
        </Card>
      </div>

      {/* Search and Add Lead */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por WhatsApp..."
            value={searchWhatsapp}
            onChange={e => setSearchWhatsapp(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="default" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <input
                placeholder="Nome"
                value={newLeadForm.nome}
                onChange={e => setNewLeadForm({ ...newLeadForm, nome: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <input
                placeholder="WhatsApp"
                value={newLeadForm.whatsapp}
                onChange={e => setNewLeadForm({ ...newLeadForm, whatsapp: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <input
                placeholder="Email (opcional)"
                value={newLeadForm.email}
                onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <Button onClick={handleAddLead} disabled={isAddingLead} className="w-full">
                {isAddingLead ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-full pb-4">
          {phases.map(phase => (
            <div key={phase.id} className="flex-shrink-0 w-80">
              <div className="bg-muted rounded-lg p-4 h-full">
                <div className="sticky top-0 bg-muted pb-3 mb-3 border-b">
                  <h3 className="font-600">{phase.label}</h3>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {getLeadsByPhase(phase.id).length} leads
                  </Badge>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {getLeadsByPhase(phase.id).map(lead => (
                    <div
                      key={lead.id}
                      className={`p-3 rounded-lg border ${
                        lead.erro
                          ? 'bg-red-50 border-red-200'
                          : lead.matriculado
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-border'
                      } cursor-pointer hover:shadow-md transition-all`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-500 text-sm flex-1">{lead.nome}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {lead.erro && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLeadToDelete(lead);
                            }}
                            className="h-4 w-4 text-muted-foreground hover:text-red-500 transition-colors"
                            title="Apagar lead"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{lead.whatsapp}</p>
                      {lead.email && (
                        <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                      )}
                      
                      {/* Badges */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {lead.no_grupo && (
                          <Badge className="text-xs bg-amber-100 text-amber-700">Grupo</Badge>
                        )}
                        {lead.grupo_oferta && (
                          <Badge className="text-xs bg-purple-100 text-purple-700">Oferta</Badge>
                        )}
                        {lead.matriculado && (
                          <Badge className="text-xs bg-green-100 text-green-700">Matr.</Badge>
                        )}
                      </div>

                      {/* Move Select */}
                      <Select
                        value={lead.fase}
                        onValueChange={value => handleMoveLead(lead.id, value as LaunchPhase)}
                        disabled={lancamento.status === 'finalizado'}
                      >
                        <SelectTrigger className="mt-2 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {phases.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar Lançamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja apagar este lançamento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteLancamento}>
              Apagar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Lead Confirmation Modal */}
      <Dialog open={!!leadToDelete} onOpenChange={() => setLeadToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar Lead</DialogTitle>
            <DialogDescription>
              Deseja apagar o lead "{leadToDelete?.nome}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setLeadToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteLead}>
              Apagar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
