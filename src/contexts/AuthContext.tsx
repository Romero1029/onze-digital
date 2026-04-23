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

  // Initialize auth
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Defer Supabase calls with setTimeout to prevent deadlock
          setTimeout(async () => {
            const appUser = await getCurrentUser(session.user);
            setUser(appUser);
            await fetchUsers();
            setLoading(false);
          }, 0);
        } else {
          setUser(null);
          setUsers([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        getCurrentUser(session.user).then((appUser) => {
          setUser(appUser);
          fetchUsers().then(() => setLoading(false));
        });
      } else {
        setLoading(false);
      }
    });

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

      // Create user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email.trim().toLowerCase(),
        password: userData.senha,
        options: {
          data: {
            nome: userData.nome,
            cor: userData.cor,
          }
        }
      });

      if (authError) {
        console.error('Signup error:', authError);
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Erro ao criar usuário.' };
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          nome: userData.nome,
          email: userData.email.trim().toLowerCase(),
          cor: userData.cor,
          ativo: true,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        return { success: false, error: 'Erro ao criar perfil do usuário.' };
      }

      // Create user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: userRole,
        });

      if (roleError) {
        console.error('Role creation error:', roleError);
        // Clean up profile if role creation failed
        await supabase.from('profiles').delete().eq('id', authData.user.id);
        return { success: false, error: 'Erro ao definir papel do usuário.' };
      }

      const defaultPermissions = getDefaultPermissions(userRole);
      const { error: permissionsError } = await (supabase as any)
        .from('user_access_permissions')
        .upsert({
          user_id: authData.user.id,
          ...permissionsToRow(defaultPermissions),
        }, { onConflict: 'user_id' });

      if (permissionsError && permissionsError.code !== '42P01') {
        console.error('Permissions creation error:', permissionsError);
        return { success: false, error: 'Erro ao definir permissões do usuário.' };
      }

      await fetchUsers();

      const newUser: AppUser = {
        id: authData.user.id,
        nome: userData.nome,
        email: userData.email.trim().toLowerCase(),
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

      await fetchUsers();

      // Update current user if it's the same
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

      await fetchUsers();

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
      // Delete will cascade to profile and roles due to foreign key setup
      // But we need to delete auth user which requires admin privileges
      // For now, we just deactivate the user
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: false })
        .eq('id', id);

      if (error) {
        console.error('Delete/deactivate error:', error);
        return { success: false, error: error.message };
      }

      await fetchUsers();
      return { success: true };
    } catch (error) {
      console.error('DeleteUser exception:', error);
      return { success: false, error: 'Erro ao excluir usuário.' };
    }
  };

  const getActiveVendedores = (): AppUser[] => {
    return users.filter((u) => u.ativo);
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
