import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  MessageSquare, Send, Settings, FileText, History, Clock,
  Plus, Trash2, Pencil, Play, CheckCircle2, XCircle, AlertCircle,
  Wifi, WifiOff, RefreshCw, Zap, Phone, User, Calendar,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EvolutionConfig {
  id: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  ativo: boolean;
}

interface CobrancaConfig {
  id: string;
  ativo: boolean;
  horario_envio: string;
  dias_pre_vencimento: number[];
  enviar_pre_vencimento: boolean;
  enviar_no_vencimento: boolean;
  dias_pos_vencimento: number[];
  enviar_pos_vencimento: boolean;
  enviar_apenas_dias_uteis: boolean;
  pausar_fins_semana: boolean;
}

interface Template {
  id: string;
  nome: string;
  tipo: 'pre_vencimento' | 'vencimento' | 'pos_vencimento' | 'quitacao' | 'aviso_cancelamento';
  dias_offset: number;
  mensagem: string;
  ativo: boolean;
  ordem: number;
}

interface CobrancaLog {
  id: string;
  aluno_nome: string;
  telefone: string;
  mensagem: string;
  template_nome: string | null;
  template_tipo: string | null;
  status: 'pendente' | 'enviado' | 'erro' | 'cancelado';
  erro_msg: string | null;
  agendado_para: string | null;
  enviado_em: string | null;
  manual: boolean;
  created_at: string;
  aluno_id: string | null;
}

interface FilaItem {
  aluno_id: string;
  aluno_nome: string;
  telefone: string;
  pagamento_id: string;
  valor: number;
  parcela: number;
  data_vencimento: string;
  dias_offset: number;
  link_pagamento: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  pre_vencimento:     'Pré-vencimento',
  vencimento:         'No vencimento',
  pos_vencimento:     'Pós-vencimento',
  quitacao:           'Quitação',
  aviso_cancelamento: 'Aviso cancelamento',
};

const TIPO_COLORS: Record<string, string> = {
  pre_vencimento:     'bg-blue-50 text-blue-700 border-blue-200',
  vencimento:         'bg-amber-50 text-amber-700 border-amber-200',
  pos_vencimento:     'bg-red-50 text-red-700 border-red-200',
  quitacao:           'bg-emerald-50 text-emerald-700 border-emerald-200',
  aviso_cancelamento: 'bg-purple-50 text-purple-700 border-purple-200',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const VARIAVEIS = ['{{nome}}', '{{valor}}', '{{parcela}}', '{{vencimento}}', '{{dias_atraso}}', '{{link_pagamento}}'];

// ─── Subcomponents ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'enviado')  return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1"><CheckCircle2 size={11}/>Enviado</Badge>;
  if (status === 'erro')     return <Badge className="bg-red-50 text-red-700 border border-red-200 gap-1"><XCircle size={11}/>Erro</Badge>;
  if (status === 'pendente') return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 gap-1"><Clock size={11}/>Pendente</Badge>;
  return <Badge variant="outline">Cancelado</Badge>;
}

