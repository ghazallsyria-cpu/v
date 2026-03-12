import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "teacher" | "student" | "parent";

export interface User {
  id: string;
  full_name: string;
  national_id: string;
  role: UserRole;
  class_id?: string;
  password_hash?: string;
  zoom_link?: string;
  notes?: string;
}

interface AuthContextType {
  user: User | null;
  login: (national_id: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("school_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem("school_user"); }
    }
  }, []);

  const login = async (national_id: string, password: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, national_id, role, class_id, password_hash, zoom_link, notes")
      .eq("national_id", national_id)
      .single();
    if (error || !data) return { error: "الحساب غير موجود" };
    if (data.password_hash !== password) return { error: "كلمة المرور غير صحيحة" };
    const userData: User = {
      id: data.id,
      full_name: data.full_name,
      national_id: data.national_id,
      role: data.role as UserRole,
      class_id: data.class_id,
      password_hash: data.password_hash,
      zoom_link: data.zoom_link,
      notes: data.notes,
    };
    setUser(userData);
    localStorage.setItem("school_user", JSON.stringify(userData));
    return {};
  };

  const logout = () => { setUser(null); localStorage.removeItem("school_user"); };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem("school_user", JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
