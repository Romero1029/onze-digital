import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AccessPermissions, getDefaultPermissions, normalizePermissionsRow, permissionsToRow } from '@/lib/access-control';

// Types for our app
export type UserRole = 'admin' | 'vendedor' | 'professora';

export interface Profile {
  id: string;
  nome: string;
  email: string;
  cor: string;
  avatar?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  nome: string;
  email: string;
  tipo: UserRole;
  cor: string;
  avatar?: string;
  ativo: boolean;
  criadoEm: string;
  permissions: AccessPermissions;
}

interface AuthContextType {
  user: AppUser | null;
  users: AppUser[];
  loading: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  addUser: (userData: { nome: string; email: string; senha: string; tipo: UserRole; cor: string }) => Promise<{ success: boolean; error?: string; user?: AppUser }>;
  updateUser: (id: string, data: Partial<{ nome: string; cor: string; ativo: boolean; tipo: UserRole }>) => Promise<{ success: boolean; error?: string }>;
  updateUserPermissions: (id: string, permissions: AccessPermissions) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  getActiveVendedores: () => AppUser[];
  getUserById: (id: string) => AppUser | undefined;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissionsRows = async () => {
    const { data, error } = await (supabase as any)
      .from('user_access_permissions')
      .select('*');

    if (error) {
      if (error.code !== '42P01') {
        console.error('Error fetching permissions:', error);
      }
      return [];
    }

    return data || [];
  };