function DaysChips({ values, onChange }: { values: number[]; onChange: (v: number[]) => void }) {
  const options = [1, 2, 3, 5, 7, 10, 14, 15, 30];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(d => {
        const active = values.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(active ? values.filter(v => v !== d) : [...values, d].sort((a, b) => a - b))}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:border-primary'
            }`}
          >
            {d}d
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Cobranca() {
  const { user } = useAuth();

  // ── State ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'fila' | 'historico' | 'templates' | 'config'>('fila');

  const [evoCfg, setEvoCfg]           = useState<EvolutionConfig | null>(null);
  const [cobrancaCfg, setCobrancaCfg] = useState<CobrancaConfig | null>(null);
  const [templates, setTemplates]     = useState<Template[]>([]);
  const [logs, setLogs]               = useState<CobrancaLog[]>([]);
  const [fila, setFila]               = useState<FilaItem[]>([]);

  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [testando, setTestando]       = useState(false);
  const [conexaoStatus, setConexaoStatus] = useState<'unknown' | 'ok' | 'erro'>('unknown');
  const [enviandoIds, setEnviandoIds] = useState<Set<string>>(new Set());

  // Template modal
  const [templateModal, setTemplateModal] = useState<Partial<Template> | null>(null);

  // Send manual modal
  const [sendModal, setSendModal] = useState<FilaItem | null>(null);
  const [sendMensagem, setSendMensagem] = useState('');
  const [sendTemplate, setSendTemplate] = useState('');

  // Log detail
  const [logDetail, setLogDetail] = useState<CobrancaLog | null>(null);

  // Search
  const [searchLog, setSearchLog] = useState('');

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [evoRes, cfgRes, tplRes, logRes] = await Promise.all([
      supabase.from('evolution_config' as any).select('*').eq('id', 'default').single(),
      supabase.from('cobranca_config'  as any).select('*').eq('id', 'default').single(),
      supabase.from('cobranca_templates' as any).select('*').order('ordem'),
      supabase.from('cobranca_logs' as any).select('*').order('created_at', { ascending: false }).limit(200),
    ]);

    if (evoRes.data) setEvoCfg(evoRes.data as EvolutionConfig);
    if (cfgRes.data) setCobrancaCfg(cfgRes.data as CobrancaConfig);
    if (tplRes.data) setTemplates(tplRes.data as Template[]);
    if (logRes.data) setLogs(logRes.data as CobrancaLog[]);

    // Buscar fila de hoje
    const hoje = new Date().toISOString().split('T')[0];
    const filaRes = await supabase.rpc('get_alunos_para_cobranca' as any, { p_data: hoje });
    if (filaRes.data) setFila(filaRes.data as FilaItem[]);

    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Testar conexão Evolution ──────────────────────────────────────────────
  const testarConexao = async () => {
    if (!evoCfg?.api_url || !evoCfg?.api_key || !evoCfg?.instance_name) {
      toast.error('Preencha URL, API Key e Instância antes de testar');
      return;
    }
    setTestando(true);
    try {
      const url = `${evoCfg.api_url.replace(/\/$/, '')}/instance/fetchInstances`;
      const res = await fetch(url, { headers: { apikey: evoCfg.api_key } });
      if (res.ok) {
        const data = await res.json();
        const instances = Array.isArray(data) ? data : [data];
        const found = instances.some((i: any) =>
          i.instance?.instanceName === evoCfg.instance_name ||
          i.name === evoCfg.instance_name
        );
        if (found) {
          setConexaoStatus('ok');
          toast.success('Conectado! Instância encontrada.');
        } else {
          setConexaoStatus('erro');
          toast.warning(`Servidor acessível mas instância "${evoCfg.instance_name}" não encontrada. Verifique o nome.`);
        }
      } else {
        setConexaoStatus('erro');
        toast.error(`Erro ${res.status} ao conectar com Evolution API`);
      }
    } catch (e: any) {
      setConexaoStatus('erro');
      toast.error('Não foi possível conectar: ' + (e?.message ?? 'verifique a URL'));
    }
    setTestando(false);
  };

  // ── Salvar configs ────────────────────────────────────────────────────────
  const salvarEvoCfg = async () => {
    if (!evoCfg) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('evolution_config')
      .upsert({ ...evoCfg, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Configuração Evolution salva!');
    setSaving(false);
  };

  const salvarCobrancaCfg = async () => {
    if (!cobrancaCfg) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('cobranca_config')
      .upsert({ ...cobrancaCfg, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Regras de cobrança salvas!');
    setSaving(false);
  };

  // ── Templates CRUD ────────────────────────────────────────────────────────
  const salvarTemplate = async () => {
    if (!templateModal) return;
    setSaving(true);
    if (templateModal.id) {
      const { error } = await (supabase as any)
        .from('cobranca_templates')
        .update({ ...templateModal, updated_at: new Date().toISOString() })
        .eq('id', templateModal.id);
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
    } else {
      const { error } = await (supabase as any)
        .from('cobranca_templates')
        .insert({ ...templateModal, ordem: templates.length });
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
    }
    toast.success('Template salvo!');
    setTemplateModal(null);
    await loadAll();
    setSaving(false);
  };

  const toggleTemplate = async (tpl: Template) => {
    const { error } = await (supabase as any)
      .from('cobranca_templates')
      .update({ ativo: !tpl.ativo })
      .eq('id', tpl.id);
    if (!error) {
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, ativo: !t.ativo } : t));
    }
  };

  const deletarTemplate = async (id: string) => {
    if (!confirm('Excluir este template?')) return;
    await (supabase as any).from('cobranca_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Template removido');
  };

  // ── Envio manual ──────────────────────────────────────────────────────────
  const abrirSendModal = (item: FilaItem) => {
    // Pré-selecionar template adequado
    let tipo = item.dias_offset < 0 ? 'pre_vencimento' : item.dias_offset === 0 ? 'vencimento' : 'pos_vencimento';
    const tpl = templates.find(t => t.tipo === tipo && t.dias_offset === item.dias_offset && t.ativo);
    if (tpl) {
      setSendTemplate(tpl.id);
      const vencimento = new Date(item.data_vencimento).toLocaleDateString('pt-BR');
      const vars: Record<string, string | number | null> = {
        nome: item.aluno_nome,
        valor: fmt(item.valor),
        parcela: item.parcela,
        vencimento,
        dias_atraso: item.dias_offset > 0 ? item.dias_offset : null,
        link_pagamento: item.link_pagamento || null,
      };
      setSendMensagem(renderMensagem(tpl.mensagem, vars));
    } else {
      setSendTemplate('');
      setSendMensagem('');
    }
    setSendModal(item);
  };

  const enviarManual = async () => {
    if (!sendModal || !sendMensagem.trim()) return;
    const tpl = templates.find(t => t.id === sendTemplate);
    setEnviandoIds(p => new Set([...p, sendModal.pagamento_id]));

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-cobranca`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aluno_id:      sendModal.aluno_id,
          pagamento_id:  sendModal.pagamento_id,
          mensagem:      sendMensagem,
          template_nome: tpl?.nome ?? 'Manual',
          template_tipo: tpl?.tipo ?? null,
          aluno_nome:    sendModal.aluno_nome,
          telefone:      sendModal.telefone,
        }),
      }
    );
    const json = await res.json();
    if (json.success) toast.success(`Mensagem enviada para ${sendModal.aluno_nome}!`);
    else toast.error('Erro ao enviar: ' + (json.error ?? 'desconhecido'));

    setSendModal(null);
    setSendMensagem('');
    setEnviandoIds(p => { const next = new Set(p); next.delete(sendModal.pagamento_id); return next; });
    await loadAll();
  };

  const reenviarLog = async (log: CobrancaLog) => {
    setEnviandoIds(p => new Set([...p, log.id]));
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-cobranca`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ log_id: log.id }),
      }
    );
    const json = await res.json();
    if (json.success) toast.success('Reenviado com sucesso!');
    else toast.error('Erro: ' + (json.error ?? 'desconhecido'));
    setEnviandoIds(p => { const next = new Set(p); next.delete(log.id); return next; });
    await loadAll();
  };

  const dispararBulk = async () => {
    if (!confirm('Disparar cobrança automática agora para todos os elegíveis?')) return;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    toast.info('Processando fila...');
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-cobranca`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bulk: true }),
      }
    );
    const json = await res.json();
    if (json.enviados !== undefined) {
      toast.success(`${json.enviados} mensagens enviadas, ${json.erros ?? 0} erros`);
    } else {
      toast.error(json.error ?? 'Erro ao processar fila');
    }
    await loadAll();
  };

  // ── Filtered logs ─────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() =>
    logs.filter(l =>
      !searchLog ||
      l.aluno_nome.toLowerCase().includes(searchLog.toLowerCase()) ||
      l.telefone.includes(searchLog) ||
      (l.template_nome ?? '').toLowerCase().includes(searchLog.toLowerCase())
    ),
  [logs, searchLog]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    enviados: logs.filter(l => l.status === 'enviado').length,
    erros:    logs.filter(l => l.status === 'erro').length,
    hoje:     logs.filter(l => l.status === 'enviado' && l.enviado_em?.startsWith(new Date().toISOString().split('T')[0])).length,
    filaHoje: fila.length,
  }), [logs, fila]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="animate-spin mr-2" size={18} /> Carregando sistema de cobrança...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="text-primary" size={24} />
            Cobrança Automatizada
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envio de mensagens WhatsApp via Evolution API
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${
            cobrancaCfg?.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground border-border'
          }`}>
            {cobrancaCfg?.ativo ? <><Zap size={12}/> Automação ativa</> : <><Clock size={12}/> Automação pausada</>}
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5">
            <RefreshCw size={14}/> Atualizar
          </Button>
          {cobrancaCfg?.ativo && (
            <Button size="sm" onClick={dispararBulk} className="gap-1.5">
              <Play size={14}/> Disparar agora
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Na fila hoje', value: stats.filaHoje, icon: Calendar, color: 'text-blue-600' },
          { label: 'Enviados hoje', value: stats.hoje,    icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Total enviados', value: stats.enviados, icon: Send, color: 'text-primary' },
          { label: 'Erros',          value: stats.erros,   icon: XCircle, color: 'text-red-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                <Icon size={16} className={color} />
              </div>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="fila"      className="gap-1.5 flex-1 sm:flex-none"><Calendar size={14}/> Fila ({fila.length})</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 flex-1 sm:flex-none"><History size={14}/> Histórico</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 flex-1 sm:flex-none"><FileText size={14}/> Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="config"    className="gap-1.5 flex-1 sm:flex-none"><Settings size={14}/> Configuração</TabsTrigger>
        </TabsList>

        {/* ─── FILA ───────────────────────────────────────────────────────── */}
        <TabsContent value="fila" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar size={16}/> Fila de hoje
              </CardTitle>
              <CardDescription>
                Alunos com pagamentos pendentes/atrasados aptos a receber mensagem hoje
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {fila.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <CheckCircle2 size={40} className="text-emerald-400"/>
                  <p className="font-medium">Nenhum envio pendente para hoje</p>
                  <p className="text-xs">A fila é atualizada diariamente com base nos vencimentos</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Aluno</th>
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Telefone</th>
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Parcela</th>
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Valor</th>
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Vencimento</th>
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Situação</th>
                        <th className="px-4 py-3"/>
                      </tr>
                    </thead>
                    <tbody>
                      {fila.map(item => {
                        const atraso = item.dias_offset;
                        const isSending = enviandoIds.has(item.pagamento_id);
                        return (
                          <tr key={item.pagamento_id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                  {item.aluno_nome[0]}
                                </div>
                                <span className="font-medium">{item.aluno_nome}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.telefone}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-xs">#{item.parcela}</Badge>
                            </td>
                            <td className="px-4 py-3 font-semibold">R$ {fmt(item.valor)}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3">
                              {atraso < 0 && <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">{Math.abs(atraso)}d antes</Badge>}
                              {atraso === 0 && <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs">Vence hoje</Badge>}
                              {atraso > 0 && <Badge className="bg-red-50 text-red-700 border border-red-200 text-xs">{atraso}d em atraso</Badge>}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs h-7"
                                disabled={isSending}
                                onClick={() => abrirSendModal(item)}
                              >
                                {isSending ? <RefreshCw size={12} className="animate-spin"/> : <Send size={12}/>}
                                Enviar
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── HISTÓRICO ──────────────────────────────────────────────────── */}
        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History size={16}/> Histórico de envios
                  </CardTitle>
                  <CardDescription>Últimas 200 mensagens enviadas ou com erro</CardDescription>
                </div>
                <Input
                  placeholder="Buscar aluno, telefone..."
                  value={searchLog}
                  onChange={e => setSearchLog(e.target.value)}
                  className="w-56 h-8 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <History size={40} className="opacity-30"/>
                  <p>Nenhum envio registrado ainda</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Aluno</th>
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Template</th>
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Enviado em</th>
                        <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Tipo</th>
                        <th className="px-4 py-3"/>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(log => (
                        <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setLogDetail(log)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                {log.aluno_nome[0]}
                              </div>
                              <div>
                                <p className="font-medium leading-none">{log.aluno_nome}</p>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">{log.telefone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{log.template_nome ?? '—'}</td>
                          <td className="px-4 py-3"><StatusBadge status={log.status}/></td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(log.enviado_em ?? log.created_at)}</td>
                          <td className="px-4 py-3">
                            {log.manual
                              ? <Badge variant="outline" className="text-xs">Manual</Badge>
                              : <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Auto</Badge>
                            }
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            {log.status === 'erro' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs h-7"
                                disabled={enviandoIds.has(log.id)}
                                onClick={() => reenviarLog(log)}
                              >
                                <RefreshCw size={11}/> Reenviar
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TEMPLATES ──────────────────────────────────────────────────── */}
        <TabsContent value="templates" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Templates de Mensagem</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use: {VARIAVEIS.join(' ')}
              </p>
            </div>
            <Button size="sm" onClick={() => setTemplateModal({ tipo: 'pos_vencimento', dias_offset: 0, ativo: true })} className="gap-1.5">
              <Plus size={14}/> Novo template
            </Button>
          </div>

          <div className="grid gap-3">
            {Object.entries(TIPO_LABELS).map(([tipo, label]) => {
              const grupo = templates.filter(t => t.tipo === tipo);
              if (grupo.length === 0) return null;
              return (
                <div key={tipo}>
                  <Badge className={`mb-2 border text-xs ${TIPO_COLORS[tipo]}`}>{label}</Badge>
                  <div className="grid gap-2">
                    {grupo.map(tpl => (
                      <Card key={tpl.id} className={`border transition-all ${!tpl.ativo ? 'opacity-50' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{tpl.nome}</span>
                                {tpl.dias_offset !== 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {tpl.dias_offset > 0 ? `+${tpl.dias_offset}d` : `${tpl.dias_offset}d`}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{tpl.mensagem}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Switch checked={tpl.ativo} onCheckedChange={() => toggleTemplate(tpl)} />
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setTemplateModal({ ...tpl })}>
                                <Pencil size={13}/>
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => deletarTemplate(tpl.id)}>
                                <Trash2 size={13}/>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── CONFIGURAÇÃO ───────────────────────────────────────────────── */}
        <TabsContent value="config" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Evolution API */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone size={16}/> Evolution API (WhatsApp)
                </CardTitle>
                <CardDescription>Configure a instância do WhatsApp para envio automático</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">API ativa</p>
                    <p className="text-xs text-muted-foreground">Habilita todos os envios automáticos</p>
                  </div>
                  <Switch
                    checked={evoCfg?.ativo ?? false}
                    onCheckedChange={v => setEvoCfg(p => p ? { ...p, ativo: v } : p)}
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">URL do servidor</label>
                    <Input
                      placeholder="https://evolution.seudominio.com"
                      value={evoCfg?.api_url ?? ''}
                      onChange={e => setEvoCfg(p => p ? { ...p, api_url: e.target.value } : p)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">API Key</label>
                    <Input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={evoCfg?.api_key ?? ''}
                      onChange={e => setEvoCfg(p => p ? { ...p, api_key: e.target.value } : p)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nome da instância</label>
                    <Input
                      placeholder="ex: 11ds-principal"
                      value={evoCfg?.instance_name ?? ''}
                      onChange={e => setEvoCfg(p => p ? { ...p, instance_name: e.target.value } : p)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={testarConexao} disabled={testando}>
                    {testando
                      ? <RefreshCw size={13} className="animate-spin"/>
                      : conexaoStatus === 'ok' ? <Wifi size={13} className="text-emerald-600"/>
                      : conexaoStatus === 'erro' ? <WifiOff size={13} className="text-red-500"/>
                      : <Wifi size={13}/>
                    }
                    {testando ? 'Testando...' : 'Testar conexão'}
                  </Button>
                  <Button size="sm" onClick={salvarEvoCfg} disabled={saving} className="gap-1.5">
                    {saving ? <RefreshCw size={13} className="animate-spin"/> : null}
                    Salvar
                  </Button>
                  {conexaoStatus === 'ok' && <span className="text-xs text-emerald-600 font-medium">✓ Conectado</span>}
                  {conexaoStatus === 'erro' && <span className="text-xs text-red-500 font-medium">✗ Falha na conexão</span>}
                </div>
              </CardContent>
            </Card>

            {/* Regras de cobrança */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings size={16}/> Regras de envio
                </CardTitle>
                <CardDescription>Configure quando e como os lembretes são disparados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Automação ativa</p>
                    <p className="text-xs text-muted-foreground">Liga/desliga todos os envios automáticos</p>
                  </div>
                  <Switch
                    checked={cobrancaCfg?.ativo ?? false}
                    onCheckedChange={v => setCobrancaCfg(p => p ? { ...p, ativo: v } : p)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Horário de envio</label>
                  <Input
                    type="time"
                    value={cobrancaCfg?.horario_envio ?? '09:00'}
                    onChange={e => setCobrancaCfg(p => p ? { ...p, horario_envio: e.target.value } : p)}
                    className="w-36"
                  />
                </div>

                <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Pré-vencimento</p>
                      <p className="text-xs text-muted-foreground">Dias antes do vencimento</p>
                    </div>
                    <Switch
                      checked={cobrancaCfg?.enviar_pre_vencimento ?? true}
                      onCheckedChange={v => setCobrancaCfg(p => p ? { ...p, enviar_pre_vencimento: v } : p)}
                    />
                  </div>
                  {cobrancaCfg?.enviar_pre_vencimento && (
                    <DaysChips
                      values={cobrancaCfg?.dias_pre_vencimento ?? []}
                      onChange={v => setCobrancaCfg(p => p ? { ...p, dias_pre_vencimento: v } : p)}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div>
                    <p className="text-sm font-medium">No dia do vencimento</p>
                    <p className="text-xs text-muted-foreground">Enviar no próprio dia</p>
                  </div>
                  <Switch
                    checked={cobrancaCfg?.enviar_no_vencimento ?? true}
                    onCheckedChange={v => setCobrancaCfg(p => p ? { ...p, enviar_no_vencimento: v } : p)}
                  />
                </div>

                <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Pós-vencimento</p>
                      <p className="text-xs text-muted-foreground">Dias após o vencimento</p>
                    </div>
                    <Switch
                      checked={cobrancaCfg?.enviar_pos_vencimento ?? true}
                      onCheckedChange={v => setCobrancaCfg(p => p ? { ...p, enviar_pos_vencimento: v } : p)}
                    />
                  </div>
                  {cobrancaCfg?.enviar_pos_vencimento && (
                    <DaysChips
                      values={cobrancaCfg?.dias_pos_vencimento ?? []}
                      onChange={v => setCobrancaCfg(p => p ? { ...p, dias_pos_vencimento: v } : p)}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div>
                    <p className="text-sm font-medium">Pausar fins de semana</p>
                    <p className="text-xs text-muted-foreground">Não enviar sábado e domingo</p>
                  </div>
                  <Switch
                    checked={cobrancaCfg?.pausar_fins_semana ?? true}
                    onCheckedChange={v => setCobrancaCfg(p => p ? { ...p, pausar_fins_semana: v } : p)}
                  />
                </div>

                <Button size="sm" className="w-full gap-1.5" onClick={salvarCobrancaCfg} disabled={saving}>
                  {saving ? <RefreshCw size={13} className="animate-spin"/> : null}
                  Salvar regras
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Modal: Envio manual ──────────────────────────────────────────── */}
      <Dialog open={!!sendModal} onOpenChange={v => !v && setSendModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send size={16}/> Enviar mensagem
            </DialogTitle>
          </DialogHeader>
          {sendModal && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {sendModal.aluno_nome[0]}
                </div>
                <div>
                  <p className="font-semibold">{sendModal.aluno_nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">{sendModal.telefone}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">Parcela {sendModal.parcela}</p>
                  <p className="font-bold text-sm">R$ {fmt(sendModal.valor)}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Template</label>
                <Select value={sendTemplate} onValueChange={tid => {
                  setSendTemplate(tid);
                  const tpl = templates.find(t => t.id === tid);
                  if (tpl) {
                    const venc = new Date(sendModal.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR');
                    const vars: Record<string, string | number | null> = {
                      nome: sendModal.aluno_nome, valor: fmt(sendModal.valor),
                      parcela: sendModal.parcela, vencimento: venc,
                      dias_atraso: sendModal.dias_offset > 0 ? sendModal.dias_offset : null,
                      link_pagamento: sendModal.link_pagamento || null,
                    };
                    setSendMensagem(renderMensagem(tpl.mensagem, vars));
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione um template ou escreva abaixo"/></SelectTrigger>
                  <SelectContent>
                    {templates.filter(t => t.ativo).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem</label>
                  <span className="text-xs text-muted-foreground">{sendMensagem.length} chars</span>
                </div>
                <Textarea
                  rows={10}
                  value={sendMensagem}
                  onChange={e => setSendMensagem(e.target.value)}
                  placeholder="Digite a mensagem ou selecione um template acima..."
                  className="font-mono text-sm resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {VARIAVEIS.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSendMensagem(p => p + v)}
                    className="px-2 py-0.5 rounded bg-muted text-xs font-mono hover:bg-primary/10 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendModal(null)}>Cancelar</Button>
            <Button
              onClick={enviarManual}
              disabled={!sendMensagem.trim() || enviandoIds.has(sendModal?.pagamento_id ?? '')}
              className="gap-1.5"
            >
              <Send size={14}/> Enviar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Template editor ───────────────────────────────────────── */}
      <Dialog open={!!templateModal} onOpenChange={v => !v && setTemplateModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{templateModal?.id ? 'Editar template' : 'Novo template'}</DialogTitle>
          </DialogHeader>
          {templateModal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nome</label>
                  <Input
                    value={templateModal.nome ?? ''}
                    onChange={e => setTemplateModal(p => p ? { ...p, nome: e.target.value } : p)}
                    placeholder="Ex: Lembrete 3 dias antes"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Tipo</label>
                  <Select
                    value={templateModal.tipo ?? 'pos_vencimento'}
                    onValueChange={v => setTemplateModal(p => p ? { ...p, tipo: v as any } : p)}
                  >
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Offset de dias ({templateModal.tipo === 'pre_vencimento' ? 'negativo = antes' : 'positivo = depois'})
                </label>
                <Input
                  type="number"
                  value={templateModal.dias_offset ?? 0}
                  onChange={e => setTemplateModal(p => p ? { ...p, dias_offset: Number(e.target.value) } : p)}
                  className="w-28"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem</label>
                </div>
                <Textarea
                  rows={10}
                  value={templateModal.mensagem ?? ''}
                  onChange={e => setTemplateModal(p => p ? { ...p, mensagem: e.target.value } : p)}
                  placeholder="Olá {{nome}}..."
                  className="font-mono text-sm resize-none"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {VARIAVEIS.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTemplateModal(p => p ? { ...p, mensagem: (p.mensagem ?? '') + v } : p)}
                      className="px-2 py-0.5 rounded bg-muted text-xs font-mono hover:bg-primary/10 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={templateModal.ativo ?? true}
                  onCheckedChange={v => setTemplateModal(p => p ? { ...p, ativo: v } : p)}
                />
                <span className="text-sm">Template ativo</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateModal(null)}>Cancelar</Button>
            <Button onClick={salvarTemplate} disabled={saving || !templateModal?.nome || !templateModal?.mensagem}>
              Salvar template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Detalhe do log ────────────────────────────────────────── */}
      <Dialog open={!!logDetail} onOpenChange={v => !v && setLogDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare size={16}/> Detalhe do envio
            </DialogTitle>
          </DialogHeader>
          {logDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground font-medium">Aluno</p><p className="font-semibold">{logDetail.aluno_nome}</p></div>
                <div><p className="text-xs text-muted-foreground font-medium">Telefone</p><p className="font-mono">{logDetail.telefone}</p></div>
                <div><p className="text-xs text-muted-foreground font-medium">Status</p><StatusBadge status={logDetail.status}/></div>
                <div><p className="text-xs text-muted-foreground font-medium">Enviado em</p><p>{fmtDate(logDetail.enviado_em)}</p></div>
                <div><p className="text-xs text-muted-foreground font-medium">Template</p><p>{logDetail.template_nome ?? '—'}</p></div>
                <div><p className="text-xs text-muted-foreground font-medium">Tipo</p><p>{TIPO_LABELS[logDetail.template_tipo ?? ''] ?? '—'}</p></div>
              </div>
              {logDetail.erro_msg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-mono">
                  {logDetail.erro_msg}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mensagem enviada</p>
                <div className="p-3 rounded-lg bg-muted/40 border text-sm whitespace-pre-line font-mono">
                  {logDetail.mensagem}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {logDetail?.status === 'erro' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={enviandoIds.has(logDetail.id)}
                onClick={() => { reenviarLog(logDetail!); setLogDetail(null); }}
              >
                <RefreshCw size={13}/> Reenviar
              </Button>
            )}
            <Button onClick={() => setLogDetail(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Utilitário de render de template (client-side, para preview)
function renderMensagem(template: string, vars: Record<string, string | number | null>): string {
  let result = template;
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return vars[key] ? content : '';
  });
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v !== null && v !== undefined ? String(v) : '';
  });
  return result.trim();
}
