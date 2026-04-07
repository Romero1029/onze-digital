import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Edit, Save, X, FileText } from 'lucide-react';

interface Processo {
  id: string;
  titulo: string;
  conteudo: string;
  responsavel_padrao: string | null;
  ordem: number;
  editado_por: string | null;
  editado_em: string | null;
}

export function Processos() {
  const { user } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('processos').select('*').order('ordem');
      if (data) setProcessos(data as unknown as Processo[]);
    };
    load();
  }, []);

  const startEdit = (p: Processo) => { setEditingId(p.id); setEditContent(p.conteudo); };
  const cancelEdit = () => { setEditingId(null); setEditContent(''); };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from('processos').update({
      conteudo: editContent,
      editado_por: user?.nome || 'Sistema',
      editado_em: new Date().toISOString(),
    } as any).eq('id', id);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: error.message }); return; }
    setProcessos(prev => prev.map(p => p.id === id ? { ...p, conteudo: editContent, editado_por: user?.nome || null, editado_em: new Date().toISOString() } : p));
    setEditingId(null);
    toast({ title: 'Processo salvo!' });
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in pb-20 lg:pb-6 overflow-y-auto h-full">
      <h1 className="text-2xl font-bold">Processos da Empresa</h1>
      <p className="text-sm text-muted-foreground">Documentação viva dos processos. Clique em Editar para atualizar.</p>

      <div className="space-y-4">
        {processos.map(p => (
          <Card key={p.id} className="p-6 bg-card border-border">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-produtividade" />{p.titulo}</h2>
                {p.responsavel_padrao && <p className="text-xs text-muted-foreground mt-1">Responsável padrão: {p.responsavel_padrao}</p>}
              </div>
              {editingId === p.id ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                  <Button size="sm" onClick={() => saveEdit(p.id)} className="bg-produtividade text-produtividade-foreground hover:bg-produtividade/90"><Save className="h-4 w-4 mr-1" />Salvar</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => startEdit(p)}><Edit className="h-4 w-4 mr-1" />Editar</Button>
              )}
            </div>
            {editingId === p.id ? (
              <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={8} className="font-mono text-sm" />
            ) : (
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">{p.conteudo}</pre>
            )}
            {p.editado_por && p.editado_em && (
              <p className="text-[10px] text-muted-foreground mt-3 border-t border-border pt-2">
                Última edição: {p.editado_por} em {new Date(p.editado_em).toLocaleDateString('pt-BR')}
              </p>
            )}
          </Card>
        ))}
        {processos.length === 0 && (
          <Card className="p-8 text-center"><p className="text-muted-foreground">Nenhum processo cadastrado</p></Card>
        )}
      </div>
    </div>
  );
}
