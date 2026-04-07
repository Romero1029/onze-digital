import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus, Search, Users, DollarSign, Loader2, Power, Trash2,
  Flame, MessageCircle, Pencil, ShoppingBag, Trophy,
  TrendingUp, BarChart3, Target, ArrowLeft, Award, Percent,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type NPAPhase =
  | 'novo' | 'ingresso_pago' | 'no_grupo' | 'confirmado' | 'evento'
  | 'closer' | 'follow_up_01' | 'follow_up_02' | 'follow_up_03' | 'matricula';

type Turma = 'manha' | 'tarde' | 'unica';
type TurmaView = 'todas' | 'manha' | 'tarde' | 'lado_a_lado';
type ActiveView = 'kanban' | 'metas' | 'relatorio';

interface NPAEvento {
  id: string;
  nome: string;
  status: 'em_andamento' | 'finalizado' | 'planejamento';
  ativo: boolean;
  created_at: string;
  valor_ingresso?: number;
  meta_matriculas?: number;
  meta_faturamento?: number;
  meta_presentes?: number;
  meta_ingressos?: number;
}

interface NPALead {
  id: string;
  npa_evento_id: string;
  nome: string;
  whatsapp: string;
  email?: string;
  fase: NPAPhase;
  turma: Turma;
  ingresso_pago: boolean;
  presente_evento: boolean;
  closer: boolean;
  follow_up_01: boolean;
  follow_up_02: boolean;
  follow_up_03: boolean;
  matriculado: boolean;
  comprou_material: boolean;
  valor_ingresso: number;
  valor_matricula: number;
  valor_material: number;
  erro?: string;
  observacoes?: string;
  responsavel_id?: string;
  created_at: string;
}

