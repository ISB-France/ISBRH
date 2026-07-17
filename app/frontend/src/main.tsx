import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ColorThemeProvider } from "./contexts/ColorThemeContext";
import { GlobalErrorToast } from "./components/GlobalErrorToast";
import { notifyError, getErrorMessage } from "./lib/errorBus";
import "./globals.css";
import App from "./App";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Filet de securite pour les useQuery sans gestion d'erreur locale
    // (403/404/500 restaient jusqu'ici totalement silencieux pour l'utilisateur).
    onError: (error) => notifyError(getErrorMessage(error)),
  }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ColorThemeProvider>
          <App />
          <GlobalErrorToast />
        </ColorThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
