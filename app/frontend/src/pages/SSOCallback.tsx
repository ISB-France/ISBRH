import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import LoginLoadingScreen from "../components/LoginLoadingScreen";

export default function SSOCallback() {
  const [params] = useSearchParams();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const token = params.get("sso_token");
    if (!token) {
      window.location.href = "/login?error=missing_sso_token";
      return;
    }

    axios
      .post("/api/auth/sso/", { token })
      .then((res) => {
        localStorage.setItem("access_token", res.data.access);
        localStorage.setItem("refresh_token", res.data.refresh);
        window.location.href = "/";
      })
      .catch(() => {
        window.location.href = "/login?error=sso_failed";
      });
  }, [params]);

  return <LoginLoadingScreen />;
}
