import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = anon, obj = logged
  const [token, setToken] = useState(localStorage.getItem("wc_token"));

  useEffect(() => {
    const t = localStorage.getItem("wc_token");
    if (!t) {
      setUser(false);
      return;
    }
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => {
        localStorage.removeItem("wc_token");
        setUser(false);
      });
  }, []);

  const applyAuth = (data) => {
    localStorage.setItem("wc_token", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const login = async (telefone, senha) => {
    const { data } = await api.post("/auth/login", { telefone, senha });
    applyAuth(data);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    applyAuth(data);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("wc_token");
    setToken(null);
    setUser(false);
  };

  const refreshMe = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshMe, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
