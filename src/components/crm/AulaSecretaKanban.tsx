import { useState, useEffect } from 'react';
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
import { Plus, Search, Users, Target, DollarSign, Loader2, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type AulaSecretaPhase = 'convite' | 'no_grupo' | 'matricula';

interface AulaSecretaEvento {
  id: string;
  nome: string;
  status: 'em_andamento' | 'finalizado' | 'planejamento';
  ativo: boolean;
  created_at: string;
}

interface AulaSecretaLead {
  id: string;
  aula_secreta_evento_id: string;
  nome: string;
  whatsapp: string;
  email?: string;
  fase: AulaSecretaPhase;
  matriculado: boolean;
  valor_matricula: number;
  erro?: string;
  observacoes?: string;
  responsavel_id?: string;
  created_at: string;
}

interface AulaSecretaKanbanProps {
  aulaSecretaId: string;
}

const phases = [
  { id: 'convite' as AulaSecretaPhase, label: 'Convite' },
  { id: 'no_grupo' as AulaSecretaPhase, label: 'No Grupo' },
  { id: 'matricula' as AulaSecretaPhase, label: 'Matrícula' },
];

export function AulaSecretaKanban({ aulaSecretaId }: AulaSecretaKanbanProps) {
  const { user } = useAuth();
  const [evento, setEvento] = useState<AulaSecretaEvento | null>(null);
  const [leads, setLeads] = useState<AulaSecretaLead[]>([]);
  const [searchWhatsapp, setSearchWhatsapp] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ nome: '', whatsapp: '', email: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<AulaSecretaLead | null>(null);

  // Fetch evento
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('aula_secreta_eventos')
        .select('*')
        .eq('id', aulaSecretaId)
        .single();

      if (error) {
        toast.error('Erro ao carregar Aula Secreta');
        setLoading(false);
        return;
      }
      if (data) setEvento(data as AulaSecretaEvento);
      setLoading(false);
    };
    if (aulaSecretaId) load();
  }, [aulaSecretaId]);

  // Fetch leads + realtime
  useEffect(() => {
    if (!aulaSecretaId) return;

    const loadLeads = async () => {
      const { data } = await supabase
        .from('aula_secreta_leads')
        .select('*')
        .eq('aula_secreta_evento_id', aulaSecretaId)
        .order('created_at', { ascending: false });

      if (data) setLeads(data as AulaSecretaLead[]);
    };
    loadLeads();

    const channel = supabase.channel(`aula-secreta-leads-${aulaSecretaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aula_secreta_leads' }, () => loadLeads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [aulaSecretaId]);

  const loadLeads = async () => {
    const { data } = await supabase
      .from('aula_secreta_leads')
      .select('*')
      .eq('aula_secreta_evento_id', aulaSecretaId)
      .order('created_at', { ascending: false });

    if (data) setLeads(data as AulaSecretaLead[]);
  };

  const handleToggleActive = async () => {
    if (!evento) return;
    const novoAtivo = !evento.ativo;
    const novoStatus = novoAtivo ? 'em_andamento' : 'finalizado';
    setEvento({ ...evento, ativo: novoAtivo, status: novoStatus });

    try {
      if (novoAtivo) {
        await supabase
          .from('aula_secreta_eventos')
          .update({ ativo: false })
          .neq('id', aulaSecretaId);
      }

      const { error } = await supabase
        .from('aula_secreta_eventos')
        .update({ ativo: novoAtivo, status: novoStatus })
        .eq('id', aulaSecretaId);

      if (error) {
        setEvento(evento);
        toast.error(`Erro ao atualizar Aula Secreta: ${error.message}`);
        return;
      }

      toast.success(`Aula Secreta ${novoAtivo ? 'ativada' : 'desativada'} com sucesso!`);
    } catch (err) {
      setEvento(evento);
      toast.error('Erro inesperado. Tente novamente.');
    }
  };

  const handleDeleteEvento = async () => {
    try {
      const { error } = await supabase
        .from('aula_secreta_eventos')
        .delete()
        .eq('id', aulaSecretaId);

      if (error) {
        toast.error(`Erro ao apagar Aula Secreta: ${error.message}`);
        return;
      }

      toast.success('Aula Secreta apagada com sucesso!');
      setShowDeleteModal(false);
      window.location.reload();
    } catch (err) {
      toast.error('Erro inesperado. Tente novamente.');
    }
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      const { error } = await supabase
        .from('aula_secreta_leads')
        .delete()
        .eq('id', leadToDelete.id);

      if (error) {
        toast.error(`Erro ao apagar lead: ${error.message}`);
        return;
      }

      setLeads(prev => prev.filter(l => l.id !== leadToDelete.id));
      toast.success('Lead apagado com sucesso!');
      setLeadToDelete(null);
    } catch (err) {
      toast.error('Erro inesperado. Tente novamente.');
    }
  };

  const handleMoveLead = async (leadId: string, newPhase: AulaSecretaPhase) => {
    const { error } = await supabase
      .from('aula_secreta_leads')
      .update({ fase: newPhase })
      .eq('id', leadId);

    if (error) toast.error('Erro ao mover lead');
  };

  const handleAddLead = async () => {
    if (!newLeadForm.nome.trim() || !newLeadForm.whatsapp.trim()) return;
    setIsAddingLead(true);
    try {
      const { error } = await supabase
        .from('aula_secreta_leads')
        .insert({
          aula_secreta_evento_id: aulaSecretaId,
          nome: newLeadForm.nome,
          whatsapp: newLeadForm.whatsapp,
          email: newLeadForm.email || null,
          fase: 'convite',
          matriculado: false,
        });

      if (error) {
        toast.error(`Erro ao adicionar lead: ${error.message}`);
      } else {
        toast.success('Lead adicionado com sucesso!');
        setNewLeadForm({ nome: '', whatsapp: '', email: '' });
        await loadLeads();
        setShowAddLeadModal(false);
      }
    } catch (err) {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsAddingLead(false);
    }
  };

  // Métricas
  const totalLeads = leads.length;
  const matriculas = leads.filter(l => l.matriculado).length;
  const receitaMatriculas = leads.reduce((acc, l) => acc + (l.matriculado ? (l.valor_matricula || 397) : 0), 0);

  const getLeadsByPhase = (phase: AulaSecretaPhase) => leads.filter(l => l.fase === phase);

  if (loading || !evento) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-20 lg:pb-6 overflow-y-auto h-full bg-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{evento.nome}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {evento.status === 'finalizado' ? '✅ Finalizado' : '🚀 Em Andamento'}
            </p>
          </div>
          {evento.status === 'finalizado' && (
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
              evento.ativo ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600'
            }`}
          >
            <Power className="h-4 w-4" />
            {evento.ativo ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>

      {/* Métricas */}
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
            <p className="text-xs font-500 text-muted-foreground">Matrículas</p>
            <Target className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{matriculas}</p>
          <p className="text-xs text-muted-foreground">R$ {receitaMatriculas.toFixed(2)}</p>
        </Card>
      </div>

      {/* Busca e Adicionar Lead */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por WhatsApp..."
              value={searchWhatsapp}
              onChange={(e) => setSearchWhatsapp(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Dialog open={showAddLeadModal} onOpenChange={setShowAddLeadModal}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={evento.status === 'finalizado'}>
              <Plus className="h-4 w-4" />
              Adicionar Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Lead</DialogTitle>
              <DialogDescription>Adicione um novo lead à Aula Secreta</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Nome"
                value={newLeadForm.nome}
                onChange={e => setNewLeadForm({ ...newLeadForm, nome: e.target.value })}
              />
              <Input
                placeholder="WhatsApp"
                value={newLeadForm.whatsapp}
                onChange={e => setNewLeadForm({ ...newLeadForm, whatsapp: e.target.value })}
              />
              <Input
                placeholder="Email (opcional)"
                value={newLeadForm.email}
                onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
              />
              <Button onClick={handleAddLead} disabled={isAddingLead} className="w-full">
                {isAddingLead ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban */}
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
                  {getLeadsByPhase(phase.id)
                    .filter(lead =>
                      !searchWhatsapp ||
                      lead.whatsapp.toLowerCase().includes(searchWhatsapp.toLowerCase())
                    )
                    .map(lead => (
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
                            <button
                              onClick={(e) => { e.stopPropagation(); setLeadToDelete(lead); }}
                              className="h-4 w-4 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Apagar lead"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {lead.whatsapp}
                          {lead.email && <div>{lead.email}</div>}
                        </div>
                        <Select
                          value={lead.fase}
                          onValueChange={value => handleMoveLead(lead.id, value as AulaSecretaPhase)}
                          disabled={evento.status === 'finalizado'}
                        >
                          <SelectTrigger className="mt-2 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {phases.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
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

      {/* Modal Apagar Evento */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar Aula Secreta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja apagar esta Aula Secreta? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteEvento}>Apagar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Apagar Lead */}
      <Dialog open={!!leadToDelete} onOpenChange={() => setLeadToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar Lead</DialogTitle>
            <DialogDescription>
              Deseja apagar o lead "{leadToDelete?.nome}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setLeadToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteLead}>Apagar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