  // Fetch all users (profiles + roles)
  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
      }

      const permissionsRows = await fetchPermissionsRows();

      const appUsers: AppUser[] = (profiles || []).map((profile: Profile) => {
        const userRole = roles?.find((r: { user_id: string; role: UserRole }) => r.user_id === profile.id);
        const permissionsRow = permissionsRows.find((p: { user_id: string }) => p.user_id === profile.id);
        return {
          id: profile.id,
          nome: profile.nome,
          email: profile.email,
          tipo: (userRole?.role as UserRole) || 'vendedor',
          cor: profile.cor,
          avatar: profile.avatar ?? undefined,
          ativo: profile.ativo,
          criadoEm: profile.created_at,
          permissions: normalizePermissionsRow(permissionsRow, userRole?.role),
        };
      });

      setUsers(appUsers);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
    }
  };

  // Get current user profile and role
  const getCurrentUser = async (authUser: User) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      if (!profile) {
        return null;
      }

      // Check if user is active
      if (!profile.ativo) {
        await supabase.auth.signOut();
        return null;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      const { data: permissionsRow, error: permissionsError } = await (supabase as any)
        .from('user_access_permissions')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (permissionsError && permissionsError.code !== '42P01') {
        console.error('Error fetching permissions:', permissionsError);
      }

      const appUser: AppUser = {
        id: profile.id,
        nome: profile.nome,
        email: profile.email,
        tipo: (roleData?.role as UserRole) || 'vendedor',
        cor: profile.cor,
        avatar: profile.avatar ?? undefined,
        ativo: profile.ativo,
        criadoEm: profile.created_at,
        permissions: normalizePermissionsRow(permissionsRow, roleData?.role),
      };

      return appUser;
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      return null;
    }
  };

  // Initialize auth — single path via onAuthStateChange com INITIAL_SESSION
  useEffect(() => {
    let initialised = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);

        // INITIAL_SESSION dispara na montagem com a sessão existente ou null.
        // Eventos subsequentes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) atualizam.
        if (session?.user) {
          // Defer com setTimeout para evitar deadlock interno do Supabase SDK
          setTimeout(async () => {
            const appUser = await getCurrentUser(session.user);
            setUser(appUser);
            if (!initialised) {
              await fetchUsers();
              initialised = true;
            }
            setLoading(false);
          }, 0);
        } else {
          setUser(null);
          setUsers([]);
          setLoading(false);
          initialised = true;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, senha: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      if (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        const appUser = await getCurrentUser(data.user);
        if (!appUser) {
          await supabase.auth.signOut();
          return { success: false, error: 'Usuário não encontrado ou inativo.' };
        }
        setUser(appUser);
        await fetchUsers();
        return { success: true };
      }

      return { success: false, error: 'Erro desconhecido no login.' };
    } catch (error) {
      console.error('Login exception:', error);
      return { success: false, error: 'Erro ao fazer login.' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUsers([]);
  };

  const addUser = async (userData: { nome: string; email: string; senha: string; tipo: UserRole; cor: string }): Promise<{ success: boolean; error?: string; user?: AppUser }> => {
    try {
      // Check if this is the first user (should be admin)
      const isFirstUser = users.length === 0;
      const userRole = isFirstUser ? 'admin' : userData.tipo;
      const email = userData.email.trim().toLowerCase();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        return { success: false, error: 'Sessao expirada. Entre novamente e tente de novo.' };
      }

      const createResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: userData.nome,
          email,
          password: userData.senha,
          tipo: userRole === 'admin' ? 'admin' : 'vendedor',
          cor: userData.cor,
        }),
      });

      let createdData: any = null;
      let functionErrorMessage = '';

      try {
        createdData = await createResponse.clone().json();
        functionErrorMessage = createdData?.error || '';
      } catch {
        functionErrorMessage = await createResponse.clone().text();
      }

      const createdUserId = createdData?.user?.id;

      if (!createResponse.ok || !createdData?.success || !createdUserId) {
        console.error('Admin create user error:', createResponse.status, createdData || functionErrorMessage);
        return {
          success: false,
          error: functionErrorMessage || `Erro ao criar usuario. Status ${createResponse.status}.`,
        };
      }

      const defaultPermissions = getDefaultPermissions(userRole);
      const { error: permissionsError } = await (supabase as any)
        .from('user_access_permissions')
        .upsert({
          user_id: createdUserId,
          ...permissionsToRow(defaultPermissions),
        }, { onConflict: 'user_id' });

      if (permissionsError && permissionsError.code !== '42P01') {
        console.error('Permissions creation error:', permissionsError);
        return { success: false, error: 'Erro ao definir permissões do usuário.' };
      }

      await fetchUsers();

      const newUser: AppUser = {
        id: createdUserId,
        nome: userData.nome,
        email,
        tipo: userRole,
        cor: userData.cor,
        ativo: true,
        criadoEm: new Date().toISOString(),
        permissions: defaultPermissions,
      };

      return { success: true, user: newUser };
    } catch (error) {
      console.error('AddUser exception:', error);
      return { success: false, error: 'Erro ao adicionar usuário.' };
    }
  };

  const updateUser = async (id: string, data: Partial<{ nome: string; cor: string; ativo: boolean; tipo: UserRole }>): Promise<{ success: boolean; error?: string }> => {
    try {
      // Update profile if nome, cor, or ativo changed
      const profileUpdates: Partial<{ nome: string; cor: string; ativo: boolean }> = {};
      if (data.nome !== undefined) profileUpdates.nome = data.nome;
      if (data.cor !== undefined) profileUpdates.cor = data.cor;
      if (data.ativo !== undefined) profileUpdates.ativo = data.ativo;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', id);

        if (profileError) {
          console.error('Profile update error:', profileError);
          return { success: false, error: profileError.message };
        }
      }

      // Update role if tipo changed
      if (data.tipo !== undefined) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: data.tipo })
          .eq('user_id', id);

        if (roleError) {
          console.error('Role update error:', roleError);
          return { success: false, error: roleError.message };
        }
      }

      // Atualiza state local cirurgicamente
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
      if (user?.id === id) {
        setUser((prev) => prev ? { ...prev, ...data } : null);
      }

      return { success: true };
    } catch (error) {
      console.error('UpdateUser exception:', error);
      return { success: false, error: 'Erro ao atualizar usuário.' };
    }
  };

  const updateUserPermissions = async (id: string, permissions: AccessPermissions): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await (supabase as any)
        .from('user_access_permissions')
        .upsert({
          user_id: id,
          ...permissionsToRow(permissions),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Permissions update error:', error);
        return { success: false, error: error.message };
      }

      // Atualiza state local cirurgicamente
      setUsers(prev => prev.map(u => u.id === id ? { ...u, permissions } : u));
      if (user?.id === id) {
        setUser((prev) => prev ? { ...prev, permissions } : prev);
      }

      return { success: true };
    } catch (error) {
      console.error('UpdateUserPermissions exception:', error);
      return { success: false, error: 'Erro ao atualizar permissões do usuário.' };
    }
  };

  const deleteUser = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: false })
        .eq('id', id);

      if (error) {
        console.error('Delete/deactivate error:', error);
        return { success: false, error: error.message };
      }

      // Também invalida sessões ativas do usuário via edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: id }),
        }).catch(e => console.warn('admin-delete-user call failed:', e));
      }

      // Atualiza state local cirurgicamente sem refetch completo
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ativo: false } : u));
      return { success: true };
    } catch (error) {
      console.error('DeleteUser exception:', error);
      return { success: false, error: 'Erro ao desativar usuário.' };
    }
  };

  const getActiveVendedores = (): AppUser[] => {
    return users.filter((u) => u.ativo && (u.tipo === 'vendedor' || u.tipo === 'admin'));
  };

  const getUserById = (id: string): AppUser | undefined => {
    return users.find((u) => u.id === id);
  };

  const refreshUsers = async () => {
    await fetchUsers();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        loading,
        login,
        logout,
        addUser,
        updateUser,
        updateUserPermissions,
        deleteUser,
        getActiveVendedores,
        getUserById,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
