import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export function NPAResultados() {
  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in pb-20 lg:pb-6 overflow-y-auto h-full">
      <h1 className="text-2xl font-bold">NPA — Resultados</h1>
      <Card className="p-12 bg-card border-border text-center">
        <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Relatórios em breve</h2>
        <p className="text-sm text-muted-foreground">
          Os gráficos de vendas, taxa de conversão por etapa e ranking de responsáveis aparecerão aqui
          conforme os dados do NPA forem acumulados.
        </p>
      </Card>
    </div>
  );
}
