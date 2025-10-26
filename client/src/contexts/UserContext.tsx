import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

// Role types matching backend
export type Role = 'ADMIN' | 'PROD_PLAN' | 'PROD_RUN' | 'SALES_OPS' | 'ACCOUNTING';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  hasRole: (...roles: Role[]) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['/api/me'],
    retry: false,
    queryFn: async () => {
      const res = await fetch('/api/me', {
        credentials: 'include',
      });
      
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error('Failed to fetch user');
      }
      
      return res.json();
    },
  });

  const hasRole = (...roles: Role[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <UserContext.Provider value={{ user: user ?? null, isLoading, hasRole }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
