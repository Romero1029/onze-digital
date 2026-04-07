import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { DollarSign, Target, RefreshCw, BarChart3, Phone, ChevronRight, ChevronDown, Users, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const VALOR_UNITARIO = 109.90;

interface L30Lead {
  id: number;
  Nome: string | null;
  'E-mail': string | null;
  Whatsapp: string | null;
  Data: string | null;
  'No Grupo?': string | null;
  'Grupo de Oferta': string | null;
  'Follow Up 01': string | null;
  'Follow Up 02': string | null;
  'Follow Up 03': string | null;
  turma: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Lancamento30Props {
  turma?: string;
}

type KanbanColumn = {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  filter: (l: L30Lead) => boolean;
};

// turma values from trigger: 'lead', 'lancamento', 'oferta'
const COLUMNS: KanbanColumn[] = [
  { key: 'lead', label: 'Planilha (Lead)', color: 'bg-muted-foreground', bgColor: 'bg-muted/30', filter: l => (l.turma === 'lead' || !l.turma) && !l['Follow Up 01'] },
  { key: 'lancamento', label: 'Grupo Lançamento', color: 'bg-pipeline-sdr', bgColor: 'bg-pipeline-sdr/5', filter: l => l.turma === 'lancamento' && !l['Grupo de Oferta']?.toUpperCase().includes('SIM') },
  { key: 'oferta', label: 'Grupo Oferta', color: 'bg-npa', bgColor: 'bg-npa/5', filter: l => l.turma === 'oferta' || (l['Grupo de Oferta'] || '').toUpperCase() === 'SIM' },
  { key: 'followup1', label: 'Follow Up 01', color: 'bg-pipeline-followup1', bgColor: 'bg-pipeline-followup1/5', filter: l => !!(l['Follow Up 01']) && !(l['Follow Up 02']) && l.turma !== 'oferta' },
  { key: 'followup2', label: 'Follow Up 02', color: 'bg-pipeline-followup2', bgColor: 'bg-pipeline-followup2/5', filter: l => !!(l['Follow Up 02']) && !(l['Follow Up 03']) },
  { key: 'followup3', label: 'Follow Up 03', color: 'bg-pipeline-followup3', bgColor: 'bg-pipeline-followup3/5', filter: l => !!(l['Follow Up 03']) },
];

function getStageLabel(lead: L30Lead): string {
  if (lead['Follow Up 03']) return 'Follow Up 03';
  if (lead['Follow Up 02']) return 'Follow Up 02';
  if (lead['Follow Up 01']) return 'Follow Up 01';
  if (lead.turma === 'oferta' || (lead['Grupo de Oferta'] || '').toUpperCase() === 'SIM') return 'Grupo Oferta';
  if (lead.turma === 'lancamento') return 'Grupo Lançamento';
  return 'Planilha';
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function Lancamento30({ turma = '#30' }: Lancamento30Props) {
  const [leads, setLeads] = useState<L30Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('origem', 'Lancamento')
      .order('created_at', { ascending: true });
    
    if (error) {
      toast({ title: 'Erro ao carregar leads', description: error.message, variant: 'destructive' });
      return;
    }
    setLeads((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
    const channel = supabase
      .channel(`lancamento-leads-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `origem=eq.Lancamento` }, () => fetchLeads())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  const totalLeads = leads.length;
  const grupoLancamento = leads.filter(l => l.turma === 'lancamento').length;
  const grupoOferta = leads.filter(l => l.turma === 'oferta' || (l['Grupo de Oferta'] || '').toUpperCase() === 'SIM').length;
  const comFollowUp = leads.filter(l => l['Follow Up 01'] || l['Follow Up 02'] || l['Follow Up 03']).length;

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-4 pb-2 flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl font-bold text-foreground">Lançamento {turma}</h1>
        <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Atualizar
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="px-4 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <OverviewCard icon={Users} title="Total de Leads" value={String(totalLeads)} subtitle="na base do lançamento" colorClass="text-primary bg-primary/10" />
        <OverviewCard icon={Target} title="Grupo Lançamento" value={String(grupoLancamento)} subtitle={formatCurrency(grupoLancamento * VALOR_UNITARIO)} colorClass="text-info bg-info/10" />
        <OverviewCard icon={DollarSign} title="Grupo Oferta" value={String(grupoOferta)} subtitle={formatCurrency(grupoOferta * VALOR_UNITARIO)} colorClass="text-npa bg-npa/10" />
        <OverviewCard icon={BarChart3} title="Potencial Total" value={formatCurrency(totalLeads * VALOR_UNITARIO)} subtitle={`${comFollowUp} em follow-up`} colorClass="text-pipeline-closer bg-pipeline-closer/10" />
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 p-4 pt-3 min-w-max h-full">
          {COLUMNS.map(col => {
            const colLeads = leads.filter(col.filter);
            return (
              <div key={col.key} className={`w-64 shrink-0 rounded-xl ${col.bgColor} flex flex-col border border-border/50`}>
                <div className="p-3 flex items-center gap-2 border-b border-border/30">
                  <div className={`w-3 h-3 rounded-full ${col.color}`} />
                  <span className="font-semibold text-sm text-foreground">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{colLeads.length}</Badge>
                </div>
                <ScrollArea className="flex-1 px-2 pb-2">
                  <div className="space-y-2 pt-2">
                    {colLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                    {colLeads.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum lead</p>}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics Footer */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-border bg-card/50">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>📊 Taxa de entrada no grupo: <strong className="text-foreground">{totalLeads > 0 ? ((grupoLancamento / totalLeads) * 100).toFixed(1) : 0}%</strong></span>
          <span>🎯 Taxa no grupo de oferta: <strong className="text-foreground">{totalLeads > 0 ? ((grupoOferta / totalLeads) * 100).toFixed(1) : 0}%</strong></span>
          <span>💰 Receita potencial: <strong className="text-foreground">{formatCurrency(grupoOferta * VALOR_UNITARIO)}</strong></span>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({ icon: Icon, title, value, subtitle, colorClass }: { icon: any; title: string; value: string; subtitle: string; colorClass: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClass}`}><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadCard({ lead }: { lead: L30Lead }) {
  const [expanded, setExpanded] = useState(false);
  const nome = lead.Nome || 'Sem nome';
  const telefone = lead.Whatsapp || '';

  const openWhatsApp = () => {
    if (!telefone) return;
    const clean = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${clean}`, '_blank');
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate text-foreground">{nome}</p>
            {telefone && (
              <button onClick={openWhatsApp} className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 hover:text-success transition-colors">
                <Phone className="h-3 w-3" /> {telefone}
              </button>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="shrink-0 p-1 hover:bg-muted rounded">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
        
        {/* Stage Badge */}
        <Badge variant="secondary" className="mt-1.5 text-[10px]">{getStageLabel(lead)}</Badge>
        
        {lead.Data && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Entrada: {format(new Date(lead.Data), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        )}

        {expanded && (
          <div className="mt-2 pt-2 border-t border-border space-y-1 text-xs text-muted-foreground">
            {lead['E-mail'] && <p>📧 {lead['E-mail']}</p>}
            {lead['No Grupo?'] && <p>Grupo: <strong>{lead['No Grupo?']}</strong></p>}
            {lead['Grupo de Oferta'] && <p>Oferta: <strong>{lead['Grupo de Oferta']}</strong></p>}
            {lead['Follow Up 01'] && <p>FU 01: {lead['Follow Up 01']}</p>}
            {lead['Follow Up 02'] && <p>FU 02: {lead['Follow Up 02']}</p>}
            {lead['Follow Up 03'] && <p>FU 03: {lead['Follow Up 03']}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
