import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';

interface OperacoesHeaderProps {
  activeTab: 'tarefas' | 'calendario_geral' | 'calendario_conteudo';
  onTabChange: (tab: 'tarefas' | 'calendario_geral' | 'calendario_conteudo') => void;
  onCreateTarefa: () => void;
  onCreateEvento: () => void;
  onCreateConteudo: () => void;
}

export function OperacoesHeader({
  activeTab,
  onTabChange,
  onCreateTarefa,
  onCreateEvento,
  onCreateConteudo
}: OperacoesHeaderProps) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-border">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Operações</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Centro de controle de produtividade</p>
            </div>
            <div className="flex gap-2">
              {activeTab === 'tarefas' && (
                <Button
                  onClick={onCreateTarefa}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />Nova Tarefa
                </Button>
              )}
              {activeTab === 'calendario_geral' && (
                <Button
                  onClick={onCreateEvento}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />Novo Evento
                </Button>
              )}
              {activeTab === 'calendario_conteudo' && (
                <Button
                  onClick={onCreateConteudo}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />Novo Conteúdo
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => onTabChange(value)} className="flex-1 flex flex-col">
        <div className="border-b px-6 overflow-x-auto">
          <TabsList className="flex h-auto p-1 gap-1">
            <TabsTrigger value="tarefas" className="whitespace-nowrap">
              ✅ Tarefas
            </TabsTrigger>
            <TabsTrigger value="calendario_geral" className="whitespace-nowrap">
              📅 Calendário Geral
            </TabsTrigger>
            <TabsTrigger value="calendario_conteudo" className="whitespace-nowrap">
              🗓️ Calendário de Conteúdo
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
    </div>
  );
}