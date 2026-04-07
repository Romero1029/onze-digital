import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LeadsProvider } from '@/contexts/LeadsContext';
import { LoginPage } from '@/components/crm/LoginPage';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Loader2 } from 'lucide-react';

function CRMContent() {
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
  
  if (!user) {
    return <LoginPage />;
  }
  
  return (
    <LeadsProvider>
      <CRMLayout />
    </LeadsProvider>
  );
}

const Index = () => {
  return (
    <AuthProvider>
      <CRMContent />
    </AuthProvider>
  );
};

export default Index;
