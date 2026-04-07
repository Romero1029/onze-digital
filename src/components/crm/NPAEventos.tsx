import { useState, useMemo, useEffect } from 'react';
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
import { Plus, Search, AlertCircle, Users, DollarSign, Loader2, Power } from 'lucide-react';
import { format } from 'date-fns';

type NPAPhase = 'novo' | 'ingresso_pago' | 'evento' | 'closer' | 'follow_up_01' | 'follow_up_02' | 'follow_up_03' | 'matricula';
type NPAStatus = 'em_andamento' | 'finalizado';

interface NPAEvento {
  id: string;
  nome: string;
  data_evento?: string;
  status: NPAStatus;
  ativo: boolean;
  created_at: string;
}

interface NPAEventoLead {
  id: string;
  npa_evento_id: string;
  nome: string;
  whatsapp: string;
  email?: string;
  fase: NPAPhase;
  ingresso_pago: boolean;
  presente_evento: boolean;
  follow_up_01?: string;
  follow_up_02?: string;
  follow_up_03?: string;
  matriculado: boolean;
  erro?: string;
  observacoes?: string;
  responsavel_id?: string;
  created_at: string;
}

export function NPAEventos() {
  const { user, users } = useAuth();
  const [eventos, setEventos] = useState<NPAEvento[]>([]);
  const [currentEventoId, setCurrentEventoId] = useState<string | null>(null);
  const [eventoLeads, setEventoLeads] = useState<NPAEventoLead[]>([]);
  const [searchWhatsapp, setSearchWhatsapp] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [isCreatingEvento, setIsCreatingEvento] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ nome: '', whatsapp: '', email: '' });
  const [newEventoForm, setNewEventoForm] = useState({
    nome: '',
    data_evento: '',
  });

  const vinicius = users.find(u => u.nome?.toLowerCase().includes('vinicius'));

  // Fetch eventos
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('npa_eventos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        setEventos(data as NPAEvento[]);
        if (data.length > 0 && !currentEventoId) {
          setCurrentEventoId(data[0].id);
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  // Fetch evento leads when current evento changes
  useEffect(() => {
    if (!currentEventoId) return;
    
    const load = async () => {
      const { data } = await supabase
        .from('npa_evento_leads')
        .select('*')
        .eq('npa_evento_id', currentEventoId)
        .order('created_at', { ascending: false });
      
      if (data) setEventoLeads(data as NPAEventoLead[]);
    };
    load();

    // Real-time subscription
    const channel = supabase.channel(`npa-leads-${currentEventoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'npa_evento_leads' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentEventoId]);

  const currentEvento = eventos.find(e => e.id === currentEventoId);
  const filteredLeads = useMemo(() => {
    return eventoLeads.filter(l => 
      searchWhatsapp === '' || l.whatsapp.includes(searchWhatsapp)
    );
  }, [eventoLeads, searchWhatsapp]);

  const getLeadsByPhase = (phase: NPAPhase) => {
    return filteredLeads.filter(l => l.fase === phase);
  };

  const phases: { id: NPAPhase; label: string }[] = [
    { id: 'novo', label: 'Novo' },
    { id: 'ingresso_pago', label: 'Ingresso Pago' },
    { id: 'evento', label: 'Evento' },
    { id: 'closer', label: 'Closer' },
    { id: 'follow_up_01', label: 'Follow Up 01' },
    { id: 'follow_up_02', label: 'Follow Up 02' },
    { id: 'follow_up_03', label: 'Follow Up 03' },
    { id: 'matricula', label: 'Matrícula' },
  ];

  const handleAddLead = async () => {
    if (!currentEventoId || !newLeadForm.nome || !newLeadForm.whatsapp) return;
    
    setIsAddingLead(true);
    const { error } = await supabase.from('npa_evento_leads').insert({
      npa_evento_id: currentEventoId,
      nome: newLeadForm.nome,
      whatsapp: newLeadForm.whatsapp,
      email: newLeadForm.email || null,
      fase: 'novo',
      ingresso_pago: false,
      presente_evento: false,
      matriculado: false,
      responsavel_id: vinicius?.id,
      created_at: new Date().toISOString(),
    });

    if (!error) {
      setNewLeadForm({ nome: '', whatsapp: '', email: '' });
      const { data } = await supabase
        .from('npa_evento_leads')
        .select('*')
        .eq('npa_evento_id', currentEventoId);
      if (data) setEventoLeads(data as NPAEventoLead[]);
    }
    setIsAddingLead(false);
  };

  const handleMoveLead = async (leadId: string, novaFase: NPAPhase) => {
    const { error } = await supabase
      .from('npa_evento_leads')
      .update({ fase: novaFase })
      .eq('id', leadId);

    if (!error) {
      setEventoLeads(prev => prev.map(l => 
        l.id === leadId ? { ...l, fase: novaFase } : l
      ));
    }
  };

  const handleCreateEvento = async () => {
    if (!newEventoForm.nome) return;
    
    setIsCreatingEvento(true);
    const { data, error } = await supabase.from('npa_eventos').insert({
      nome: newEventoForm.nome,
      data_evento: newEventoForm.data_evento || null,
      status: 'em_andamento',
      ativo: true,
      created_at: new Date().toISOString(),
    }).select().single();

    if (data) {
      setEventos([data as NPAEvento, ...eventos]);
      setCurrentEventoId(data.id);
      setNewEventoForm({ nome: '', data_evento: '' });
    }
    setIsCreatingEvento(false);
  };

  const handleToggleActive = async (eventoId: string) => {
    const evento = eventos.find(e => e.id === eventoId);
    if (!evento) return;

    // Se ativando, desativar todos os outros
    if (!evento.ativo) {
      const { error: desactivateError } = await supabase
        .from('npa_eventos')
        .update({ ativo: false })
        .neq('id', eventoId);

      if (desactivateError) {
        console.error('Error desactivating others:', desactivateError);
        return;
      }
    }

    // Atualizar o status do evento
    const novoStatus: NPAStatus = !evento.ativo ? 'em_andamento' : 'finalizado';
    const { error } = await supabase
      .from('npa_eventos')
      .update({ ativo: !evento.ativo, status: novoStatus })
      .eq('id', eventoId);

    if (!error) {
      setEventos(eventos.map(e => {
        if (e.id === eventoId) {
          return { ...e, ativo: !e.ativo, status: novoStatus };
        }
        return { ...e, ativo: false };
      }));
    }
  };

  // Metrics
  const totalLeads = eventoLeads.length;
  const ingressosPagos = eventoLeads.filter(l => l.ingresso_pago).length;
  const presentesEvento = eventoLeads.filter(l => l.presente_evento).length;
  const matriculas = eventoLeads.filter(l => l.matriculado).length;
  const receitaIngressos = ingressosPagos * 10;
  const receitaMatriculas = matriculas * 397;

  if (loading || !currentEvento) {
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">{currentEvento.nome}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentEvento.status === 'em_andamento' ? '🚀 Em Andamento' : '✅ Finalizado'}
          </p>
        </div>
        <button
          onClick={() => handleToggleActive(currentEvento.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-600 transition-all text-white ${
            currentEvento.ativo
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-gray-500 hover:bg-gray-600'
          }`}
          title={currentEvento.ativo ? 'Desativar evento' : 'Ativar evento'}
        >
          <Power className="h-4 w-4" />
          {currentEvento.ativo ? 'Ativo' : 'Inativo'}
        </button>
      </div>

      {/* Eventos Selector Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-600 text-foreground">Eventos NPA</h2>
            <p className="text-xs text-muted-foreground mt-1">Total: {eventos.length} | Ativos: {eventos.filter(e => e.ativo).length}</p>
          </div>
          <Dialog open={isCreatingEvento} onOpenChange={setIsCreatingEvento}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4" />
                Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Evento NPA</DialogTitle>
                <DialogDescription>Crie um novo evento NPA</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <input
                  placeholder="Nome (ex: NPA #03)"
                  value={newEventoForm.nome}
                  onChange={e => setNewEventoForm({ ...newEventoForm, nome: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <input
                  type="date"
                  value={newEventoForm.data_evento}
                  onChange={e => setNewEventoForm({ ...newEventoForm, data_evento: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <Button onClick={handleCreateEvento} className="w-full">
                  Criar Evento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Eventos Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {eventos.map(evento => {
            return (
              <div key={evento.id} className="relative group">
                <button
                  onClick={() => setCurrentEventoId(evento.id)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                    currentEventoId === evento.id
                      ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                      : evento.status === 'finalizado'
                      ? 'border-red-300 bg-red-50 hover:shadow-md'
                      : 'border-amber-300 bg-amber-50 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-600 text-sm truncate">{evento.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {evento.status === 'em_andamento' ? '🚀 Em Andamento' : '✅ Finalizado'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Ativo/Inativo Badge */}
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${evento.ativo ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-xs font-500">
                      {evento.ativo ? '🟢 Ativo' : '⚫ Inativo'}
                    </span>
                  </div>
                </button>

                {/* Toggle Button */}
                <button
                  onClick={() => handleToggleActive(evento.id)}
                  className={`absolute -top-2 -right-2 p-2 rounded-full transition-all shadow-md opacity-0 group-hover:opacity-100 ${
                    evento.ativo
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-400 hover:bg-gray-500 text-white'
                  }`}
                  title={evento.ativo ? 'Desativar' : 'Ativar'}
                >
                  <Power className="h-4 w-4" />
                </button>
              </div>
            );
          })}
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
            <p className="text-xs font-500 text-muted-foreground">Ingressos Pagos</p>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold">{ingressosPagos}</p>
          <p className="text-xs text-muted-foreground mt-1">R$ {receitaIngressos.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-500 text-muted-foreground">Presentes no Evento</p>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{presentesEvento}</p>
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

      {/* Overlay when finalized */}
      {currentEvento.status === 'finalizado' && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-yellow-500 pointer-events-auto">
            <p className="font-600 text-lg">🔒 Evento Finalizado</p>
            <p className="text-sm text-muted-foreground mt-1">Este evento está em modo somente leitura</p>
          </div>
        </div>
      )}

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
                        {lead.erro && (
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{lead.whatsapp}</p>
                      {lead.email && (
                        <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                      )}
                      
                      {/* Badges */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {lead.ingresso_pago && (
                          <Badge className="text-xs bg-amber-100 text-amber-700">Ingr. Pago</Badge>
                        )}
                        {lead.presente_evento && (
                          <Badge className="text-xs bg-blue-100 text-blue-700">Presente</Badge>
                        )}
                        {lead.matriculado && (
                          <Badge className="text-xs bg-green-100 text-green-700">Matr.</Badge>
                        )}
                      </div>

                      {/* Move Select */}
                      <Select
                        value={lead.fase}
                        onValueChange={value => handleMoveLead(lead.id, value as NPAPhase)}
                        disabled={currentEvento.status === 'finalizado'}
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
    </div>
  );
}
