import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, LogOut } from 'lucide-react';
import { Pedagogico } from './Pedagogico';

export function ProfessoraLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header mínimo */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-100">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
          </div>
          <span className="font-bold text-gray-800 text-sm">Instituto 11DS — Pedagógico</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block">{user?.nome}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 overflow-hidden">
        <div className="h-[calc(100vh-57px)] overflow-y-auto">
          <Pedagogico />
        </div>
      </main>
    </div>
  );
}
