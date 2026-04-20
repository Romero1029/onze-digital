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
import { useKanbanColunas } from './kanban/useKanbanColunas';
import type { KanbanColuna } from './kanban/useKanbanColunas';
import {
  KanbanColunaHeader, AddColunaButton,
  RenameColunaModal, ColunaSettingsModal, DeleteColunaModal,
} from './kanban/KanbanColunasUI';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveView = 'kanban' | 'metas' | 'relatorio' | 'trafego';

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
  meta_campaign_id?: string;
  meta_ad_account_id?: string;
  meta_access_token?: string;
}

interface LaunchLead {
  id: string;
  lancamento_id: string;
  nome: string;
  whatsapp: string;
  email?: string;
  fase: string; // UUID of kanban_colunas.id
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

// Normalize column name for fuzzy matching
function normColName(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_').trim();
}

// Derive boolean flag payload from a column's nome (handles custom names too)
function getPhasePayloadByColName(nome: string): Record<string, boolean> {
  const n = normColName(nome);
  if (n === 'planilha')
    return { no_grupo: false, grupo_oferta: false, follow_up_01: false, follow_up_02: false, follow_up_03: false, matriculado: false };
  if (n.includes('grupo') && (n.includes('lancamento') || n.includes('lançamento')))
    return { no_grupo: true, grupo_oferta: false, follow_up_01: false, follow_up_02: false, follow_up_03: false, matriculado: false };
  if (n.includes('grupo') && n.includes('oferta'))
    return { grupo_oferta: true, follow_up_01: false, follow_up_02: false, follow_up_03: false, matriculado: false };
  if (n.includes('follow') && n.includes('01'))
    return { follow_up_01: true, follow_up_02: false, follow_up_03: false, matriculado: false };
  if (n.includes('follow') && n.includes('02'))
    return { follow_up_02: true, follow_up_03: false, matriculado: false };
  if (n.includes('follow') && n.includes('03'))
    return { follow_up_03: true, matriculado: false };
  if (n.includes('matricul'))
    return { matriculado: true };
  return {}; // Custom column — no boolean side-effects
}

// Map legacy string fase values → column UUID
const LEGACY_FASE_NAMES: Record<string, string> = {
  planilha:          'planilha',
  grupo_lancamento:  'grupo lancamento',
  grupo_oferta:      'grupo oferta',
  follow_up_01:      'follow up 01',
  follow_up_02:      'follow up 02',
  follow_up_03:      'follow up 03',
  matricula:         'matricula',
};

function resolveLegacyFase(fase: string, colunas: KanbanColuna[]): string {
  const target = normColName(LEGACY_FASE_NAMES[fase] ?? fase.replace(/_/g, ' '));
  const col = colunas.find(c => normColName(c.nome) === target || normColName(c.nome).includes(target));
  return col?.id ?? colunas[0].id;
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

// ─── TrafegoTab ───────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'this_month', label: 'Este mês' },
];

interface MetaInsights {
  spend: string;
  impressions: string;
  reach: string;
  clicks: string;
  cpm: string;
  cpc: string;
  ctr: string;
  leads: number;
  cpl: number;
}

function TrafegoTab({ lancamento, leads: crmLeads, onSaveMeta }: {
  lancamento: Launch;
  leads: LaunchLead[];
  onSaveMeta: (data: { meta_campaign_id: string; meta_ad_account_id: string; meta_access_token: string }) => Promise<void>;
}) {
  const [config, setConfig] = useState({
    meta_campaign_id: lancamento.meta_campaign_id || '',
    meta_ad_account_id: lancamento.meta_ad_account_id || '',
    meta_access_token: lancamento.meta_access_token || '',
  });
  const [editingConfig, setEditingConfig] = useState(!lancamento.meta_campaign_id);
  const [datePreset, setDatePreset] = useState('this_month');
  const [insights, setInsights] = useState<MetaInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [usdToBrl, setUsdToBrl] = useState<number>(1);
  const [usdCurrency, setUsdCurrency] = useState(false);

  useEffect(() => {
    fetch('https://economia.awesomeapi.com.br/last/USD-BRL')
      .then(r => r.json())
      .then(d => { const rate = parseFloat(d.USDBRL?.bid); if (rate) setUsdToBrl(rate); })
      .catch(() => {});
  }, []);

  const fetchInsights = async () => {
    if (!lancamento.meta_campaign_id || !lancamento.meta_access_token) return;
    setLoading(true);
    setError(null);
    try {
      const fields = 'spend,impressions,reach,clicks,cpm,cpc,ctr,actions';
      const url = `https://graph.facebook.com/v19.0/${lancamento.meta_campaign_id}/insights?fields=${fields}&date_preset=${datePreset}&access_token=${lancamento.meta_access_token}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) { setError(json.error.message); return; }
      const d = json.data?.[0];
      if (!d) { setInsights(null); return; }
      const leadAction = d.actions?.find((a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped');
      const leads = leadAction ? parseFloat(leadAction.value) : 0;
      const spend = parseFloat(d.spend || '0');
      setUsdCurrency(json.data?.[0]?.account_currency === 'USD' || true);
      setInsights({
        spend: d.spend || '0',
        impressions: d.impressions || '0',
        reach: d.reach || '0',
        clicks: d.clicks || '0',
        cpm: d.cpm || '0',
        cpc: d.cpc || '0',
        ctr: d.ctr || '0',
        leads,
        cpl: leads > 0 ? spend / leads : 0,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lancamento.meta_campaign_id && lancamento.meta_access_token) fetchInsights();
  }, [lancamento.meta_campaign_id, lancamento.meta_access_token, datePreset]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    await onSaveMeta(config);
    setEditingConfig(false);
    setSavingConfig(false);
  };

  const conv = (v: number) => usdCurrency ? v * usdToBrl : v;
  const fmt = (v: number) => conv(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (v: string) => parseInt(v).toLocaleString('pt-BR');

  const configured = !!lancamento.meta_campaign_id && !!lancamento.meta_access_token;

  return (
    <div className="p-6 space-y-6">
      {/* Config */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" /> Gestão de Tráfego — Meta Ads
        </h3>
        <button onClick={() => setEditingConfig(e => !e)} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Pencil className="h-3 w-3" /> {editingConfig ? 'Cancelar' : 'Configurar campanha'}
        </button>
      </div>

      {editingConfig && (
        <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Vincule a campanha do Meta Ads desta turma:</p>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">ID da Campanha</label>
              <Input placeholder="ex: 120202XXXXXXXXX" value={config.meta_campaign_id} onChange={e => setConfig(c => ({ ...c, meta_campaign_id: e.target.value }))} className="mt-1 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">Gerenciador de Anúncios → campanha → número na URL</p>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">ID da Conta de Anúncios</label>
              <Input placeholder="ex: act_XXXXXXXXXX" value={config.meta_ad_account_id} onChange={e => setConfig(c => ({ ...c, meta_ad_account_id: e.target.value }))} className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Token de Acesso</label>
              <Input type="password" placeholder="Token do Usuário do Sistema Meta" value={config.meta_access_token} onChange={e => setConfig(c => ({ ...c, meta_access_token: e.target.value }))} className="mt-1 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">Business Manager → Configurações → Usuários do Sistema → Gerar token (permissão: ads_read)</p>
            </div>
          </div>
          <Button onClick={handleSaveConfig} disabled={savingConfig} size="sm" className="bg-primary hover:bg-primary/90 text-white">
            {savingConfig ? 'Salvando...' : 'Salvar configuração'}
          </Button>
        </div>
      )}

      {!configured && !editingConfig && (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma campanha vinculada.</p>
          <button onClick={() => setEditingConfig(true)} className="text-primary text-sm hover:underline mt-1">Configurar agora</button>
        </div>
      )}

      {configured && !editingConfig && (
        <>
          {/* Seletor de período */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Período:</span>
            <div className="flex gap-1">
              {DATE_PRESETS.map(p => (
                <button key={p.value} onClick={() => setDatePreset(p.value)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${datePreset === p.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                  {p.label}
                </button>
              ))}
              <button onClick={fetchInsights} className="px-3 py-1 rounded text-xs bg-muted text-muted-foreground hover:bg-muted/70 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Atualizar
              </button>
            </div>
          </div>

          {usdCurrency && usdToBrl > 1 && (
            <p className="text-[10px] text-muted-foreground">Valores convertidos de USD → BRL (cotação: R$ {usdToBrl.toFixed(2)})</p>
          )}
          {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando métricas...</div>}
          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">Erro: {error}</div>}

          {insights && !loading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Gasto */}
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Gasto Total</p>
                <p className="text-2xl font-bold text-foreground mt-1">R$ {fmt(parseFloat(insights.spend))}</p>
              </div>
              {/* Leads */}
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Leads Gerados</p>
                <p className="text-2xl font-bold text-primary mt-1">{insights.leads.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{crmLeads.length} no CRM</p>
              </div>
              {/* CPL */}
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">CPL (Custo por Lead)</p>
                <p className="text-2xl font-bold text-foreground mt-1">R$ {fmt(insights.cpl)}</p>
              </div>
              {/* Alcance */}
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Alcance</p>
                <p className="text-2xl font-bold text-foreground mt-1">{fmtInt(insights.reach)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtInt(insights.impressions)} impressões</p>
              </div>
              {/* CTR */}
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">CTR</p>
                <p className="text-2xl font-bold text-foreground mt-1">{parseFloat(insights.ctr).toFixed(2)}%</p>
              </div>
              {/* CPC */}
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">CPC</p>
                <p className="text-2xl font-bold text-foreground mt-1">R$ {fmt(parseFloat(insights.cpc))}</p>
              </div>
              {/* CPM */}
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">CPM</p>
                <p className="text-2xl font-bold text-foreground mt-1">R$ {fmt(parseFloat(insights.cpm))}</p>
              </div>
              {/* Clicks */}
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Cliques no Link</p>
                <p className="text-2xl font-bold text-foreground mt-1">{fmtInt(insights.clicks)}</p>
              </div>
            </div>
          )}

          {/* ID da campanha vinculada */}
          <p className="text-[10px] text-muted-foreground">Campanha vinculada: <span className="font-mono">{lancamento.meta_campaign_id}</span></p>
        </>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

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
  const [editingLead, setEditingLead] = useState<LaunchLead | null>(null);
  const [editLeadForm, setEditLeadForm] = useState({ nome: '', whatsapp: '', email: '', observacoes: '' });
  const [editingValor, setEditingValor] = useState(false);
  const [valorInput, setValorInput] = useState('');

  // Column management
  const [renamingColuna, setRenamingColuna] = useState<KanbanColuna | null>(null);
  const [deletingColuna, setDeletingColuna] = useState<KanbanColuna | null>(null);
  const [settingsColuna, setSettingsColuna] = useState<KanbanColuna | null>(null);

  // Shared column hook
  const {
    colunas, colunasRef, loadingColunas,
    addColuna, renameColuna, deleteColuna, moveColuna, updateRegraColuna,
  } = useKanbanColunas('lancamento', lancamentoId);

  // Pending guard: blocks Realtime from overwriting optimistic fase updates
  const pendingUpdates = useRef<Map<string, string>>(new Map());
  const leadsRef = useRef<LaunchLead[]>([]);
  useEffect(() => { leadsRef.current = leads; }, [leads]);

  const vinicius = users.find(u => u.nome?.toLowerCase().includes('vinicius'));

  // ── Fetch all leads with pagination (Supabase max-rows is 1000) ────────────
  const fetchAllLeads = async (lancId: string) => {
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('lancamento_leads')
        .select('*')
        .eq('lancamento_id', lancId)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  // ── Fetch lancamento + leads ────────────────────────────────────────────────
  useEffect(() => {
    if (!lancamentoId) return;
    setLoading(true);

    const load = async () => {
      const { data: lancData } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('id', lancamentoId)
        .single();
      if (lancData) {
        const lsKey = `trafego_config_${lancamentoId}`;
        const lsConfig = localStorage.getItem(lsKey);
        const merged = lsConfig ? { ...lancData, ...JSON.parse(lsConfig) } : lancData;
        setLancamento(merged as Launch);
      }

      let loadedLeads = (await fetchAllLeads(lancamentoId)) as LaunchLead[];

      // Migrate legacy string fase values once columns are loaded
      if (colunasRef.current.length > 0) {
        loadedLeads = await migrateLegacyLeads(loadedLeads, colunasRef.current);
      }

      setLeads(loadedLeads);
      setLoading(false);
    };
    load();
  }, [lancamentoId]);

  // ── Auto-migration: fix leads with legacy string fase ──────────────────────
  const migrateLegacyLeads = async (
    loadedLeads: LaunchLead[],
    cols: KanbanColuna[],
  ): Promise<LaunchLead[]> => {
    const validIds = new Set(cols.map(c => c.id));
    const legacy = loadedLeads.filter(l => !validIds.has(l.fase));
    if (legacy.length === 0) return loadedLeads;

    const migrated = loadedLeads.map(lead => {
      if (validIds.has(lead.fase)) return lead;
      const newFase = resolveLegacyFase(lead.fase, cols);
      return { ...lead, fase: newFase };
    });

    // Batch update DB — fire and forget errors so UI is not blocked
    await Promise.all(
      legacy.map(lead => {
        const newFase = (migrated.find(m => m.id === lead.id) as LaunchLead).fase;
        return supabase
          .from('lancamento_leads')
          .update({ fase: newFase })
          .eq('id', lead.id)
          .then(({ error }) => {
            if (error) console.warn('Migration failed for lead', lead.id, error.message);
          });
      })
    );

    return migrated;
  };

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lancamentoId) return;

    const load = async () => {
      // reload leads only (columns are static within a session)
      const data = await fetchAllLeads(lancamentoId);
      setLeads(data as LaunchLead[]);
    };

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
  const handleMoveLead = useCallback(async (leadId: string, colunaId: string) => {
    const previousLeads = leadsRef.current;
    pendingUpdates.current.set(leadId, colunaId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, fase: colunaId } : l));

    // Derive boolean flags from the destination column's name
    const coluna = colunasRef.current.find(c => c.id === colunaId);
    const flagPayload = coluna ? getPhasePayloadByColName(coluna.nome) : {};

    const { data: updated, error } = await supabase
      .from('lancamento_leads')
      .update({ fase: colunaId, ...flagPayload })
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
    const primeiraColuna = colunasRef.current[0];
    if (!primeiraColuna) { toast.error('Nenhuma coluna encontrada'); return; }
    setIsAddingLead(true);
    const { error } = await supabase.from('lancamento_leads').insert({
      lancamento_id: lancamentoId,
      nome: newLeadForm.nome,
      whatsapp: newLeadForm.whatsapp,
      email: newLeadForm.email || null,
      fase: primeiraColuna.id,  // always UUID
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

  // ── Save tráfego config ──────────────────────────────────────────────────────
  const handleSaveTrafegoConfig = async (data: { meta_campaign_id: string; meta_ad_account_id: string; meta_access_token: string }) => {
    const lsKey = `trafego_config_${lancamentoId}`;
    const { error } = await supabase.from('lancamentos').update(data as any).eq('id', lancamentoId);
    if (error) {
      localStorage.setItem(lsKey, JSON.stringify(data));
      setLancamento(prev => prev ? { ...prev, ...data } : prev);
      toast.success('Campanha vinculada! (salvo localmente)');
      return;
    }
    localStorage.removeItem(lsKey);
    setLancamento(prev => prev ? { ...prev, ...data } : prev);
    toast.success('Campanha vinculada!');
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

  // ── Edit lead ───────────────────────────────────────────────────────────────
  const handleOpenEditLead = (lead: LaunchLead) => {
    setEditingLead(lead);
    setEditLeadForm({
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      email: lead.email ?? '',
      observacoes: lead.observacoes ?? '',
    });
  };

  const handleSaveEditLead = async () => {
    if (!editingLead) return;
    const { error } = await supabase
      .from('lancamento_leads')
      .update({
        nome: editLeadForm.nome,
        whatsapp: editLeadForm.whatsapp,
        email: editLeadForm.email || null,
        observacoes: editLeadForm.observacoes || null,
      })
      .eq('id', editingLead.id);
    if (error) { toast.error('Erro ao salvar lead'); return; }
    setLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...editLeadForm } : l));
    setEditingLead(null);
    toast.success('Lead atualizado!');
  };

  // ── Delete column (move orphaned leads to first remaining column) ───────────
  const handleDeleteColWithLeads = async (id: string) => {
    const remaining = colunasRef.current.filter(c => c.id !== id);
    if (remaining.length > 0) {
      const target = remaining[0].id;
      await supabase.from('lancamento_leads').update({ fase: target }).eq('fase', id);
      setLeads(prev => prev.map(l => l.fase === id ? { ...l, fase: target } : l));
    }
    await deleteColuna(id);
    setDeletingColuna(null);
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

  const getLeadsByColuna = (colunaId: string) => filteredLeads.filter(l => l.fase === colunaId);


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
          { id: 'trafego', label: '📊 Tráfego' },
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

      {/* ── Tráfego Tab ── */}
      {activeView === 'trafego' && (
        <TrafegoTab lancamento={lancamento} leads={leads} onSaveMeta={handleSaveTrafegoConfig} />
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
            <div className="flex gap-4 min-w-full pb-4 items-start">
              {colunas.map(coluna => {
                const colLeads = getLeadsByColuna(coluna.id);
                return (
                  <div key={coluna.id} className="group/col flex-shrink-0 w-80">
                    <div className="bg-muted rounded-lg p-4 h-full">
                      <KanbanColunaHeader
                        coluna={coluna}
                        count={colLeads.length}
                        disabled={lancamento.status === 'finalizado'}
                        onRename={() => setRenamingColuna(coluna)}
                        onDelete={() => setDeletingColuna(coluna)}
                        onMoveLeft={() => moveColuna(coluna.id, 'left')}
                        onMoveRight={() => moveColuna(coluna.id, 'right')}
                        onOpenSettings={() => setSettingsColuna(coluna)}
                      />
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {colLeads.map(lead => (
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
                                  onClick={() => handleOpenEditLead(lead)}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  title="Editar lead"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
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
                            <Select
                              value={lead.fase}
                              onValueChange={value => handleMoveLead(lead.id, value)}
                              disabled={lancamento.status === 'finalizado'}
                            >
                              <SelectTrigger className="mt-2 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {colunas.map(c => (
                                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              <AddColunaButton
                onAdd={addColuna}
                disabled={lancamento.status === 'finalizado'}
              />
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

      {/* ── Column Management Modals ── */}
      <RenameColunaModal
        coluna={renamingColuna}
        onSave={(id, nome) => { renameColuna(id, nome); setRenamingColuna(null); }}
        onClose={() => setRenamingColuna(null)}
      />
      <ColunaSettingsModal
        coluna={settingsColuna}
        onSave={(id, updates) => { updateRegraColuna(id, updates); setSettingsColuna(null); }}
        onClose={() => setSettingsColuna(null)}
      />
      <DeleteColunaModal
        coluna={deletingColuna}
        leadCount={deletingColuna ? getLeadsByColuna(deletingColuna.id).length : 0}
        onConfirm={handleDeleteColWithLeads}
        onClose={() => setDeletingColuna(null)}
      />

      {/* ── Edit Lead Modal ── */}
      <Dialog open={!!editingLead} onOpenChange={() => setEditingLead(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={editLeadForm.nome} onChange={e => setEditLeadForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">WhatsApp</label>
              <Input value={editLeadForm.whatsapp} onChange={e => setEditLeadForm(f => ({ ...f, whatsapp: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={editLeadForm.email} onChange={e => setEditLeadForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Observações</label>
              <Input value={editLeadForm.observacoes} onChange={e => setEditLeadForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setEditingLead(null)}>Cancelar</Button>
              <Button onClick={handleSaveEditLead}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
