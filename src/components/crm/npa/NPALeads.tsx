import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

export function NPALeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('origem', 'NPA')
        .order('created_at', { ascending: false });
      if (data) setLeads(data);
    };
    load();
  }, []);

  const filtered = leads.filter(l => l.nome.toLowerCase().includes(search.toLowerCase()) || (l.telefone || '').includes(search));

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in pb-20 lg:pb-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads NPA</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Telefone</th>
              <th className="text-left p-3 font-medium">Etapa</th>
              <th className="text-left p-3 font-medium">Criado em</th>
            </tr></thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3 font-medium">{lead.nome}</td>
                  <td className="p-3 text-muted-foreground">{lead.telefone || '—'}</td>
                  <td className="p-3"><Badge variant="secondary" className="text-xs">{lead.status}</Badge></td>
                  <td className="p-3 text-muted-foreground text-xs">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhum lead encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
