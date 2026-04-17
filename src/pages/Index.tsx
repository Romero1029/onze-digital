import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LeadsProvider } from '@/contexts/LeadsContext';
import { LoginPage } from '@/components/crm/LoginPage';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { ProfessoraLayout } from '@/components/pedagogico/ProfessoraLayout';
import { Loader2 } from 'lucide-react';

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
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default Index;
