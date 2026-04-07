import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NPA_PIPELINE_STAGES, NPAPipelineStage } from '@/types/crm';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Users, CheckCircle, TrendingUp, DollarSign } from 'lucide-react';

export function NPAPipeline() {
  const { getUserById } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('origem', 'NPA')
      .order('created_at', { ascending: false });
    if (data) setLeads(data);
  };

  useEffect(() => {
    fetchLeads();
    const ch = supabase
      .channel('npa-pipeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `origem=eq.NPA` }, () => fetchLeads())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const changeStage = async (id: string, newStage: NPAPipelineStage) => {
    const update: Record<string, any> = { status: newStage };
    if (newStage === 'matricula') update.convertido_em = new Date().toISOString();
    const { error } = await supabase.from('leads').update(update).eq('id', id);
    if (error) toast({ variant: 'destructive', title: 'Erro', description: error.message });
  };

  const total = leads.length;
  const matriculas = leads.filter(l => l.status === 'matricula' || l.status === 'handoff_rodrygo').length;
  const taxa = total > 0 ? ((matriculas / total) * 100).toFixed(1) : '0.0';
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="p-4 lg:p-6 pb-0">
        <h1 className="text-xl lg:text-2xl font-bold">Pipeline NPA</h1>
      </div>

      {/* Overview Cards */}
      <div className="px-4 lg:px-6 pt-3 grid grid-cols-3 gap-3 flex-shrink-0">
        <Card className="p-3 bg-card border-l-4 border-l-npa">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold">{total}</p>
        </Card>
        <Card className="p-3 bg-card border-l-4 border-l-success">
          <p className="text-xs text-muted-foreground">Matrículas</p>
          <p className="text-xl font-bold">{matriculas}</p>
        </Card>
        <Card className="p-3 bg-card">
          <p className="text-xs text-muted-foreground">Conversão</p>
          <p className="text-xl font-bold">{taxa}%</p>
        </Card>
      </div>

      {/* Kanban */}
      <div className="flex-1 flex gap-3 overflow-x-auto p-3 lg:p-6 pb-24 lg:pb-6">
        {NPA_PIPELINE_STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.status === stage.key);
          return (
            <div key={stage.key} className="flex-shrink-0 w-[85vw] sm:w-72 lg:w-80">
              <div className={`rounded-t-lg p-2.5 ${stage.color}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary-foreground text-sm">{stage.label}</span>
                  <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0 text-xs">{stageLeads.length}</Badge>
                </div>
              </div>
              <div className="bg-muted/50 rounded-b-lg p-2 space-y-2 min-h-96 max-h-[calc(100vh-16rem)] overflow-y-auto">
                {stageLeads.map(lead => {
                  const resp = getUserById(lead.responsavel_id);
                  return (
                    <Card key={lead.id} className="p-3 bg-card border-border border-l-2 border-l-npa hover:shadow-md transition-shadow">
                      <h3 className="font-semibold text-sm truncate">{lead.nome}</h3>
                      <p className="text-xs text-muted-foreground">{lead.telefone}</p>
                      {resp && <Badge className="text-xs mt-1 text-primary-foreground" style={{ backgroundColor: resp.cor }}>{resp.nome.split(' ')[0]}</Badge>}
                      <Select value={lead.status} onValueChange={v => changeStage(lead.id, v as NPAPipelineStage)}>
                        <SelectTrigger className="mt-2 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border z-[100]" position="popper">
                          {NPA_PIPELINE_STAGES.map(s => (<SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </Card>
                  );
                })}
                {stageLeads.length === 0 && <div className="text-center py-8 text-muted-foreground text-xs">Nenhum lead</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Metrics Footer */}
      <div className="px-4 lg:px-6 pb-4 pt-2 flex-shrink-0 border-t border-border bg-card/50">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>📊 Conversão: <strong className="text-foreground">{taxa}%</strong></span>
          <span>💰 Receita: <strong className="text-foreground">{fmt(leads.filter(l => l.status === 'matricula' || l.status === 'handoff_rodrygo').reduce((a, l) => a + (l.valor_investimento || 297), 0))}</strong></span>
          <span>🎯 Em negociação: <strong className="text-foreground">{leads.filter(l => !['novo', 'matricula', 'handoff_rodrygo'].includes(l.status)).length}</strong></span>
        </div>
      </div>
    </div>
  );
}
