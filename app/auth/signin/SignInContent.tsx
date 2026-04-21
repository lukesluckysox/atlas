"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SignInContent() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/home" });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn("email", { email, callbackUrl: "/home", redirect: false });
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-sm">
        <Link href="/" className="block font-serif text-3xl text-earth mb-16 text-center">
          Atlas
        </Link>

        {error && (
          <div className="mb-8 p-4 border border-terracotta/40 bg-terracotta/10">
            <p className="font-mono text-xs text-terracotta">
              Something went wrong. Try again.
            </p>
          </div>
        )}

        {sent ? (
          <div className="text-center">
            <p className="font-mono text-xs text-earth/60 leading-relaxed">
              Check your email. A sign-in link has been sent.
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleGoogleSignIn}
              className="w-full btn-primary mb-4 flex items-center justify-center gap-3"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-earth/10" />
              <span className="font-mono text-xs text-earth/30">or</span>
              <div className="flex-1 h-px bg-earth/10" />
            </div>

            <form onSubmit={handleEmailSignIn}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field mb-6"
              />
              <button type="submit" className="w-full btn-secondary">
                Continue with email
              </button>
            </form>
          </>
        )}

        <p className="font-mono text-xs text-earth/30 text-center mt-12 leading-relaxed">
          Free to start. No card required.
        </p>
      </div>
    </div>
  );
}
