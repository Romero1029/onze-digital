import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LeadsProvider } from '@/contexts/LeadsContext';
import { LoginPage } from '@/components/crm/LoginPage';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { ProfessoraLayout } from '@/components/pedagogico/ProfessoraLayout';
import { Loader2 } from 'lucide-react';
import React from 'react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-lg w-full space-y-4 text-center">
            <p className="text-xl font-bold text-red-600">Erro ao carregar o app</p>
            <pre className="text-xs text-left bg-muted p-4 rounded overflow-auto max-h-64 text-red-700">{this.state.error.message}{'\n'}{this.state.error.stack}</pre>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded">Recarregar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // Professoras têm acesso apenas ao módulo pedagógico
  if (user.tipo === 'professora') return <ProfessoraLayout />;

  return (
    <LeadsProvider>
      <CRMLayout />
    </LeadsProvider>
  );
}

const Index = () => (
  <ErrorBoundary>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </ErrorBoundary>
);

export default Index;
