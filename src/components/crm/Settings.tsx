import { useState } from 'react';
import { useLeads } from '@/contexts/LeadsContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { validateWebhookUrl, WebhookUrlValidationError } from '@/lib/webhook';
import { Webhook, BookOpen, Globe, Plus, Trash2, Send } from 'lucide-react';

export function Settings() {
  const { cursos, fontes, config, addCurso, deleteCurso, addFonte, deleteFonte, updateConfig } = useLeads();
  const { toast } = useToast();
  const [webhookOut, setWebhookOut] = useState(config.webhookOut || '');
  const [webhookIn, setWebhookIn] = useState(config.webhookIn || '');
  const [newCurso, setNewCurso] = useState('');
  const [newFonte, setNewFonte] = useState('');

  const saveWebhooks = async () => {
    try {
      // Validate on the client too so the user gets immediate feedback.
      validateWebhookUrl(webhookOut);
      validateWebhookUrl(webhookIn);

      await updateConfig({ webhookOut, webhookIn });
      toast({
        title: 'Configurações salvas',
        description: 'As URLs de webhook foram atualizadas.',
      });
    } catch (err) {
      const message =
        err instanceof WebhookUrlValidationError
          ? err.message
          : 'Não foi possível salvar as configurações.';
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: message,
      });
    }
  };

  const testWebhook = async () => {
    if (!webhookOut) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Configure a URL do webhook primeiro.',
      });
      return;
    }

    try {
      const url = validateWebhookUrl(webhookOut);

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        mode: 'no-cors',
        body: JSON.stringify({
          action: 'test',
          message: 'Teste de webhook do CRM Onze Digital',
          timestamp: new Date().toISOString(),
        }),
      });

      toast({
        title: 'Teste enviado',
        description: 'Verifique seu sistema de automação para confirmar o recebimento.',
      });
    } catch (err) {
      const message =
        err instanceof WebhookUrlValidationError
          ? err.message
          : 'Não foi possível enviar o teste.';
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: message,
      });
    }
  };

  const handleAddCurso = () => {
    if (!newCurso.trim()) return;
    addCurso(newCurso.trim());
    setNewCurso('');
    toast({ title: 'Curso adicionado' });
  };

  const handleAddFonte = () => {
    if (!newFonte.trim()) return;
    addFonte(newFonte.trim());
    setNewFonte('');
    toast({ title: 'Fonte adicionada' });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in pb-20 lg:pb-6">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>

      <Tabs defaultValue="webhooks" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="webhooks">
            <Webhook className="h-4 w-4 mr-2" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="cursos">
            <BookOpen className="h-4 w-4 mr-2" />
            Cursos
          </TabsTrigger>
          <TabsTrigger value="fontes">
            <Globe className="h-4 w-4 mr-2" />
            Fontes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Webhook de Saída (Enviar dados)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Configure uma URL para receber dados quando leads forem criados ou atualizados.
              Compatível com n8n, Zapier, Make e outros.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <Input
                  value={webhookOut}
                  onChange={(e) => setWebhookOut(e.target.value)}
                  placeholder="https://n8n.seu-servidor.com/webhook/..."
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={saveWebhooks} className="gradient-primary hover:opacity-90">
                  Salvar
                </Button>
                <Button variant="outline" onClick={testWebhook}>
                  <Send className="h-4 w-4 mr-2" />
                  Testar
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Webhook de Entrada (Receber leads)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Use esta URL no n8n, Zapier ou Make para enviar leads automaticamente para o CRM.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Webhook (copie para sua integração)</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value="https://qdpitjwpvmqsgshsdiab.supabase.co/functions/v1/webhook-leads"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText('https://qdpitjwpvmqsgshsdiab.supabase.co/functions/v1/webhook-leads');
                      toast({ title: 'URL copiada!' });
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium text-foreground">Campos aceitos (JSON POST):</p>
                <code className="text-xs text-muted-foreground block">
                  {`{ "nome": "...", "telefone": "...", "email": "(opcional)", "curso_interesse": "...", "fonte": "...", "valor": 0 }`}
                </code>
                <p className="text-xs text-muted-foreground">* obrigatórios: nome e telefone</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cursos" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Cursos Disponíveis</h2>
            <div className="flex gap-2 mb-4">
              <Input
                value={newCurso}
                onChange={(e) => setNewCurso(e.target.value)}
                placeholder="Nome do novo curso"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCurso()}
              />
              <Button onClick={handleAddCurso} className="gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {cursos.map((curso) => (
                <div
                  key={curso.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
                >
                  <span className="text-foreground">{curso.nome}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteCurso(curso.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="fontes" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Fontes de Leads</h2>
            <div className="flex gap-2 mb-4">
              <Input
                value={newFonte}
                onChange={(e) => setNewFonte(e.target.value)}
                placeholder="Nome da nova fonte"
                onKeyDown={(e) => e.key === 'Enter' && handleAddFonte()}
              />
              <Button onClick={handleAddFonte} className="gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {fontes.map((fonte) => (
                <div
                  key={fonte.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
                >
                  <span className="text-foreground">{fonte.nome}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteFonte(fonte.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
