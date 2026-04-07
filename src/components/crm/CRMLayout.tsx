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
import { Rodrygo } from './Rodrygo';
import { LancamentoKanban } from './LancamentoKanban';
import NPAKanban from './NPAKanban';
import { AulaSecretaKanban } from './AulaSecretaKanban';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export function CRMLayout() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isFlashLeadModalOpen, setIsFlashLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [lancamentoId, setLancamentoId] = useState<string | null>(null);
  const [loadingLancamento, setLoadingLancamento] = useState(false);
  const [npaEventoId, setNpaEventoId] = useState<string | null>(null);
  const [loadingNpaEvento, setLoadingNpaEvento] = useState(false);
  const [aulaSecretaId, setAulaSecretaId] = useState<string | null>(null);
  const [loadingAulaSecreta, setLoadingAulaSecreta] = useState(false);

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

  const renderView = () => {
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
      case 'rodrygo': return <Rodrygo />;
      case 'team': return user?.tipo === 'admin' ? <TeamManagement /> : <Dashboard />;
      case 'settings': return <Settings />;
      case 'operacoes_tarefas': return <Operacoes currentPage={currentView} />;
      case 'operacoes_calendario_geral': return <Operacoes currentPage={currentView} />;
      case 'operacoes_calendario_conteudo': return <Operacoes currentPage={currentView} />;
      case 'mapa_mental': return <MapaMental />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header onAddLead={handleAddLead} onAddFlashLead={handleAddFlashLead} />
      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className="flex-1 overflow-hidden">{renderView()}</main>
      </div>
      <MobileNav currentView={currentView} onViewChange={setCurrentView} />
      <LeadModal isOpen={isLeadModalOpen} onClose={() => setIsLeadModalOpen(false)} editingLead={editingLead} />
      <FlashLeadModal isOpen={isFlashLeadModalOpen} onClose={() => setIsFlashLeadModalOpen(false)} />
    </div>
  );
}