interface NPAKanbanProps {
  npaEventoId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES: { id: NPAPhase; label: string; color: string }[] = [
  { id: 'novo',          label: 'Novo',          color: 'bg-white' },
  { id: 'ingresso_pago', label: 'Ingresso Pago', color: 'bg-[#f0fdf4]' },
  { id: 'no_grupo',      label: 'No Grupo',      color: 'bg-[#eff6ff]' },
  { id: 'confirmado',    label: 'Confirmado',    color: 'bg-[#fefce8]' },
  { id: 'evento',        label: 'Evento',        color: 'bg-[#faf5ff]' },
  { id: 'closer',        label: 'Closer',        color: 'bg-[#fff7ed]' },
  { id: 'follow_up_01',  label: 'Follow Up 01',  color: 'bg-[#fef2f2]' },
  { id: 'follow_up_02',  label: 'Follow Up 02',  color: 'bg-[#fef2f2]' },
  { id: 'follow_up_03',  label: 'Follow Up 03',  color: 'bg-[#fef2f2]' },
  { id: 'matricula',     label: 'Matrícula ✅',  color: 'bg-[#ecfdf5]' },
];

const TURMA_VIEWS: { id: TurmaView; label: string }[] = [
  { id: 'todas',       label: 'Todas' },
  { id: 'manha',       label: '☀️ Manhã' },
  { id: 'tarde',       label: '🌆 Tarde' },
  { id: 'lado_a_lado', label: '⬛⬛ Lado a Lado' },
];

const VALOR_MATRICULA_PADRAO = 397;
const VALOR_MATERIAL_PADRAO  = 97;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (value: number, total: number) =>
  total === 0 ? 0 : Math.round((value / total) * 100);

// ─── MetaBar ──────────────────────────────────────────────────────────────────

function MetaBar({ label, value, meta, color = '#be123c' }: {
  label: string; value: number; meta: number; color?: string;
}) {
  const progress = meta === 0 ? 0 : Math.min(100, Math.round((value / meta) * 100));
  const achieved = value >= meta && meta > 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 font-medium">{label}</span>
        <span className={`font-bold ${achieved ? 'text-green-600' : 'text-gray-700'}`}>
          {value} / {meta === 0 ? '—' : meta}
          {achieved && ' ✅'}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%`, backgroundColor: achieved ? '#16a34a' : color }}
        />
      </div>
      <p className="text-right text-[10px] text-gray-400">{progress}% da meta</p>
    </div>
  );
}

// ─── LeadCard ─────────────────────────────────────────────────────────────────

interface LeadCardProps {
  lead: NPALead;
  eventoFinalizado: boolean;
  onMove: (leadId: string, phase: NPAPhase) => void;
  onDelete: (lead: NPALead) => void;
  onToggleMaterial: (leadId: string, current: boolean) => void;
}

const LeadCard = memo(({
  lead, eventoFinalizado, onMove, onDelete, onToggleMaterial,
}: LeadCardProps) => {
  return (
    <div className={`p-3 rounded-xl border ${lead.erro ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'} shadow-sm hover:shadow-md transition-all`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-semibold text-sm text-gray-800 leading-tight">{lead.nome}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="p-1 rounded-md text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors"
            onClick={() => window.open(`https://wa.me/${lead.whatsapp}`, '_blank')}
            title="Abrir WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
          {lead.ingresso_pago && (
            <span className="p-1 rounded-md text-orange-400" title="Ingresso pago">
              <Flame className="h-3.5 w-3.5" />
            </span>
          )}
          <button
            onClick={() => onDelete(lead)}
            className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Apagar lead"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-2">{lead.whatsapp}</p>

      {lead.turma !== 'unica' && (
        <div className="mb-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${lead.turma === 'manha' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
            {lead.turma === 'manha' ? '☀️ Manhã' : '🌆 Tarde'}
          </span>
        </div>
      )}

      {/* Toggle comprou material — aparece em qualquer fase mas destaque no evento */}
      <button
        onClick={() => onToggleMaterial(lead.id, lead.comprou_material)}
        disabled={eventoFinalizado}
        title="Comprou material no evento"
        className={`mb-2 w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
          lead.comprou_material
            ? 'bg-purple-50 border-purple-200 text-purple-700'
            : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-purple-200 hover:text-purple-500'
        }`}
      >
        <ShoppingBag className="h-3 w-3 flex-shrink-0" />
        {lead.comprou_material ? 'Material comprado 🛍️' : 'Comprou material?'}
      </button>

      <Select
        key={`${lead.id}-${lead.fase}`}
        value={lead.fase}
        onValueChange={(value) => onMove(lead.id, value as NPAPhase)}
        disabled={eventoFinalizado}
      >
        <SelectTrigger className="h-8 text-xs border-gray-200 rounded-lg bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PHASES.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});
LeadCard.displayName = 'LeadCard';

// ─── MatriculaColumnHeader ─────────────────────────────────────────────────────

function MatriculaColumnHeader({ leads, valorIngressoEvento }: {
  leads: NPALead[];
  valorIngressoEvento: number;
}) {
  const matriculados = leads.filter((l) => l.fase === 'matricula');
  const totalFat = matriculados.reduce(
    (acc, l) => acc + (Number(l.valor_matricula) > 0 ? Number(l.valor_matricula) : VALOR_MATRICULA_PADRAO),
    0,
  );
  const totalMat = matriculados.reduce(
    (acc, l) => acc + (l.comprou_material ? (Number(l.valor_material) > 0 ? Number(l.valor_material) : VALOR_MATERIAL_PADRAO) : 0),
    0,
  );

  if (matriculados.length === 0) return null;

  return (
    <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md">
      <div className="flex items-center gap-1.5 mb-2">
        <Trophy className="h-3.5 w-3.5 text-yellow-300" />
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Faturamento</span>
      </div>
      <p className="text-xl font-black leading-none mb-0.5">{fmt(totalFat + totalMat)}</p>
      <div className="flex flex-col gap-0.5 mt-2 text-[11px] text-emerald-100">
        <span>💰 Matrículas: {fmt(totalFat)}</span>
        <span>🛍️ Materiais: {fmt(totalMat)}</span>
      </div>
    </div>
  );
}

// ─── Relatorio ────────────────────────────────────────────────────────────────

function Relatorio({
  evento,
  leads,
  onClose,
  onSaveMetas,
}: {
  evento: NPAEvento;
  leads: NPALead[];
  onClose: () => void;
  onSaveMetas: (metas: {
    meta_matriculas: number;
    meta_faturamento: number;
    meta_presentes: number;
    meta_ingressos: number;
  }) => Promise<void>;
}) {
  const [editandoMetas, setEditandoMetas] = useState(false);
  const [savingMetas, setSavingMetas] = useState(false);
  const [metaForm, setMetaForm] = useState({
    meta_matriculas: String(evento.meta_matriculas ?? 0),
    meta_faturamento: String(evento.meta_faturamento ?? 0),
    meta_presentes:   String(evento.meta_presentes ?? 0),
    meta_ingressos:   String(evento.meta_ingressos ?? 0),
  });

  // ── métricas reais ──
  const valorIngressoEvento = Number(evento.valor_ingresso) || 10;
  const totalLeads           = leads.length;
  const ingressosPagos       = leads.filter((l) => l.ingresso_pago).length;
  const presentesEvento      = leads.filter((l) => l.presente_evento).length;
  const matriculados         = leads.filter((l) => l.fase === 'matricula');
  const totalMatriculas      = matriculados.length;
  const comprouMaterial      = leads.filter((l) => l.comprou_material).length;

  const receitaIngressos = leads.reduce(
    (acc, l) => acc + (l.ingresso_pago
      ? (Number(l.valor_ingresso) > 0 ? Number(l.valor_ingresso) : valorIngressoEvento)
      : 0),
    0,
  );
  const receitaMatriculas = matriculados.reduce(
    (acc, l) => acc + (Number(l.valor_matricula) > 0 ? Number(l.valor_matricula) : VALOR_MATRICULA_PADRAO),
    0,
  );
  const receitaMateriais = leads
    .filter((l) => l.comprou_material)
    .reduce(
      (acc, l) => acc + (Number(l.valor_material) > 0 ? Number(l.valor_material) : VALOR_MATERIAL_PADRAO),
      0,
    );
  const receitaTotal = receitaIngressos + receitaMatriculas + receitaMateriais;

  // conversões
  const convIngresso  = pct(ingressosPagos, totalLeads);
  const convPresente  = pct(presentesEvento, ingressosPagos);
  const convMatricula = pct(totalMatriculas, presentesEvento);

  // metas
  const mMat  = evento.meta_matriculas  ?? 0;
  const mFat  = evento.meta_faturamento ?? 0;
  const mPres = evento.meta_presentes   ?? 0;
  const mIng  = evento.meta_ingressos   ?? 0;

  const handleSave = async () => {
    setSavingMetas(true);
    await onSaveMetas({
      meta_matriculas:  Number(metaForm.meta_matriculas)  || 0,
      meta_faturamento: Number(metaForm.meta_faturamento) || 0,
      meta_presentes:   Number(metaForm.meta_presentes)   || 0,
      meta_ingressos:   Number(metaForm.meta_ingressos)   || 0,
    });
    setSavingMetas(false);
    setEditandoMetas(false);
  };

  const StatCard = ({ icon, label, value, sub, color = '#be123c' }: {
    icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
  }) => (
    <Card className="p-4 border border-gray-100 shadow-sm rounded-2xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}18` }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Card>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-20 lg:pb-6 overflow-y-auto h-full bg-white">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900">📊 Relatório — {evento.nome}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{evento.status === 'finalizado' ? '✅ Finalizado' : '🚀 Em Andamento'}</p>
          </div>
        </div>
        <button
          onClick={() => setEditandoMetas(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Definir Metas
        </button>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Users className="h-4 w-4" />}     label="Total de Leads"    value={String(totalLeads)}    color="#6366f1" />
        <StatCard icon={<Flame className="h-4 w-4" />}     label="Ingressos Pagos"   value={String(ingressosPagos)} sub={fmt(receitaIngressos)} color="#f97316" />
        <StatCard icon={<Target className="h-4 w-4" />}    label="Presentes"         value={String(presentesEvento)} color="#8b5cf6" />
        <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Compraram Material" value={String(comprouMaterial)} sub={fmt(receitaMateriais)} color="#ec4899" />
        <StatCard icon={<Trophy className="h-4 w-4" />}    label="Matrículas"        value={String(totalMatriculas)} sub={fmt(receitaMatriculas)} color="#16a34a" />
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Faturamento Total" value={fmt(receitaTotal)} color="#be123c" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Ticket Médio Mat." value={totalMatriculas > 0 ? fmt(receitaMatriculas / totalMatriculas) : 'R$ 0'} color="#0ea5e9" />
        <StatCard icon={<Percent className="h-4 w-4" />}   label="Conv. → Matrícula" value={`${convMatricula}%`} sub="dos presentes" color="#f59e0b" />
      </div>

      {/* Funil de conversão */}
      <Card className="p-5 border border-gray-100 shadow-sm rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-[#be123c]" />
          <h2 className="font-black text-sm text-gray-800">Funil de Conversão</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Leads → Ingresso Pago', value: ingressosPagos, total: totalLeads,       color: '#f97316' },
            { label: 'Ingresso → Presente',   value: presentesEvento, total: ingressosPagos,  color: '#8b5cf6' },
            { label: 'Presente → Matrícula',  value: totalMatriculas, total: presentesEvento, color: '#16a34a' },
            { label: 'Presente → Material',   value: comprouMaterial, total: presentesEvento, color: '#ec4899' },
          ].map(({ label, value, total, color }) => {
            const p = pct(value, total);
            return (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 font-medium">{label}</span>
                  <span className="font-bold text-gray-800">{value}/{total} <span className="text-gray-400">({p}%)</span></span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${p}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Metas vs Realizado */}
      <Card className="p-5 border border-gray-100 shadow-sm rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[#be123c]" />
            <h2 className="font-black text-sm text-gray-800">Metas vs Realizado</h2>
          </div>
          {(mMat === 0 && mFat === 0 && mPres === 0 && mIng === 0) && (
            <button
              onClick={() => setEditandoMetas(true)}
              className="text-xs text-[#be123c] font-semibold hover:underline"
            >
              + Definir metas
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MetaBar label="Ingressos Pagos"   value={ingressosPagos}  meta={mIng}  color="#f97316" />
          <MetaBar label="Presentes"         value={presentesEvento} meta={mPres} color="#8b5cf6" />
          <MetaBar label="Matrículas"        value={totalMatriculas} meta={mMat}  color="#16a34a" />
          <MetaBar
            label="Faturamento Total"
            value={Math.round(receitaTotal)}
            meta={mFat}
            color="#be123c"
          />
        </div>
      </Card>

      {/* Lista de matriculados */}
      <Card className="p-5 border border-gray-100 shadow-sm rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-green-600" />
          <h2 className="font-black text-sm text-gray-800">Matriculados ({totalMatriculas})</h2>
        </div>
        {matriculados.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma matrícula ainda.</p>
        ) : (
          <div className="space-y-2">
            {matriculados.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-100">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{l.nome}</p>
                  <p className="text-xs text-gray-400">{l.whatsapp}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-700">
                    {fmt(Number(l.valor_matricula) > 0 ? Number(l.valor_matricula) : VALOR_MATRICULA_PADRAO)}
                  </p>
                  {l.comprou_material && (
                    <span className="text-[10px] text-purple-600 font-medium">+ material 🛍️</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal de metas */}
      {editandoMetas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-black text-gray-900 mb-1">🎯 Definir Metas</h2>
            <p className="text-sm text-gray-500 mb-4">Configure as metas para este NPA.</p>
            <div className="space-y-3">
              {[
                { label: 'Meta de Ingressos',     key: 'meta_ingressos',   placeholder: 'Ex: 50' },
                { label: 'Meta de Presentes',     key: 'meta_presentes',   placeholder: 'Ex: 40' },
                { label: 'Meta de Matrículas',    key: 'meta_matriculas',  placeholder: 'Ex: 10' },
                { label: 'Meta de Faturamento (R$)', key: 'meta_faturamento', placeholder: 'Ex: 5000' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                  <Input
                    type="number"
                    placeholder={placeholder}
                    value={metaForm[key as keyof typeof metaForm]}
                    onChange={(e) => setMetaForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <Button variant="outline" onClick={() => setEditandoMetas(false)} className="rounded-xl">Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={savingMetas}
                className="bg-[#be123c] hover:bg-[#9f1239] text-white rounded-xl font-semibold"
              >
                {savingMetas && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MetaTab ──────────────────────────────────────────────────────────────────

function MetaTab({
  evento,
  leads,
  onClose,
  onSaveMetas,
}: {
  evento: NPAEvento;
  leads: NPALead[];
  onClose: () => void;
  onSaveMetas: (metas: {
    meta_matriculas: number;
    meta_faturamento: number;
    meta_presentes: number;
    meta_ingressos: number;
  }) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [metaForm, setMetaForm] = useState({
    meta_matriculas:  String(evento.meta_matriculas  ?? 0),
    meta_faturamento: String(evento.meta_faturamento ?? 0),
    meta_presentes:   String(evento.meta_presentes   ?? 0),
    meta_ingressos:   String(evento.meta_ingressos   ?? 0),
  });

  // métricas reais
  const valorIngressoEvento = Number(evento.valor_ingresso) || 10;
  const ingressosPagos  = leads.filter((l) => l.ingresso_pago).length;
  const presentesEvento = leads.filter((l) => l.presente_evento).length;
  const matriculados    = leads.filter((l) => l.fase === 'matricula');
  const totalMatriculas = matriculados.length;
  const materialNoDia   = leads.filter((l) => l.presente_evento && l.comprou_material).length;

  const receitaIngressos  = leads.reduce((acc, l) =>
    acc + (l.ingresso_pago ? (Number(l.valor_ingresso) > 0 ? Number(l.valor_ingresso) : valorIngressoEvento) : 0), 0);
  const receitaMatriculas = matriculados.reduce((acc, l) =>
    acc + (Number(l.valor_matricula) > 0 ? Number(l.valor_matricula) : VALOR_MATRICULA_PADRAO), 0);
  const receitaMateriais  = leads.filter((l) => l.comprou_material).reduce((acc, l) =>
    acc + (Number(l.valor_material) > 0 ? Number(l.valor_material) : VALOR_MATERIAL_PADRAO), 0);
  const receitaTotal = receitaIngressos + receitaMatriculas + receitaMateriais;

  const mMat  = evento.meta_matriculas  ?? 0;
  const mFat  = evento.meta_faturamento ?? 0;
  const mPres = evento.meta_presentes   ?? 0;
  const mIng  = evento.meta_ingressos   ?? 0;

  const handleSave = async () => {
    setSaving(true);
    await onSaveMetas({
      meta_matriculas:  Number(metaForm.meta_matriculas)  || 0,
      meta_faturamento: Number(metaForm.meta_faturamento) || 0,
      meta_presentes:   Number(metaForm.meta_presentes)   || 0,
      meta_ingressos:   Number(metaForm.meta_ingressos)   || 0,
    });
    setSaving(false);
  };

  const metaFields = [
    { label: 'Meta de Ingressos',        key: 'meta_ingressos',   placeholder: 'Ex: 50',    icon: <Flame className="h-4 w-4" />,    color: '#f97316' },
    { label: 'Meta de Presentes',        key: 'meta_presentes',   placeholder: 'Ex: 40',    icon: <Target className="h-4 w-4" />,   color: '#8b5cf6' },
    { label: 'Meta de Matrículas',       key: 'meta_matriculas',  placeholder: 'Ex: 10',    icon: <Trophy className="h-4 w-4" />,   color: '#16a34a' },
    { label: 'Meta de Faturamento (R$)', key: 'meta_faturamento', placeholder: 'Ex: 5000',  icon: <DollarSign className="h-4 w-4" />, color: '#be123c' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-20 lg:pb-6 overflow-y-auto h-full bg-white">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-gray-900">🎯 Metas — {evento.nome}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Defina e acompanhe as metas do lançamento</p>
        </div>
      </div>

      {/* Formulário de metas */}
      <Card className="p-5 border border-gray-100 shadow-sm rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4 text-[#be123c]" />
          <h2 className="font-black text-sm text-gray-800">Definir Metas</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {metaFields.map(({ label, key, placeholder, icon, color }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <span style={{ color }}>{icon}</span>
                {label}
              </label>
              <Input
                type="number"
                placeholder={placeholder}
                value={metaForm[key as keyof typeof metaForm]}
                onChange={(e) => setMetaForm((prev) => ({ ...prev, [key]: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#be123c] hover:bg-[#9f1239] text-white rounded-xl font-semibold px-6"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Metas
          </Button>
        </div>
      </Card>

      {/* Meta vs Realidade */}
      <Card className="p-5 border border-gray-100 shadow-sm rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-4 w-4 text-[#be123c]" />
          <h2 className="font-black text-sm text-gray-800">Meta vs Realidade</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MetaBar label="Ingressos Pagos"   value={ingressosPagos}  meta={mIng}  color="#f97316" />
          <MetaBar label="Presentes"         value={presentesEvento} meta={mPres} color="#8b5cf6" />
          <MetaBar label="Matrículas"        value={totalMatriculas} meta={mMat}  color="#16a34a" />
          <MetaBar label="Faturamento Total" value={Math.round(receitaTotal)} meta={mFat} color="#be123c" />
        </div>
      </Card>

      {/* Resumo rápido */}
      <Card className="p-5 border border-gray-100 shadow-sm rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-[#be123c]" />
          <h2 className="font-black text-sm text-gray-800">Resumo do Lançamento</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Ingressos',        value: String(ingressosPagos),    sub: fmt(receitaIngressos),   color: '#f97316' },
            { label: 'Presentes',        value: String(presentesEvento),   sub: `${pct(presentesEvento, ingressosPagos)}% dos ingressos`, color: '#8b5cf6' },
            { label: 'Material Evento',  value: String(materialNoDia),     sub: `${pct(materialNoDia, presentesEvento)}% dos presentes`,  color: '#ec4899' },
            { label: 'Matrículas',       value: String(totalMatriculas),   sub: fmt(receitaMatriculas),  color: '#16a34a' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
              <p className="text-xl font-black" style={{ color }}>{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-rose-50 to-red-50 border border-rose-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#be123c]" />
              <span className="text-sm font-bold text-gray-800">Faturamento Total</span>
            </div>
            <span className="text-xl font-black text-[#be123c]">{fmt(receitaTotal)}</span>
          </div>
          {mFat > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {pct(Math.round(receitaTotal), mFat)}% da meta de {fmt(mFat)}
            </p>
          )}
        </div>
      </Card>

    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function NPAKanban({ npaEventoId }: NPAKanbanProps) {
  const [evento, setEvento]                     = useState<NPAEvento | null>(null);
  const [leads, setLeads]                       = useState<NPALead[]>([]);
  const [searchWhatsapp, setSearchWhatsapp]     = useState('');
  const [loading, setLoading]                   = useState(true);
  const [isAddingLead, setIsAddingLead]         = useState(false);
  const [turmaView, setTurmaView]               = useState<TurmaView>('todas');
  const [activeView, setActiveView]             = useState<ActiveView>('kanban');
  const [newLeadForm, setNewLeadForm]           = useState({ nome: '', whatsapp: '', email: '', turma: 'unica' as Turma });
  const [showDeleteModal, setShowDeleteModal]   = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [leadToDelete, setLeadToDelete]         = useState<NPALead | null>(null);
  const [showEditIngressoModal, setShowEditIngressoModal] = useState(false);
  const [novoValorIngresso, setNovoValorIngresso]         = useState('');
  const [savingIngresso, setSavingIngresso]               = useState(false);

  // ── FIX: pendingUpdates guard contra Realtime sobrescrever optimistic ──────
  const pendingUpdates = useRef<Map<string, NPAPhase>>(new Map());
  const leadsRef       = useRef<NPALead[]>([]);
  useEffect(() => { leadsRef.current = leads; }, [leads]);

  // ── Load evento ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!npaEventoId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('npa_eventos')
        .select('*')
        .eq('id', npaEventoId)
        .single();
      if (error) { toast.error('Erro ao carregar NPA'); setLoading(false); return; }
      setEvento(data as NPAEvento);
      setLoading(false);
    })();
  }, [npaEventoId]);

  // ── Load leads ────────────────────────────────────────────────────────────
  const loadLeads = useCallback(async () => {
    const { data } = await supabase
      .from('npa_evento_leads')
      .select('*')
      .eq('npa_evento_id', npaEventoId)
      .order('created_at', { ascending: false });
    if (!data) return;
    setLeads(
      (data as NPALead[]).map((lead) => {
        const pending = pendingUpdates.current.get(lead.id);
        return pending ? { ...lead, fase: pending } : lead;
      }),
    );
  }, [npaEventoId]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!npaEventoId) return;
    loadLeads();

    const channel = supabase
      .channel(`npa-leads-${npaEventoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'npa_evento_leads', filter: `npa_evento_id=eq.${npaEventoId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as NPALead)?.id;
            if (deletedId) setLeads((prev) => prev.filter((l) => l.id !== deletedId));
            return;
          }

          const updatedLead = payload.new as NPALead;
          if (!updatedLead?.id) return;

          if (payload.eventType === 'INSERT') {
            setLeads((prev) => {
              if (prev.some((l) => l.id === updatedLead.id)) return prev; // evita duplicata
              return [updatedLead, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setLeads((prev) => prev.map((l) => {
              if (l.id !== updatedLead.id) return l;
              // Se há fase pendente, ignora a fase do evento Realtime
              // (o estado correto já foi aplicado pelo handleMoveLead via .select())
              const expectedPhase = pendingUpdates.current.get(updatedLead.id);
              if (expectedPhase !== undefined) {
                return { ...updatedLead, fase: expectedPhase };
              }
              return updatedLead;
            }));
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [npaEventoId, loadLeads]);

  // ── Toggle ativo ──────────────────────────────────────────────────────────
  const handleToggleActive = async () => {
    if (!evento) return;
    const novoAtivo  = !evento.ativo;
    const novoStatus = novoAtivo ? 'em_andamento' : 'finalizado';
    const eventoAnt  = evento;
    setEvento({ ...evento, ativo: novoAtivo, status: novoStatus });
    try {
      if (novoAtivo) await supabase.from('npa_eventos').update({ ativo: false }).neq('id', npaEventoId);
      const { error } = await supabase.from('npa_eventos').update({ ativo: novoAtivo, status: novoStatus }).eq('id', npaEventoId);
      if (error) { setEvento(eventoAnt); toast.error(`Erro: ${error.message}`); return; }
      toast.success(`NPA ${novoAtivo ? 'ativado' : 'desativado'}!`);
    } catch { setEvento(eventoAnt); toast.error('Erro inesperado.'); }
  };

  // ── Delete evento ─────────────────────────────────────────────────────────
  const handleDeleteEvento = async () => {
    const { error } = await supabase.from('npa_eventos').delete().eq('id', npaEventoId);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    toast.success('NPA apagado!');
    setShowDeleteModal(false);
    window.location.reload();
  };

  // ── Delete lead ───────────────────────────────────────────────────────────
  const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    const { error } = await supabase.from('npa_evento_leads').delete().eq('id', leadToDelete.id);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    setLeads((prev) => prev.filter((l) => l.id !== leadToDelete.id));
    toast.success('Lead apagado!');
    setLeadToDelete(null);
  };

  // ── Move lead — FIX DEFINITIVO ───────────────────────────────────────────
  const handleMoveLead = useCallback(async (leadId: string, newPhase: NPAPhase) => {
    const previousLeads = leadsRef.current;

    // 1. Bloqueia Realtime para esse lead enquanto fazemos a mudança
    pendingUpdates.current.set(leadId, newPhase);

    // 2. Optimistic update imediato
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, fase: newPhase } : l)));

    // 3. Salva no banco E pede retorno confirmado com .select()
    const { data: updated, error } = await supabase
      .from('npa_evento_leads')
      .update({ fase: newPhase, ultima_atividade: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .select('*')
      .single();

    if (error || !updated) {
      // Banco recusou — reverte
      pendingUpdates.current.delete(leadId);
      toast.error('Erro ao mover lead' + (error ? ': ' + error.message : ' (sem retorno)'));
      setLeads(previousLeads);
      return;
    }

    // 4. Aplica o estado confirmado pelo banco (fonte da verdade)
    const confirmedFase = updated.fase as NPAPhase;
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...(updated as NPALead), fase: confirmedFase } : l));

    if (confirmedFase !== newPhase) {
      toast.warning(`Lead movido para "${confirmedFase}" pelo banco (diferente do esperado)`);
    }

    // 5. Mantém o guard por 5s para ignorar eventos Realtime atrasados
    setTimeout(() => {
      pendingUpdates.current.delete(leadId);
    }, 5000);
  }, []);

  // ── Toggle material ───────────────────────────────────────────────────────
  const handleToggleMaterial = useCallback(async (leadId: string, current: boolean) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, comprou_material: !current } : l));
    const { error } = await supabase
      .from('npa_evento_leads')
      .update({ comprou_material: !current, updated_at: new Date().toISOString() })
      .eq('id', leadId);
    if (error) {
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, comprou_material: current } : l));
      toast.error('Erro ao atualizar material');
    }
  }, []);

  // ── Add lead ──────────────────────────────────────────────────────────────
  const handleAddLead = async () => {
    if (!newLeadForm.nome.trim() || !newLeadForm.whatsapp.trim()) return;
    setIsAddingLead(true);
    try {
      const { error } = await supabase.from('npa_evento_leads').insert({
        npa_evento_id: npaEventoId,
        nome: newLeadForm.nome,
        whatsapp: newLeadForm.whatsapp,
        email: newLeadForm.email || null,
        fase: 'novo',
        turma: newLeadForm.turma,
        ingresso_pago: false,
        presente_evento: false,
        closer: false,
        follow_up_01: false,
        follow_up_02: false,
        follow_up_03: false,
        matriculado: false,
        comprou_material: false,
      });
      if (error) { toast.error(`Erro: ${error.message}`); return; }
      toast.success('Lead adicionado!');
      setNewLeadForm({ nome: '', whatsapp: '', email: '', turma: 'unica' });
      setShowAddLeadModal(false);
      // NÃO chama loadLeads() — o Realtime INSERT cuida disso sem duplicar
    } catch { toast.error('Erro inesperado.'); }
    finally { setIsAddingLead(false); }
  };

  // ── Salvar valor ingresso ─────────────────────────────────────────────────
  const handleSaveValorIngresso = async () => {
    const valor = parseFloat(novoValorIngresso.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) { toast.error('Valor inválido'); return; }
    setSavingIngresso(true);
    const { error } = await supabase.from('npa_eventos').update({ valor_ingresso: valor }).eq('id', npaEventoId);
    if (error) { toast.error('Erro: ' + error.message); }
    else {
      toast.success('Valor do ingresso atualizado!');
      setShowEditIngressoModal(false);
      setEvento((prev) => prev ? { ...prev, valor_ingresso: valor } : prev);
    }
    setSavingIngresso(false);
  };

  // ── Salvar metas ──────────────────────────────────────────────────────────
  const handleSaveMetas = async (metas: {
    meta_matriculas: number; meta_faturamento: number;
    meta_presentes: number;  meta_ingressos: number;
  }) => {
    const { error } = await supabase.from('npa_eventos').update(metas).eq('id', npaEventoId);
    if (error) { toast.error('Erro ao salvar metas'); return; }
    toast.success('Metas salvas!');
    setEvento((prev) => prev ? { ...prev, ...metas } : prev);
  };

  // ── Filtro de leads ───────────────────────────────────────────────────────
  const getFilteredLeads = useCallback((turmaFilter?: 'manha' | 'tarde') => {
    let result = leads;
    if (turmaFilter) {
      result = result.filter((l) => l.turma === turmaFilter);
    } else if (turmaView === 'manha') {
      result = result.filter((l) => l.turma === 'manha');
    } else if (turmaView === 'tarde') {
      result = result.filter((l) => l.turma === 'tarde');
    }
    if (searchWhatsapp) {
      result = result.filter((l) => l.whatsapp.toLowerCase().includes(searchWhatsapp.toLowerCase()));
    }
    return result;
  }, [leads, turmaView, searchWhatsapp]);

  // ── Métricas do header ────────────────────────────────────────────────────
  const valorIngressoEvento = Number(evento?.valor_ingresso) || 10;
  const totalLeads           = leads.length;
  const ingressosPagos       = leads.filter((l) => l.ingresso_pago).length;
  const presentesEvento      = leads.filter((l) => l.presente_evento).length;
  const matriculas           = leads.filter((l) => l.fase === 'matricula').length;
  const comprouMaterial      = leads.filter((l) => l.comprou_material).length;
  const materialNoDia        = leads.filter((l) => l.presente_evento && l.comprou_material).length;
  const receitaIngressos     = leads.reduce((acc, l) =>
    acc + (l.ingresso_pago ? (Number(l.valor_ingresso) > 0 ? Number(l.valor_ingresso) : valorIngressoEvento) : 0), 0);
  const receitaMatriculas    = leads
    .filter((l) => l.fase === 'matricula')
    .reduce((acc, l) => acc + (Number(l.valor_matricula) > 0 ? Number(l.valor_matricula) : VALOR_MATRICULA_PADRAO), 0);
  const receitaMateriais     = leads
    .filter((l) => l.comprou_material)
    .reduce((acc, l) => acc + (Number(l.valor_material) > 0 ? Number(l.valor_material) : VALOR_MATERIAL_PADRAO), 0);

  // ── Render kanban ─────────────────────────────────────────────────────────
  const renderKanban = (turmaFilter?: 'manha' | 'tarde', showTitle?: boolean) => {
    const filteredLeads = getFilteredLeads(turmaFilter);
    return (
      <div className="space-y-3">
        {showTitle && (
          <h3 className="font-semibold text-base text-gray-700 flex items-center gap-2">
            {turmaFilter === 'manha' ? '☀️ Turma Manhã' : '🌆 Turma Tarde'}
            <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {filteredLeads.length} leads
            </span>
          </h3>
        )}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {PHASES.map((phase) => {
              const phaseLeads = filteredLeads.filter((l) => l.fase === phase.id);
              return (
                <div key={phase.id} className="flex-shrink-0 w-[260px]">
                  <div className={`${phase.color} rounded-2xl border border-gray-100 p-3 h-full min-h-[120px]`}>
                    <div className="mb-3">
                      <h3 className="font-bold text-sm text-gray-700">{phase.label}</h3>
                      <span className="inline-block mt-1 text-xs font-semibold text-gray-500 bg-white/70 border border-gray-200 rounded-full px-2 py-0.5">
                        {phaseLeads.length}
                      </span>
                    </div>

                    {/* Card de faturamento — só na coluna matrícula */}
                    {phase.id === 'matricula' && (
                      <MatriculaColumnHeader leads={leads} valorIngressoEvento={valorIngressoEvento} />
                    )}

                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
                      {phaseLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          eventoFinalizado={evento?.status === 'finalizado'}
                          onMove={handleMoveLead}
                          onDelete={setLeadToDelete}
                          onToggleMaterial={handleToggleMaterial}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || !evento) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Metas view ────────────────────────────────────────────────────────────
  if (activeView === 'metas') {
    return (
      <MetaTab
        evento={evento}
        leads={leads}
        onClose={() => setActiveView('kanban')}
        onSaveMetas={handleSaveMetas}
      />
    );
  }

  // ── Relatório view ────────────────────────────────────────────────────────
  if (activeView === 'relatorio') {
    return (
      <Relatorio
        evento={evento}
        leads={leads}
        onClose={() => setActiveView('kanban')}
        onSaveMetas={handleSaveMetas}
      />
    );
  }

  // ── Kanban view ───────────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 space-y-5 pb-20 lg:pb-6 overflow-y-auto h-full bg-white">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{evento.nome}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {evento.status === 'finalizado' ? '✅ Finalizado' : '🚀 Em Andamento'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botão Metas */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveView('metas')}
            className="gap-1.5 border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
          >
            <Target className="h-3.5 w-3.5" />
            Metas
          </Button>
          {/* Botão Relatório */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveView('relatorio')}
            className="gap-1.5 border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Relatório
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Apagar
          </Button>
          <button
            onClick={handleToggleActive}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all text-white shadow-sm ${
              evento.ativo ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {evento.ativo ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card className="p-4 border border-gray-100 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Total de Leads</p>
            <Users className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
        </Card>

        <Card className="p-4 border border-gray-100 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Ingressos Pagos</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setNovoValorIngresso((evento?.valor_ingresso ?? 10).toString()); setShowEditIngressoModal(true); }}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="Editar valor"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{ingressosPagos}</p>
          <p className="text-xs text-gray-400">{fmt(receitaIngressos)}</p>
        </Card>

        <Card className="p-4 border border-gray-100 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Presentes no Evento</p>
            <Target className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{presentesEvento}</p>
        </Card>

        <Card className="p-4 border border-gray-100 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Compraram Material</p>
            <ShoppingBag className="h-4 w-4 text-pink-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{comprouMaterial}</p>
          <p className="text-xs text-gray-400">{fmt(receitaMateriais)}</p>
        </Card>

        <Card className="p-4 border border-gray-100 shadow-sm rounded-xl bg-purple-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-purple-600 font-medium">Material no Evento</p>
            <ShoppingBag className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-700">{materialNoDia}</p>
          <p className="text-xs text-purple-400">presentes que compraram</p>
        </Card>

        <Card className="p-4 border border-gray-100 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Matrículas</p>
            <Trophy className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{matriculas}</p>
          <p className="text-xs text-gray-400">{fmt(receitaMatriculas)}</p>
        </Card>
      </div>

      {/* Modal editar ingresso */}
      {showEditIngressoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Valor do Ingresso</h2>
            <p className="text-sm text-gray-500 mb-4">Novo valor do ingresso para este evento.</p>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-500 font-medium">R$</span>
              <Input
                type="number" step="0.01" min="0"
                value={novoValorIngresso}
                onChange={(e) => setNovoValorIngresso(e.target.value)}
                placeholder="10,00" className="flex-1" autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEditIngressoModal(false)}>Cancelar</Button>
              <Button onClick={handleSaveValorIngresso} disabled={savingIngresso}>
                {savingIngresso && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de busca + filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Buscar por WhatsApp..."
            value={searchWhatsapp}
            onChange={(e) => setSearchWhatsapp(e.target.value)}
            className="pl-9 rounded-xl border-gray-200 bg-white text-sm"
          />
        </div>

        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
          {TURMA_VIEWS.map((view) => (
            <button
              key={view.id}
              onClick={() => setTurmaView(view.id)}
              className={`px-3 py-2 text-xs font-medium transition-all border-r border-gray-200 last:border-r-0 ${
                turmaView === view.id ? 'bg-[#be123c] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>

        <Dialog open={showAddLeadModal} onOpenChange={setShowAddLeadModal}>
          <DialogTrigger asChild>
            <Button
              disabled={evento.status === 'finalizado'}
              className="gap-1.5 bg-[#be123c] hover:bg-[#9f1239] text-white font-semibold rounded-xl shadow-sm px-4"
            >
              <Plus className="h-4 w-4" />
              Adicionar Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar Lead</DialogTitle>
              <DialogDescription>Adicione um novo lead ao NPA</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <Input placeholder="Nome" value={newLeadForm.nome} onChange={(e) => setNewLeadForm({ ...newLeadForm, nome: e.target.value })} className="rounded-xl" />
              <Input placeholder="WhatsApp" value={newLeadForm.whatsapp} onChange={(e) => setNewLeadForm({ ...newLeadForm, whatsapp: e.target.value })} className="rounded-xl" />
              <Input placeholder="Email (opcional)" value={newLeadForm.email} onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })} className="rounded-xl" />
              <Select value={newLeadForm.turma} onValueChange={(v) => setNewLeadForm({ ...newLeadForm, turma: v as Turma })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Turma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unica">Turma Única</SelectItem>
                  <SelectItem value="manha">☀️ Manhã</SelectItem>
                  <SelectItem value="tarde">🌆 Tarde</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddLead} disabled={isAddingLead} className="w-full bg-[#be123c] hover:bg-[#9f1239] text-white rounded-xl font-semibold">
                {isAddingLead ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban */}
      {turmaView === 'lado_a_lado' ? (
        <div className="space-y-8">
          {renderKanban('manha', true)}
          <div className="border-t border-gray-100 pt-6">
            {renderKanban('tarde', true)}
          </div>
        </div>
      ) : renderKanban()}

      {/* Modal delete NPA */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Apagar NPA</DialogTitle>
            <DialogDescription>Tem certeza? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="rounded-xl">Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteEvento} className="rounded-xl">Apagar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal delete lead */}
      <Dialog open={!!leadToDelete} onOpenChange={() => setLeadToDelete(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Apagar Lead</DialogTitle>
            <DialogDescription>Deseja apagar o lead "{leadToDelete?.nome}"?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setLeadToDelete(null)} className="rounded-xl">Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteLead} className="rounded-xl">Apagar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
