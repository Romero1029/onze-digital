import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Notification } from '@/types/crm';

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setNotifications(data as unknown as Notification[]);
    };
    load();

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as unknown as Notification;
        if (n.user_id === user.id) {
          setNotifications(prev => [n, ...prev].slice(0, 20));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unread = notifications.filter(n => !n.lida).length;

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.lida).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ lida: true } as any).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const iconMap: Record<string, string> = {
    tarefa_criada: '📋',
    tarefa_atrasada: '⏰',
    handoff_rodrygo: '🟣',
    lead_quente: '🔥',
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground border-0">
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-card border-border p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Notificações</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação</p>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${!n.lida ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{iconMap[n.tipo] || '📢'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{n.titulo}</p>
                    {n.descricao && <p className="text-xs text-muted-foreground mt-0.5">{n.descricao}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {!n.lida && <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
