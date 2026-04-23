"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "signin" | "signup";

export default function SignInContent() {
  const [mode, setMode] = useState<Mode>("signin");
  const [identifier, setIdentifier] = useState(""); // username or email
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const urlError = searchParams.get("error");

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/home" });
  };

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        identifier,
        password,
        redirect: false,
      });
      if (res?.error) {
        setFormError("Invalid username/email or password.");
      } else if (res?.ok) {
        router.push("/home");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Could not create account.");
        return;
      }
      // Auto-sign-in with the credentials they just created
      const login = await signIn("credentials", {
        identifier: email,
        password,
        redirect: false,
      });
      if (login?.ok) {
        router.push("/home");
      } else {
        // Account created but sign-in failed — send them to sign-in mode
        setMode("signin");
        setIdentifier(email);
        setPassword("");
      }
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn("email", {
      email: magicEmail,
      callbackUrl: "/home",
      redirect: false,
    });
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block font-serif text-3xl text-earth mb-3 text-center"
        >
          Trace
        </Link>
        <p className="font-mono text-[11px] text-earth/50 text-center leading-relaxed mb-8 px-4">
          Trace the sights, sounds, moments, and meanings that shape a life.
        </p>


        {(urlError || formError) && (
          <div className="mb-6 p-3 border border-terracotta/40 bg-terracotta/10">
            <p className="font-mono text-xs text-terracotta">
              {formError || "Something went wrong. Try again."}
            </p>
          </div>
        )}

        {sent ? (
          <div className="text-center py-8">
            <p className="font-mono text-xs text-earth/60 leading-relaxed">
              Check your email. A sign-in link has been sent.
            </p>
            <button
              onClick={() => setSent(false)}
              className="font-mono text-xs text-earth/40 underline mt-4"
            >
              Back
            </button>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div className="flex border border-earth/15 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setFormError(null);
                }}
                className={`flex-1 py-2 font-mono text-xs tracking-wide transition-colors ${
                  mode === "signin"
                    ? "bg-earth text-parchment"
                    : "text-earth/60 hover:text-earth"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setFormError(null);
                }}
                className={`flex-1 py-2 font-mono text-xs tracking-wide transition-colors ${
                  mode === "signup"
                    ? "bg-earth text-parchment"
                    : "text-earth/60 hover:text-earth"
                }`}
              >
                Create account
              </button>
            </div>

            {mode === "signin" ? (
              <form onSubmit={handleCredentialsSignIn} className="space-y-4">
                <div>
                  <label className="label block mb-2">Username or email</label>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="yourname or your@email.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label block mb-2">Password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="input-field"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary disabled:opacity-40"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="label block mb-2">Username</label>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="yourname"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase())
                    }
                    required
                    minLength={3}
                    maxLength={24}
                    pattern="[a-z0-9_]{3,24}"
                    className="input-field"
                  />
                  <p className="font-mono text-[10px] text-earth/30 mt-1">
                    3–24 chars. lowercase, numbers, underscores.
                  </p>
                </div>
                <div>
                  <label className="label block mb-2">Email</label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label block mb-2">Password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="at least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="input-field"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary disabled:opacity-40"
                >
                  {loading ? "Creating..." : "Create account"}
                </button>
              </form>
            )}

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-earth/10" />
              <span className="font-mono text-xs text-earth/30">or</span>
              <div className="flex-1 h-px bg-earth/10" />
            </div>

            <button
              onClick={handleGoogleSignIn}
              className="w-full btn-secondary mb-3 flex items-center justify-center gap-3"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            <details className="mt-3">
              <summary className="font-mono text-xs text-earth/40 cursor-pointer text-center hover:text-earth/70 transition-colors">
                Or use a magic link
              </summary>
              <form onSubmit={handleMagicLink} className="mt-4 space-y-3">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  required
                  className="input-field"
                />
                <button type="submit" className="w-full btn-secondary text-xs">
                  Email me a sign-in link
                </button>
              </form>
            </details>
          </>
        )}

        <p className="font-mono text-xs text-earth/30 text-center mt-10 leading-relaxed">
          Free to start. No card required.
        </p>
      </div>
    </div>
  );
}
