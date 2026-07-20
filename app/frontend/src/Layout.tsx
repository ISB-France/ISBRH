import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "./api";
import type { User } from "./types";

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const { data: user } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me/").then((r) => r.data),
  });

  const handleLogout = async () => {
    const refresh = localStorage.getItem("refresh_token");
    if (refresh) {
      await api.post("/auth/logout/", { refresh }).catch(() => {});
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>WorkIsBeautiful</h2>
        <nav>
          <NavLink to="/" end>Tableau de bord</NavLink>
          <NavLink to="/interviews">Entretiens</NavLink>
          {(user?.role === "rh" || user?.role === "admin") && <NavLink to="/users">Utilisateurs</NavLink>}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span />
          <div className="topbar-user">
            <span>{user?.first_name} {user?.last_name}</span>
            <button className="btn btn-outline" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
