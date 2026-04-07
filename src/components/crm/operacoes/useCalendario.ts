import { useState, useCallback } from 'react';

export interface CalendarioState {
  currentDate: Date;
  currentMonth: number;
  currentYear: number;
}

export function useCalendario(initialDate?: Date) {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());

  const getDaysInMonth = useCallback((year: number, month: number): Date[] => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
      days.push(new Date(date));
    }

    return days;
  }, []);

  const getWeeksInMonth = useCallback((year: number, month: number): Date[][] => {
    const days = getDaysInMonth(year, month);
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    // Adicionar dias do mês anterior para completar a primeira semana
    const firstDayOfMonth = new Date(year, month, 1);
    const startOfWeek = new Date(firstDayOfMonth);
    startOfWeek.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

    for (let date = new Date(startOfWeek); date < firstDayOfMonth; date.setDate(date.getDate() + 1)) {
      currentWeek.push(new Date(date));
    }

    // Adicionar dias do mês
    days.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    // Adicionar dias do próximo mês para completar a última semana
    if (currentWeek.length > 0) {
      const lastDayOfMonth = new Date(year, month + 1, 0);
      let nextDate = new Date(lastDayOfMonth);
      nextDate.setDate(lastDayOfMonth.getDate() + 1);

      while (currentWeek.length < 7) {
        currentWeek.push(new Date(nextDate));
        nextDate.setDate(nextDate.getDate() + 1);
      }
      weeks.push([...currentWeek]);
    }

    return weeks;
  }, [getDaysInMonth]);

  const mesAnterior = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  }, []);

  const mesProximo = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  }, []);

  const irParaHoje = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  return {
    currentDate,
    currentMonth: currentDate.getMonth(),
    currentYear: currentDate.getFullYear(),
    getDaysInMonth,
    getWeeksInMonth,
    mesAnterior,
    mesProximo,
    irParaHoje,
    setCurrentDate
  };
}