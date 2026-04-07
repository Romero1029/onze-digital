import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/contexts/LeadsContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, FileText, Search, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

interface ChatMessage {
  id: string;
  lead_id: string;
  direction: string;
  content: string;
  created_at: string;
  created_by: string | null;
  was_analyzed: boolean;
}

interface Template {
  id: string;
  titulo: string;
  conteudo: string;
}

export function Chat() {
  const { user } = useAuth();
  const { leads } = useLeads();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [lastMessages, setLastMessages] = useState<Record<string, ChatMessage>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Load messages for selected lead from chat_messages table
  const loadMessages = useCallback(async (leadId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }
    setMessages((data as ChatMessage[]) || []);
  }, []);

  // Load last message per lead for sidebar preview
  useEffect(() => {
    const loadLastMessages = async () => {
      if (leads.length === 0) return;
      const leadIds = leads.map(l => l.id);
      // Get all chat messages and pick last per lead
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });

      if (data) {
        const map: Record<string, ChatMessage> = {};
        for (const msg of data as ChatMessage[]) {
          if (!map[msg.lead_id]) map[msg.lead_id] = msg;
        }
        setLastMessages(map);
      }
    };
    loadLastMessages();
  }, [leads]);

  // When selecting a lead, load messages + also seed from leads table if no chat_messages exist
  useEffect(() => {
    if (!selectedLeadId) return;

    const init = async () => {
      await loadMessages(selectedLeadId);

      // Check if we need to seed from leads table (migration from old system)
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', selectedLeadId);

      if (count === 0) {
        // Seed from leads.mensagem_lead and leads.mensagem_ia
        const lead = leads.find(l => l.id === selectedLeadId);
        if (lead) {
          const toInsert: any[] = [];
          if (lead.mensagemLead) {
            toInsert.push({
              lead_id: selectedLeadId,
              direction: 'incoming',
              content: lead.mensagemLead,
              lead_type: 'formacao',
              created_by: null,
            });
          }
          if (lead.mensagemIa) {
            toInsert.push({
              lead_id: selectedLeadId,
              direction: 'outgoing',
              content: lead.mensagemIa,
              lead_type: 'formacao',
              created_by: user?.id || null,
            });
          }
          if (toInsert.length > 0) {
            await supabase.from('chat_messages').insert(toInsert);
            await loadMessages(selectedLeadId);
          }
        }
      }
    };

    init();

    // Realtime subscription for this lead's messages
    const channel = supabase
      .channel(`chat-messages-${selectedLeadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `lead_id=eq.${selectedLeadId}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedLeadId, loadMessages, leads, user?.id]);

  // Also listen for leads table updates (when external automation updates mensagem_lead/mensagem_ia)
  useEffect(() => {
    if (!selectedLeadId) return;

    const channel = supabase
      .channel(`lead-msg-sync-${selectedLeadId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'leads',
        filter: `id=eq.${selectedLeadId}`,
      }, async (payload) => {
        const newRow = payload.new as any;
        // If mensagem_lead changed, insert as incoming
        if (newRow.mensagem_lead) {
          const { data: existing } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('lead_id', selectedLeadId)
            .eq('direction', 'incoming')
            .eq('content', newRow.mensagem_lead)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from('chat_messages').insert({
              lead_id: selectedLeadId,
              direction: 'incoming',
              content: newRow.mensagem_lead,
              lead_type: 'formacao',
            });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedLeadId]);

  // Load templates
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('message_templates').select('*').order('titulo');
      if (data) setTemplates(data as Template[]);
    };
    load();
  }, []);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || !selectedLeadId || !user) return;

    const text = content.trim();

    // Insert into chat_messages table
    const { error } = await supabase.from('chat_messages').insert({
      lead_id: selectedLeadId,
      direction: 'outgoing',
      content: text,
      lead_type: 'formacao',
      created_by: user.id,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao enviar mensagem', description: error.message });
      return;
    }

    // Also update leads table for backwards compatibility
    await supabase.from('leads').update({ mensagem_ia: text }).eq('id', selectedLeadId);

    setNewMessage('');
  };

  const handleSendTemplate = (template: Template) => {
    setNewMessage(template.conteudo);
    setShowTemplates(false);
  };

  const filteredLeads = leads.filter(l =>
    l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefone.includes(searchTerm)
  );

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex animate-fade-in">
      {/* Lead List */}
      <div className="w-80 border-r border-border flex flex-col bg-card">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredLeads.map(lead => {
            const lastMsg = lastMessages[lead.id];
            return (
              <button
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className={cn(
                  'w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50',
                  selectedLeadId === lead.id && 'bg-muted'
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {lead.nome.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground truncate">{lead.nome}</span>
                    {lastMsg && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                        {formatTime(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {lastMsg ? lastMsg.content : lead.telefone}
                  </p>
                </div>
              </button>
            );
          })}
          {filteredLeads.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhum lead encontrado
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedLead ? (
          <>
            {/* Chat Header */}
            <div className="h-14 border-b border-border flex items-center px-4 bg-card gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {selectedLead.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">{selectedLead.nome}</h3>
                <p className="text-xs text-muted-foreground">{selectedLead.telefone}</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-3xl mx-auto">
                {messages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Nenhuma mensagem ainda. Inicie a conversa!
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2 text-sm',
                        msg.direction === 'outgoing'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <span className={cn(
                        'text-[10px] mt-1 block text-right',
                        msg.direction === 'outgoing' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t border-border p-3 bg-card">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => setShowTemplates(true)}
                  title="Templates"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Digite uma mensagem..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(newMessage);
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage(newMessage)}
                  disabled={!newMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecione um lead para iniciar a conversa</p>
            </div>
          </div>
        )}
      </div>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Templates de Mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum template cadastrado. Adicione templates nas configurações.
              </p>
            )}
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => handleSendTemplate(template)}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium text-sm text-foreground">{template.titulo}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.conteudo}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
