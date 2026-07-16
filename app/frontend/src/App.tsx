import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AuthCallback from "./pages/AuthCallback";
import SSOCallback from "./pages/SSOCallback";
import Dashboard from "./pages/Dashboard";
import Interviews from "./pages/Interviews";
import InterviewDetail from "./pages/InterviewDetail";
import InterviewForm from "./pages/InterviewForm";
import Campaigns from "./pages/Campaigns";
import CampaignForm from "./pages/CampaignForm";
import CampaignDetail from "./pages/CampaignDetail";
import Templates from "./pages/Templates";
import TemplateForm from "./pages/TemplateForm";
import Users from "./pages/Users";
import UserForm from "./pages/UserForm";
import Profile from "./pages/Profile";
import ThemeSync from "./components/ThemeSync";

function App() {
  const token = localStorage.getItem("access_token");
  const ssoToken = new URLSearchParams(window.location.search).get("sso_token");

  // SSO token présent dans l'URL → traitement prioritaire même si déjà connecté
  if (ssoToken) {
    return (
      <Routes>
        <Route path="*" element={<SSOCallback />} />
      </Routes>
    );
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/sso" element={<SSOCallback />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <>
      <ThemeSync />
      <Routes>
        <Route path="/" element={<Dashboard />} />
      <Route path="/interviews" element={<Interviews />} />
      <Route path="/interviews/new" element={<InterviewForm />} />
      <Route path="/interviews/:id" element={<InterviewDetail />} />
      <Route path="/interviews/:id/edit" element={<InterviewForm />} />
      <Route path="/campaigns" element={<Campaigns />} />
      <Route path="/campaigns/new" element={<CampaignForm />} />
      <Route path="/campaigns/:id" element={<CampaignDetail />} />
      <Route path="/campaigns/:id/edit" element={<CampaignForm />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/templates/new" element={<TemplateForm />} />
      <Route path="/templates/:id/edit" element={<TemplateForm />} />
      <Route path="/users" element={<Users />} />
      <Route path="/users/new" element={<UserForm />} />
      <Route path="/users/:id/edit" element={<UserForm />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </>
  );
}

export default App;
