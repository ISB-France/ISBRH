import { NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Users, FileText, LogOut, Menu, X, FileEdit, Flag, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn, formatDate } from "../lib/utils";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Separator } from "./ui/separator";
import api from "../api";
import type { Notification as NotifType, User } from "../types";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/interviews", icon: FileText, label: "Entretiens" },
  { to: "/campaigns", icon: Flag, label: "Campagnes", role: "rh" },
  { to: "/templates", icon: FileEdit, label: "Modèles", role: "rh" },
  { to: "/users", icon: Users, label: "Utilisateurs" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: user } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me/").then((r) => r.data),
  });

  const { data: notifications } = useQuery<NotifType[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications/").then((r) => r.data),
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleNotifClick = async (n: NotifType) => {
    if (!n.is_read) {
      await api.post(`/notifications/${n.id}/mark-read/`);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    setNotifOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    await api.post("/notifications/mark-all-read/");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleLogout = async () => {
    const refresh = localStorage.getItem("refresh_token");
    if (refresh) {
      await api.post("/auth/logout/", { refresh }).catch(() => {});
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || user.email[0].toUpperCase()
    : "?";

  return (
    <div className="flex min-h-screen bg-[#FDFAF5]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary text-white transition-transform",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex flex-col items-start gap-2 px-6 py-6">
          <img src="/logo-white.png" alt="ISB France" className="h-8 w-auto" />
          <span className="font-display text-2xl font-semibold text-primary-foreground">ISBRH</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems
            .filter((item) => !item.role || user?.role === item.role || (item.role === "rh" && user?.role === "admin"))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
        </nav>
        <Separator className="bg-white/10" />
        <div className="p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-[#FDFAF5] px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex-1" />

          <div className="relative" ref={notifRef}>
            <button className="relative p-2 text-muted-foreground hover:text-foreground" onClick={() => setNotifOpen(!notifOpen)}>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <button className="text-xs text-primary-foreground hover:underline" onClick={handleMarkAllRead}>
                      Tout marquer lu
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications?.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Aucune notification
                    </div>
                  )}
                  {notifications?.map((n) => (
                    <button
                      key={n.id}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 ${!n.is_read ? "bg-primary-foreground/5 font-medium" : ""}`}
                      onClick={() => handleNotifClick(n)}
                    >
                      <div className={!n.is_read ? "text-foreground" : "text-muted-foreground"}>
                        {n.message}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDate(n.created_at)} à {new Date(n.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="flex items-center gap-3 hover:opacity-80" onClick={() => navigate("/profile")}>
            <span className="text-sm text-muted-foreground">
              {user?.first_name} {user?.last_name}
            </span>
            <Avatar className="h-8 w-8">
              {user?.photo ? (
                <img src={user.photo} alt="" className="h-full w-full rounded-full object-cover" />
              ) : user?.icon ? (
                <span className="flex h-full w-full items-center justify-center text-lg">{user.icon}</span>
              ) : (
                <AvatarFallback className="text-xs font-semibold bg-primary-foreground text-primary">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>
          </button>
        </header>
        <main className="min-w-0 flex-1 bg-background p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
