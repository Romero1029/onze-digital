import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import {
  Plus, Search, AlertCircle, Users, Target, DollarSign,
  Loader2, Power, Trash2, Pencil, TrendingUp, BarChart2
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type LaunchPhase =
  | 'planilha'
  | 'grupo_lancamento'
  | 'grupo_oferta'
  | 'follow_up_01'
  | 'follow_up_02'
  | 'follow_up_03'
  | 'matricula';

type ActiveView = 'kanban' | 'metas' | 'relatorio';

interface Launch {
  id: string;
  nome: string;
  status: 'planejamento' | 'em_andamento' | 'finalizado';
  ativo: boolean;
  created_at: string;
  valor_matricula?: number;
  meta_leads?: number;
  meta_matriculas?: number;
  meta_faturamento?: number;
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
  follow_up_01?: boolean | string;
  follow_up_02?: boolean | string;
  follow_up_03?: boolean | string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALOR_MATRICULA_PADRAO = 109.90;

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPhasePayload(phase: LaunchPhase): Record<string, boolean> {
  switch (phase) {
    case 'planilha':
      return { no_grupo: false, grupo_oferta: false, follow_up_01: false, follow_up_02: false, follow_up_03: false, matriculado: false };
    case 'grupo_lancamento':
      return { no_grupo: true, grupo_oferta: false, follow_up_01: false, follow_up_02: false, follow_up_03: false, matriculado: false };
    case 'grupo_oferta':
      return { grupo_oferta: true, follow_up_01: false, follow_up_02: false, follow_up_03: false, matriculado: false };
    case 'follow_up_01':
      return { follow_up_01: true, follow_up_02: false, follow_up_03: false, matriculado: false };
    case 'follow_up_02':
      return { follow_up_02: true, follow_up_03: false, matriculado: false };
    case 'follow_up_03':
      return { follow_up_03: true, matriculado: false };
    case 'matricula':
      return { matriculado: true };
  }
}

// ─── MetaBar ──────────────────────────────────────────────────────────────────

function MetaBar({ label, atual, meta, color }: { label: string; atual: number; meta: number; color: string }) {
  const pct = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{atual} / {meta} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── MetaTab ──────────────────────────────────────────────────────────────────

function MetaTab({
  lancamento,
  leads,
  onSave,
}: {
  lancamento: Launch;
  leads: LaunchLead[];
  onSave: (updates: Partial<Launch>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    meta_leads: String(lancamento.meta_leads ?? ''),
    meta_matriculas: String(lancamento.meta_matriculas ?? ''),
    meta_faturamento: String(lancamento.meta_faturamento ?? ''),
  });
  const [saving, setSaving] = useState(false);

  const totalLeads = leads.length;
  const matriculas = leads.filter(l => l.matriculado).length;
  const valorMatricula = Number(lancamento.valor_matricula) || VALOR_MATRICULA_PADRAO;
  const receitaReal = matriculas * valorMatricula;

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      meta_leads: Number(form.meta_leads) || 0,
      meta_matriculas: Number(form.meta_matriculas) || 0,
      meta_faturamento: Number(form.meta_faturamento) || 0,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Form */}
      <Card className="p-6 border border-border space-y-4">
        <h3 className="font-semibold text-base">Definir Metas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Meta de Leads</label>
            <Input
              type="number"
              value={form.meta_leads}
              onChange={e => setForm(f => ({ ...f, meta_leads: e.target.value }))}
              placeholder="Ex: 500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Meta de Matrículas</label>
            <Input
              type="number"
              value={form.meta_matriculas}
              onChange={e => setForm(f => ({ ...f, meta_matriculas: e.target.value }))}
              placeholder="Ex: 50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Meta de Faturamento (R$)</label>
            <Input
              type="number"
              value={form.meta_faturamento}
              onChange={e => setForm(f => ({ ...f, meta_faturamento: e.target.value }))}
              placeholder="Ex: 5495"
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Salvando...' : 'Salvar Metas'}
        </Button>
      </Card>

      {/* Meta vs Realidade */}
      <Card className="p-6 border border-border space-y-4">
        <h3 className="font-semibold text-base">Meta vs Realidade</h3>
        <MetaBar
          label="Leads"
          atual={totalLeads}
          meta={lancamento.meta_leads ?? 0}
          color="bg-blue-500"
        />
        <MetaBar
          label="Matrículas"
          atual={matriculas}
          meta={lancamento.meta_matriculas ?? 0}
          color="bg-green-500"
        />
        <MetaBar
          label={`Faturamento (R$ ${fmt(receitaReal)})`}
          atual={receitaReal}
          meta={lancamento.meta_faturamento ?? 0}
          color="bg-purple-500"
        />
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Leads', value: String(totalLeads), color: 'text-blue-600' },
          { label: 'Matrículas', value: String(matriculas), color: 'text-green-600' },
          { label: 'Faturamento Real', value: `R$ ${fmt(receitaReal)}`, color: 'text-purple-600' },
          { label: 'Meta Leads', value: String(lancamento.meta_leads ?? 0), color: 'text-muted-foreground' },
          { label: 'Meta Matrículas', value: String(lancamento.meta_matriculas ?? 0), color: 'text-muted-foreground' },
          { label: 'Meta Faturamento', value: `R$ ${fmt(lancamento.meta_faturamento ?? 0)}`, color: 'text-muted-foreground' },
        ].map(card => (
          <Card key={card.label} className="p-4 border border-border">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── RelatorioTab ─────────────────────────────────────────────────────────────

function RelatorioTab({ lancamento, leads }: { lancamento: Launch; leads: LaunchLead[] }) {
  const valorMatricula = Number(lancamento.valor_matricula) || VALOR_MATRICULA_PADRAO;

  const totalLeads = leads.length;
  const grupoLancamento = leads.filter(l => l.no_grupo).length;
  const grupoOferta = leads.filter(l => l.grupo_oferta).length;
  const follow1 = leads.filter(l => l.follow_up_01).length;
  const follow2 = leads.filter(l => l.follow_up_02).length;
  const follow3 = leads.filter(l => l.follow_up_03).length;
  const matriculas = leads.filter(l => l.matriculado).length;
  const receitaReal = matriculas * valorMatricula;

  const funil = [
    { label: 'Planilha (Total)', value: totalLeads, color: 'bg-gray-400' },
    { label: 'Grupo Lançamento', value: grupoLancamento, color: 'bg-amber-400' },
    { label: 'Grupo Oferta', value: grupoOferta, color: 'bg-purple-400' },
    { label: 'Follow Up 01', value: follow1, color: 'bg-orange-400' },
    { label: 'Follow Up 02', value: follow2, color: 'bg-red-400' },
    { label: 'Follow Up 03', value: follow3, color: 'bg-red-600' },
    { label: 'Matrículas', value: matriculas, color: 'bg-green-500' },
  ];

  const maxVal = totalLeads || 1;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Funil */}
      <Card className="p-6 border border-border space-y-3">
        <h3 className="font-semibold text-base">Funil do Lançamento</h3>
        {funil.map(f => (
          <div key={f.label} className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{f.label}</span>
              <span>{f.value}</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${f.color}`}
                style={{ width: `${(f.value / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 border border-border">
          <p className="text-xs text-muted-foreground">Taxa de Matrícula</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {totalLeads > 0 ? ((matriculas / totalLeads) * 100).toFixed(1) : '0.0'}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">{matriculas} de {totalLeads} leads</p>
        </Card>
        <Card className="p-4 border border-border">
          <p className="text-xs text-muted-foreground">Faturamento</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">R$ {fmt(receitaReal)}</p>
          <p className="text-xs text-muted-foreground mt-1">R$ {fmt(valorMatricula)} / matrícula</p>
        </Card>
        <Card className="p-4 border border-border">
          <p className="text-xs text-muted-foreground">Grupo Lançamento</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{grupoLancamento}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalLeads > 0 ? ((grupoLancamento / totalLeads) * 100).toFixed(1) : '0.0'}% dos leads
          </p>
        </Card>
        <Card className="p-4 border border-border">
          <p className="text-xs text-muted-foreground">Grupo Oferta</p>
          <p className="text-2xl font-bold text-purple-500 mt-1">{grupoOferta}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {grupoLancamento > 0 ? ((grupoOferta / grupoLancamento) * 100).toFixed(1) : '0.0'}% do grupo lancamento
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LancamentoKanban({ lancamentoId }: LancamentoKanbanProps) {
  const { user, users } = useAuth();
  const navigate = useNavigate();
  const [lancamento, setLancamento] = useState<Launch | null>(null);
  const [leads, setLeads] = useState<LaunchLead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('kanban');
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ nome: '', whatsapp: '', email: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<LaunchLead | null>(null);
  const [editingValor, setEditingValor] = useState(false);
  const [valorInput, setValorInput] = useState('');

  // Pending guard: blocks Realtime from overwriting optimistic phase updates
  const pendingUpdates = useRef<Map<string, LaunchPhase>>(new Map());
  const leadsRef = useRef<LaunchLead[]>([]);
  useEffect(() => { leadsRef.current = leads; }, [leads]);

  const vinicius = users.find(u => u.nome?.toLowerCase().includes('vinicius'));

  // ── Fetch lancamento ────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('id', lancamentoId)
        .single();
      if (data) setLancamento(data as Launch);
      setLoading(false);
    };
    load();
  }, [lancamentoId]);

  // ── Fetch leads + Realtime ──────────────────────────────────────────────────
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

    const channel = supabase
      .channel(`launch-leads-${lancamentoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lancamento_leads' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLeads(prev => [payload.new as LaunchLead, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as LaunchLead;
            setLeads(prev =>
              prev.map(l => {
                if (l.id !== updated.id) return l;
                const expected = pendingUpdates.current.get(updated.id);
                if (expected !== undefined) return { ...updated, fase: expected };
                return updated;
              })
            );
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== (payload.old as LaunchLead).id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lancamentoId]);

  // ── Move lead ───────────────────────────────────────────────────────────────
  const handleMoveLead = useCallback(async (leadId: string, newPhase: LaunchPhase) => {
    const previousLeads = leadsRef.current;
    pendingUpdates.current.set(leadId, newPhase);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, fase: newPhase } : l));

    const flagPayload = getPhasePayload(newPhase);
    const { data: updated, error } = await supabase
      .from('lancamento_leads')
      .update({ ...flagPayload, fase: newPhase })
      .eq('id', leadId)
      .select('*')
      .single();

    if (error || !updated) {
      pendingUpdates.current.delete(leadId);
      toast.error('Erro ao mover lead' + (error ? ': ' + error.message : ''));
      setLeads(previousLeads);
      return;
    }

    setLeads(prev => prev.map(l => l.id === leadId ? (updated as LaunchLead) : l));
    setTimeout(() => { pendingUpdates.current.delete(leadId); }, 5000);
  }, []);

  // ── Add lead ────────────────────────────────────────────────────────────────
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
    if (!error) setNewLeadForm({ nome: '', whatsapp: '', email: '' });
    setIsAddingLead(false);
  };

  // ── Toggle active ───────────────────────────────────────────────────────────
  const handleToggleActive = async () => {
    if (!lancamento) return;
    const novoAtivo = !lancamento.ativo;
    const novoStatus = novoAtivo ? 'em_andamento' : 'finalizado';
    setLancamento({ ...lancamento, ativo: novoAtivo, status: novoStatus });

    if (novoAtivo) {
      await supabase.from('lancamentos').update({ ativo: false }).neq('id', lancamentoId);
    }
    const { error } = await supabase
      .from('lancamentos')
      .update({ ativo: novoAtivo, status: novoStatus })
      .eq('id', lancamentoId);

    if (error) {
      setLancamento(lancamento);
      toast.error('Erro ao atualizar lançamento');
    } else {
      toast.success(`Lançamento ${novoAtivo ? 'ativado' : 'desativado'}!`);
    }
  };

  // ── Delete lancamento ───────────────────────────────────────────────────────
  const handleDeleteLancamento = async () => {
    const { error } = await supabase.from('lancamentos').delete().eq('id', lancamentoId);
    if (error) { toast.error('Erro ao deletar: ' + error.message); return; }
    toast.success('Lançamento deletado!');
    setShowDeleteModal(false);
    navigate('/dashboard');
  };

  // ── Delete lead ─────────────────────────────────────────────────────────────
  const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    const { error } = await supabase.from('lancamento_leads').delete().eq('id', leadToDelete.id);
    if (error) { toast.error('Erro ao deletar lead'); return; }
    setLeads(prev => prev.filter(l => l.id !== leadToDelete.id));
    toast.success('Lead deletado!');
    setLeadToDelete(null);
  };

  // ── Save metas ──────────────────────────────────────────────────────────────
  const handleSaveMetas = async (updates: Partial<Launch>) => {
    const { error } = await supabase.from('lancamentos').update(updates).eq('id', lancamentoId);
    if (error) { toast.error('Erro ao salvar metas'); return; }
    setLancamento(prev => prev ? { ...prev, ...updates } : prev);
    toast.success('Metas salvas!');
  };

  // ── Save valor matrícula ────────────────────────────────────────────────────
  const handleSaveValor = async () => {
    const v = parseFloat(valorInput.replace(',', '.'));
    if (isNaN(v) || v <= 0) { toast.error('Valor inválido'); return; }
    const { error } = await supabase
      .from('lancamentos')
      .update({ valor_matricula: v })
      .eq('id', lancamentoId);
    if (error) { toast.error('Erro ao salvar valor'); return; }
    setLancamento(prev => prev ? { ...prev, valor_matricula: v } : prev);
    setEditingValor(false);
    toast.success('Valor da matrícula atualizado!');
  };

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const valorMatricula = Number(lancamento?.valor_matricula) || VALOR_MATRICULA_PADRAO;
  const totalLeads = leads.length;
  const grupoLancamento = leads.filter(l => l.no_grupo).length;
  const grupoOferta = leads.filter(l => l.grupo_oferta).length;
  const matriculas = leads.filter(l => l.matriculado).length;
  const receitaMatriculas = matriculas * valorMatricula;

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(l =>
      l.nome.toLowerCase().includes(q) || l.whatsapp.toLowerCase().includes(q)
    );
  }, [leads, searchQuery]);

  const getLeadsByPhase = (phase: LaunchPhase) => filteredLeads.filter(l => l.fase === phase);

  const phases: { id: LaunchPhase; label: string }[] = [
    { id: 'planilha', label: 'Planilha' },
    { id: 'grupo_lancamento', label: 'Grupo Lançamento' },
    { id: 'grupo_oferta', label: 'Grupo Oferta' },
    { id: 'follow_up_01', label: 'Follow Up 01' },
    { id: 'follow_up_02', label: 'Follow Up 02' },
    { id: 'follow_up_03', label: 'Follow Up 03' },
    { id: 'matricula', label: 'Matrícula' },
  ];

  if (loading || !lancamento) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-20 lg:pb-6 overflow-y-auto h-full bg-white">

      {/* ── Header ── */}
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
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteModal(true)} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Apagar
          </Button>
          <button
            onClick={handleToggleActive}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-white ${
              lancamento.ativo ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600'
            }`}
          >
            <Power className="h-4 w-4" />
            {lancamento.ativo ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Total de Leads</p>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{totalLeads}</p>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Grupo Lançamento</p>
            <Target className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold">{grupoLancamento}</p>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Grupo Oferta</p>
            <Target className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">{grupoOferta}</p>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Matrículas</p>
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <button
                onClick={() => { setValorInput(String(valorMatricula)); setEditingValor(true); }}
                className="text-muted-foreground hover:text-foreground"
                title="Editar valor da matrícula"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          </div>
          <p className="text-2xl font-bold">{matriculas}</p>
          <p className="text-xs text-green-600 font-medium mt-1">R$ {fmt(receitaMatriculas)}</p>
          <p className="text-xs text-muted-foreground">R$ {fmt(valorMatricula)} / un</p>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-border">
        {([
          { id: 'kanban', label: 'Kanban' },
          { id: 'metas', label: 'Metas' },
          { id: 'relatorio', label: 'Relatório' },
        ] as { id: ActiveView; label: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeView === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Metas Tab ── */}
      {activeView === 'metas' && (
        <MetaTab lancamento={lancamento} leads={leads} onSave={handleSaveMetas} />
      )}

      {/* ── Relatorio Tab ── */}
      {activeView === 'relatorio' && (
        <RelatorioTab lancamento={lancamento} leads={leads} />
      )}

      {/* ── Kanban Tab ── */}
      {activeView === 'kanban' && (
        <>
          {/* Search and Add */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou WhatsApp..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
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

          {/* Board */}
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-full pb-4">
              {phases.map(phase => (
                <div key={phase.id} className="flex-shrink-0 w-80">
                  <div className="bg-muted rounded-lg p-4 h-full">
                    <div className="sticky top-0 bg-muted pb-3 mb-3 border-b">
                      <h3 className="font-semibold">{phase.label}</h3>
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
                          } hover:shadow-md transition-all`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-medium text-sm flex-1">{lead.nome}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {lead.erro && <AlertCircle className="h-4 w-4 text-red-500" />}
                              <button
                                onClick={() => setLeadToDelete(lead)}
                                className="text-muted-foreground hover:text-red-500 transition-colors"
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
        </>
      )}

      {/* ── Edit Valor Matrícula Modal ── */}
      <Dialog open={editingValor} onOpenChange={setEditingValor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Valor da Matrícula</DialogTitle>
            <DialogDescription>
              Este valor será usado para calcular o faturamento de todas as métricas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                type="number"
                step="0.01"
                value={valorInput}
                onChange={e => setValorInput(e.target.value)}
                className="pl-9"
                placeholder="109.90"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingValor(false)}>Cancelar</Button>
              <Button onClick={handleSaveValor}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Lancamento Modal ── */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar Lançamento</DialogTitle>
            <DialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteLancamento}>Apagar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Lead Modal ── */}
      <Dialog open={!!leadToDelete} onOpenChange={() => setLeadToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar Lead</DialogTitle>
            <DialogDescription>
              Deseja apagar "{leadToDelete?.nome}"? Esta ação não pode ser desfeita.
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
