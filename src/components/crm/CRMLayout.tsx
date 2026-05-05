import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/crm';
import { Header } from './Header';
import { Sidebar, MobileNav, type View } from './Sidebar';
import { Dashboard } from './Dashboard';
import { Pipeline } from './Pipeline';
import { SheetsLeads } from './SheetsLeads';
import { Chat } from './Chat';
import { TeamManagement } from './TeamManagement';
import { Settings } from './Settings';
import { LeadModal } from './LeadModal';
import { FlashLeadModal } from './FlashLeadModal';
import { NPAEventos } from './NPAEventos';
import { Operacoes } from './Operacoes';
import { ProdutividadeAvancada } from './ProdutividadeAvancada';
import { MapaMental } from './MapaMental';
import { Financeiro } from './Financeiro';
import { Balanco } from './Balanco';
import { Rodrygo } from './Rodrygo';
import { Pedagogico } from '../pedagogico/Pedagogico';
import { LancamentoKanban } from './LancamentoKanban';
import NPAKanban from './NPAKanban';
import { AulaSecretaKanban } from './AulaSecretaKanban';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

export function CRMLayout() {
  const { user } = useAuth();
  const { permissions, loading: permLoading } = usePermissions();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [initialRedirectDone, setInitialRedirectDone] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isFlashLeadModalOpen, setIsFlashLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [lancamentoId, setLancamentoId] = useState<string | null>(null);
  const [loadingLancamento, setLoadingLancamento] = useState(false);
  const [npaEventoId, setNpaEventoId] = useState<string | null>(null);
  const [loadingNpaEvento, setLoadingNpaEvento] = useState(false);
  const [aulaSecretaId, setAulaSecretaId] = useState<string | null>(null);
  const [loadingAulaSecreta, setLoadingAulaSecreta] = useState(false);

  // Redireciona para primeira view permitida quando permissões carregam
  useEffect(() => {
    if (permLoading || initialRedirectDone || user?.tipo === 'admin') {
      setInitialRedirectDone(true);
      return;
    }
    const redirect = async () => {
      if (permissions.can_view_dashboard) { setInitialRedirectDone(true); return; }

      // Tenta ir para o primeiro lançamento permitido
      if (permissions.can_view_lancamentos) {
        let q = supabase.from('lancamentos').select('id').order('created_at', { ascending: false });
        if (!permissions.can_view_all_lancamentos && permissions.allowed_lancamento_ids.length > 0) {
          q = (q as any).in('id', permissions.allowed_lancamento_ids);
        }
        const { data } = await (q as any).limit(1);
        if (data && data.length > 0) {
          setCurrentView(`lancamentos_${data[0].id}` as View);
          setInitialRedirectDone(true);
          return;
        }
      }

      // Fallbacks em ordem
      if (permissions.can_view_pipeline) { setCurrentView('pipeline'); setInitialRedirectDone(true); return; }
      if (permissions.can_view_npa) {
        const { data } = await supabase.from('npa_eventos').select('id').order('created_at', { ascending: false }).limit(1);
        if (data?.[0]) { setCurrentView(`npa_${data[0].id}` as View); setInitialRedirectDone(true); return; }
      }
      if (permissions.can_view_financeiro) { setCurrentView('financeiro'); setInitialRedirectDone(true); return; }
      if (permissions.can_view_chat) { setCurrentView('chat'); setInitialRedirectDone(true); return; }
      setInitialRedirectDone(true);
    };
    redirect();
  }, [permLoading]);

  const handleAddLead = () => { setEditingLead(null); setIsLeadModalOpen(true); };
  const handleAddFlashLead = () => { setIsFlashLeadModalOpen(true); };
  const handleEditLead = (lead: Lead) => { setEditingLead(lead); setIsLeadModalOpen(true); };

  // Fetch lancamento ID when view changes
  useEffect(() => {
    const loadLancamentoId = async () => {
      if (typeof currentView === 'string' && currentView.startsWith('lancamentos_')) {
        setLoadingLancamento(true);
        const possibleId = currentView.replace('lancamentos_', '');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(possibleId)) {
          setLancamentoId(possibleId);
        } else {
          const { data } = await supabase
            .from('lancamentos')
            .select('id')
            .ilike('nome', `%${possibleId}%`)
            .single();
          if (data) setLancamentoId(data.id);
        }
        setLoadingLancamento(false);
      }
    };
    loadLancamentoId();
  }, [currentView]);

  // Fetch NPA evento ID when view changes
  useEffect(() => {
    const loadNpaEventoId = async () => {
      if (typeof currentView === 'string' && currentView.startsWith('npa_')) {
        setLoadingNpaEvento(true);
        const possibleId = currentView.replace('npa_', '');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(possibleId)) {
          setNpaEventoId(possibleId);
        } else {
          const { data } = await supabase
            .from('npa_eventos')
            .select('id')
            .ilike('nome', `%${possibleId}%`)
            .single();
          if (data) setNpaEventoId(data.id);
        }
        setLoadingNpaEvento(false);
      }
    };
    loadNpaEventoId();
  }, [currentView]);

  // Fetch Aula Secreta ID when view changes
  useEffect(() => {
    const loadAulaSecretaId = async () => {
      if (typeof currentView === 'string' && currentView.startsWith('aula_secreta_')) {
        setLoadingAulaSecreta(true);
        const possibleId = currentView.replace('aula_secreta_', '');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(possibleId)) {
          setAulaSecretaId(possibleId);
        } else {
          const { data } = await supabase
            .from('aula_secreta_eventos')
            .select('id')
            .ilike('nome', `%${possibleId}%`)
            .single();
          if (data) setAulaSecretaId(data.id);
        }
        setLoadingAulaSecreta(false);
      }
    };
    loadAulaSecretaId();
  }, [currentView]);

  const isViewAllowed = (view: View): boolean => {
    if (user?.tipo === 'admin') return true;
    const v = view as string;
    if (v.startsWith('lancamentos_')) {
      if (!permissions.can_view_lancamentos) return false;
      if (!permissions.can_view_all_lancamentos) {
        const id = v.replace('lancamentos_', '');
        return permissions.allowed_lancamento_ids.includes(id);
      }
      return true;
    }
    if (v.startsWith('npa_')) return permissions.can_view_npa;
    if (v.startsWith('aula_secreta_')) return permissions.can_view_aula_secreta;
    if (v.startsWith('operacoes_')) return permissions.can_view_operacoes;
    const map: Record<string, boolean> = {
      dashboard: permissions.can_view_dashboard,
      pipeline: permissions.can_view_pipeline,
      chat: permissions.can_view_chat,
      sheets: permissions.can_view_sheets,
      financeiro: permissions.can_view_financeiro,
      balanco: permissions.can_view_balanco,
      mapa_mental: permissions.can_view_mapa_mental,
      rodrygo: permissions.can_view_rodrygo,
      pedagogico: permissions.can_view_pedagogico,
      team: permissions.can_view_team,
      settings: permissions.can_view_settings,
    };
    return map[v] ?? true;
  };

  const handleViewChange = (view: View) => {
    if (isViewAllowed(view)) setCurrentView(view);
  };

  const renderView = () => {
    if (!isViewAllowed(currentView)) return <Dashboard />;

    // Handle dynamic lancamentos
    if (typeof currentView === 'string' && currentView.startsWith('lancamentos_')) {
      if (loadingLancamento) {
        return (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        );
      }
      if (!lancamentoId) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground">Lançamento não encontrado</p>
            </div>
          </div>
        );
      }
      return <LancamentoKanban lancamentoId={lancamentoId} />;
    }

    // Handle dynamic NPA eventos
    if (typeof currentView === 'string' && currentView.startsWith('npa_')) {
      if (loadingNpaEvento) {
        return (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        );
      }
      if (!npaEventoId) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground">Evento NPA não encontrado</p>
            </div>
          </div>
        );
      }
      return <NPAKanban npaEventoId={npaEventoId} />;
    }

    // Handle dynamic Aula Secreta eventos
    if (typeof currentView === 'string' && currentView.startsWith('aula_secreta_')) {
      if (loadingAulaSecreta) {
        return (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        );
      }
      if (!aulaSecretaId) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground">Aula Secreta não encontrada</p>
            </div>
          </div>
        );
      }
      return <AulaSecretaKanban aulaSecretaId={aulaSecretaId} />;
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'pipeline': return <Pipeline onEditLead={handleEditLead} />;
      case 'chat': return <Chat />;
      case 'sheets': return <SheetsLeads />;
      case 'financeiro': return <Financeiro />;
      case 'balanco': return <Balanco />;
      case 'rodrygo': return <Rodrygo />;
      case 'team': return user?.tipo === 'admin' ? <TeamManagement /> : <Dashboard />;
      case 'settings': return <Settings />;
      case 'operacoes_tarefas': return <Operacoes currentPage={currentView} />;
      case 'operacoes_calendario_geral': return <Operacoes currentPage={currentView} />;
      case 'operacoes_calendario_conteudo': return <Operacoes currentPage={currentView} />;
      case 'mapa_mental': return <MapaMental />;
      case 'pedagogico': return <Pedagogico />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header onAddLead={handleAddLead} onAddFlashLead={handleAddFlashLead} />
      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar currentView={currentView} onViewChange={handleViewChange} />
        <main className="flex-1 overflow-hidden">{renderView()}</main>
      </div>
      <MobileNav currentView={currentView} onViewChange={handleViewChange} />
      <LeadModal isOpen={isLeadModalOpen} onClose={() => setIsLeadModalOpen(false)} editingLead={editingLead} />
      <FlashLeadModal isOpen={isFlashLeadModalOpen} onClose={() => setIsFlashLeadModalOpen(false)} />
    </div>
  );
}