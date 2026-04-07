import { useState, useEffect } from 'react';
import { Phone, Users, TrendingUp, AlertCircle, Calendar, DollarSign, Clock, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface SheetLead {
  rowIndex?: number;
  NOME?: string;
  Nome?: string;
  TELEFONE?: string;
  Telefone?: string;
  ORIGEM?: string;
  Origem?: string;
  'Observação Gerais'?: string;
  'OBSERVAÇÃO GERAIS'?: string;
  ENTRADA?: string;
  Entrada?: string;
  'Fecho data'?: string;
  'FECHO DATA'?: string;
  'Fecho total'?: string;
  'FECHO TOTAL'?: string;
}

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxvV43itM27KtWm8gM4T_TG3ZYEtKHNR8s2JSHx-BaN75sDNx6S4k-e3grrMGMPCt2f/exec';
const VALOR_MATRICULA = 109.90;

export function SheetsLeads() {
  const [leads, setLeads] = useState<SheetLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrigem, setSelectedOrigem] = useState('Todos');

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch(SHEET_API_URL);
      const result = await response.json();
      
      if (result.success) {
        setLeads(result.data);
      }
    } catch (error) {
      console.error('Erro ao buscar leads:', error);
      toast.error('Erro ao buscar leads da planilha');
    } finally {
      setLoading(false);
    }
  };

  const updateObservacoes = async (lead: SheetLead, novasObservacoes: string) => {
    try {
      await fetch(SHEET_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          rowIndex: lead.rowIndex,
          observacoes: novasObservacoes
        })
      });
      toast.success('Observações atualizadas');
      fetchLeads();
    } catch (error) {
      console.error('Erro ao atualizar lead:', error);
      toast.error('Erro ao atualizar observações');
    }
  };

  const marcarFechado = async (lead: SheetLead) => {
    const dataFecho = new Date().toLocaleDateString('pt-BR');
    try {
      await fetch(SHEET_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          rowIndex: lead.rowIndex,
          fechoData: dataFecho
        })
      });
      toast.success('Lead marcado como fechado');
      fetchLeads();
    } catch (error) {
      console.error('Erro ao marcar como fechado:', error);
      toast.error('Erro ao marcar como fechado');
    }
  };

  const openWhatsApp = (telefone: string, nome: string) => {
    const numeroLimpo = telefone.toString().replace(/\D/g, '');
    const mensagem = encodeURIComponent(`Olá ${nome}, tudo bem? Sou o closer e gostaria de conversar sobre sua proposta.`);
    window.open(`https://wa.me/55${numeroLimpo}?text=${mensagem}`, '_blank');
  };

  const origensUnicas = ['Todos', ...new Set(leads.map(l => l.Origem || l.ORIGEM).filter(Boolean) as string[])];
  
  const filteredLeads = selectedOrigem === 'Todos' 
    ? leads 
    : leads.filter(lead => (lead.Origem || lead.ORIGEM) === selectedOrigem);

  const leadsProntos = filteredLeads.filter(l => !l['Fecho data'] && !l['FECHO DATA']);
  const leadsFechados = filteredLeads.filter(l => l['Fecho data'] || l['FECHO DATA']);
  const leadsNaMesa = leadsProntos;
  const valorNaMesa = leadsNaMesa.length * VALOR_MATRICULA;

  const stats = {
    total: leads.length,
    prontos: leadsProntos.length,
    naMesa: leadsNaMesa.length,
    valorNaMesa: valorNaMesa,
    fechados: leadsFechados.length,
    valorFechado: leadsFechados.length * VALOR_MATRICULA
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading && leads.length === 0) {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const LeadCard = ({ lead, isFechado = false }: { lead: SheetLead; isFechado?: boolean }) => {
    const nome = lead.NOME || lead.Nome || 'Nome não informado';
    const telefone = lead.TELEFONE || lead.Telefone || '';
    const origem = lead.ORIGEM || lead.Origem || '';
    const observacoes = lead['Observação Gerais'] || lead['OBSERVAÇÃO GERAIS'] || '';
    const entrada = lead.ENTRADA || lead.Entrada || '';
    const fechoData = lead['Fecho data'] || lead['FECHO DATA'] || '';
    const naMesa = !fechoData;

    return (
      <Card className={`transition-shadow hover:shadow-lg ${
        isFechado ? 'border-l-4 border-l-green-500' : 
        naMesa ? 'border-l-4 border-l-orange-500' : 
        'border-l-4 border-l-primary'
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground">{nome}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {origem && (
                  <Badge variant="secondary">{origem}</Badge>
                )}
                {naMesa && (
                  <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">💰 Na Mesa</Badge>
                )}
                {isFechado && (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">✓ Fechado</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {telefone && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Phone size={16} className="mr-2 flex-shrink-0" />
                <span className="truncate">{telefone}</span>
              </div>
            )}
            {entrada && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar size={16} className="mr-2 flex-shrink-0" />
                <span className="truncate">Entrada: {entrada}</span>
              </div>
            )}
            {naMesa && (
              <div className="flex items-center text-sm text-orange-600 font-semibold bg-orange-50 p-2 rounded">
                <DollarSign size={16} className="mr-2 flex-shrink-0" />
                <span>Valor: R$ 109,90</span>
              </div>
            )}
            {fechoData && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar size={16} className="mr-2 flex-shrink-0" />
                <span className="truncate">Fechado: {fechoData}</span>
              </div>
            )}
            {isFechado && (
              <div className="flex items-center text-sm text-green-600 font-medium bg-green-50 p-2 rounded">
                <DollarSign size={16} className="mr-2 flex-shrink-0" />
                <span>Matrícula: R$ 109,90</span>
              </div>
            )}
          </div>

          {observacoes && (
            <div className="bg-muted rounded p-3 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Observações:</p>
              <p className="text-sm text-foreground">{observacoes}</p>
            </div>
          )}

          <div className="space-y-2">
            {telefone && (
              <Button
                onClick={() => openWhatsApp(telefone, nome)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Phone size={18} className="mr-2" />
                Abrir WhatsApp
              </Button>
            )}

            {!isFechado && (
              <>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    const novaObs = prompt('Adicionar observação:', observacoes);
                    if (novaObs !== null) {
                      updateObservacoes(lead, novaObs);
                    }
                  }}
                >
                  Atualizar Observações
                </Button>

                <Button
                  variant="outline"
                  className="w-full border-green-600 text-green-600 hover:bg-green-50"
                  onClick={() => {
                    if (confirm(`Marcar "${nome}" como FECHADO?`)) {
                      marcarFechado(lead);
                    }
                  }}
                >
                  ✓ Marcar como Fechado
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads Sheets - Closer</h1>
          <p className="text-muted-foreground">Acompanhe os leads prontos para fechar negócio</p>
        </div>
        <Button onClick={fetchLeads} variant="outline" disabled={loading}>
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Leads</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
              <Users className="text-primary" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-400">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-semibold">💰 Na Mesa</p>
                <p className="text-2xl font-bold text-orange-600">{stats.naMesa}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {formatCurrency(stats.valorNaMesa)}
                </p>
                <p className="text-xs text-muted-foreground">{stats.naMesa} × R$ 109,90</p>
              </div>
              <TrendingUp className="text-orange-600" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fechados</p>
                <p className="text-2xl font-bold text-green-600">{stats.fechados}</p>
              </div>
              <TrendingUp className="text-green-600" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Fechado</p>
                <p className="text-xl font-bold text-green-600">
                  R$ {formatCurrency(stats.valorFechado)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{stats.fechados} × R$ 109,90</p>
              </div>
              <DollarSign className="text-green-600" size={32} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {origensUnicas.map(origem => (
              <Button
                key={origem}
                onClick={() => setSelectedOrigem(origem)}
                variant={selectedOrigem === origem ? 'default' : 'outline'}
                size="sm"
              >
                {origem}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leads Na Mesa */}
      {leadsNaMesa.length > 0 && (
        <div>
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 mb-4 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
                  💰 Leads na Mesa
                </h2>
                <p className="text-orange-100">Leads prontos para o closer fechar</p>
              </div>
              <div className="text-right">
                <p className="text-orange-100 text-sm">Valor Total Potencial</p>
                <p className="text-3xl font-bold">
                  R$ {formatCurrency(valorNaMesa)}
                </p>
                <p className="text-orange-200 text-sm mt-1">{leadsNaMesa.length} leads × R$ 109,90</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leadsNaMesa.map((lead, index) => (
              <LeadCard key={`mesa-${index}`} lead={lead} />
            ))}
          </div>
        </div>
      )}

      {/* Leads Fechados */}
      {leadsFechados.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-600" size={28} />
            Leads Fechados ({leadsFechados.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leadsFechados.map((lead, index) => (
              <LeadCard key={index} lead={lead} isFechado={true} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredLeads.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="mx-auto text-muted-foreground mb-4" size={48} />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum lead encontrado
            </h3>
            <p className="text-muted-foreground">
              {selectedOrigem === 'Todos' 
                ? 'Adicione leads na sua planilha para começar.'
                : `Não há leads da origem "${selectedOrigem}".`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
