-- Setup script for new Supabase instance
-- Run this in the Supabase SQL Editor

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor');

-- Create profiles table for user metadata
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#A93356',
  avatar TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (security best practice - roles separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'vendedor',
  UNIQUE (user_id, role)
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  origem TEXT NOT NULL CHECK (origem IN ('Direto', 'Lancamento', 'NPA')),
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'sdr', 'closer', 'matricula', 'handoff_rodrygo', 'follow_up_01', 'follow_up_02', 'follow_up_03', 'aquecimento')),
  responsavel_id UUID REFERENCES auth.users(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tarefas table
CREATE TABLE public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'a_fazer' CHECK (status IN ('a_fazer', 'em_andamento', 'concluido')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  responsavel_id UUID REFERENCES auth.users(id),
  prazo TIMESTAMP WITH TIME ZONE,
  categoria TEXT NOT NULL DEFAULT 'geral',
  pagina TEXT NOT NULL DEFAULT 'dashboard',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create turmas table
CREATE TABLE public.turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    'vendedor'::app_role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for leads
CREATE POLICY "Users can view leads they are responsible for" ON public.leads
  FOR SELECT USING (auth.uid() = responsavel_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert leads" ON public.leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update leads they are responsible for" ON public.leads
  FOR UPDATE USING (auth.uid() = responsavel_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all leads" ON public.leads
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for tarefas
CREATE POLICY "Users can view tasks they are responsible for" ON public.tarefas
  FOR SELECT USING (auth.uid() = responsavel_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert tasks" ON public.tarefas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update tasks they are responsible for" ON public.tarefas
  FOR UPDATE USING (auth.uid() = responsavel_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all tasks" ON public.tarefas
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for turmas
CREATE POLICY "Anyone can view active turmas" ON public.turmas
  FOR SELECT USING (ativo = true);

CREATE POLICY "Admins can manage turmas" ON public.turmas
  FOR ALL USING (has_role(auth.uid(), 'admin'));