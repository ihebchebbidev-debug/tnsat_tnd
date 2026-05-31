import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLang } from "@/store/LangContext";
import { setAuth } from "@/store/store";
import { apiLogin } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import tnsatLogo from "@/assets/tnsat-logo.png";

const Login = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    setLoading(true);
    try {
      const res = await apiLogin(trimmedEmail, trimmedPassword);
      if (res.success) {
        if (res.type === "admin") {
          setAuth({ type: "admin" });
          navigate("/admin");
        } else if (res.type === "reseller" && res.reseller) {
          setAuth({ type: "reseller", resellerId: res.reseller.id });
          navigate("/reseller");
        } else if (res.type === "client" && res.client) {
          setAuth({ type: "client", clientId: res.client.id });
          navigate("/client");
        }
      }
    } catch {
      toast({ title: t("error"), description: t("loginError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(220, 20%, 96%) 0%, hsl(228, 30%, 93%) 50%, hsl(220, 20%, 96%) 100%)" }}>
      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] sm:w-[600px] sm:h-[600px] rounded-full blur-[150px] sm:blur-[180px] animate-pulse"
          style={{
            background: "hsl(228, 76%, 52%, 0.12)",
            top: "-10%",
            left: "-10%",
            animationDuration: "4s",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] rounded-full blur-[130px] sm:blur-[160px] animate-pulse"
          style={{
            background: "hsl(260, 70%, 58%, 0.1)",
            bottom: "-15%",
            right: "-10%",
            animationDuration: "6s",
            animationDelay: "1s",
          }}
        />
        <div
          className="absolute w-[250px] h-[250px] sm:w-[300px] sm:h-[300px] rounded-full blur-[100px] sm:blur-[120px] animate-pulse"
          style={{
            background: "hsl(196, 80%, 50%, 0.08)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            animationDuration: "5s",
            animationDelay: "2s",
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(228,76%,52%) 1px, transparent 1px), linear-gradient(90deg, hsl(228,76%,52%) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-[400px] mx-4 my-6">
        <div className="bg-white border border-border rounded-2xl p-6 sm:p-8 md:p-10 shadow-[0_8px_60px_-12px_hsl(228,76%,52%,0.15)]">
          {/* Logo */}
          <div className="flex justify-center mb-8 sm:mb-10">
            <Link to="/">
              <img
                src={tnsatLogo}
                alt="TNSAT"
                className="h-20 sm:h-24 w-auto drop-shadow-[0_0_20px_hsl(228,76%,52%,0.2)] hover:drop-shadow-[0_0_30px_hsl(228,76%,52%,0.35)] transition-all duration-500"
              />
            </Link>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4 sm:gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                {t("email")}
              </label>
              <input
                type="email"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full h-11 sm:h-12 rounded-xl px-4 text-sm text-foreground bg-secondary/60 border border-border placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 focus:bg-white transition-all duration-300"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                {t("password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-11 sm:h-12 rounded-xl px-4 pe-12 text-sm text-foreground bg-secondary/60 border border-border placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 focus:bg-white transition-all duration-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 sm:mt-3 w-full h-11 sm:h-12 rounded-xl flex items-center justify-center gap-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wide uppercase shadow-[0_4px_20px_hsl(228,76%,52%,0.25)] hover:shadow-[0_6px_30px_hsl(228,76%,52%,0.35)] transition-all duration-300 disabled:opacity-50 group"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {t("loginButton")}
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
