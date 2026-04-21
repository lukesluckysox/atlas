import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "Server auth is misconfigured. Check NEXTAUTH_SECRET and NEXTAUTH_URL env vars.",
  AccessDenied: "Access denied.",
  Verification: "This sign-in link is no longer valid or has expired.",
  OAuthSignin: "Could not start OAuth flow. Check your OAuth credentials.",
  OAuthCallback: "OAuth callback failed. Check the redirect URI in your provider.",
  OAuthCreateAccount:
    "Could not create an account from OAuth. Possibly a DB or migration issue.",
  EmailCreateAccount: "Could not create an account.",
  Callback: "Callback error — usually a DB/adapter issue.",
  OAuthAccountNotLinked:
    "This email is already linked to a different provider. Sign in with the original method.",
  EmailSignin: "Could not send the sign-in email. Check SMTP settings.",
  CredentialsSignin:
    "Invalid username/email or password. (Check the credentials and try again.)",
  SessionRequired: "You need to be signed in to view this page.",
  Default: "Authentication failed. Try again.",
};

export default function ErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const code = searchParams?.error || "Default";
  const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center px-8">
      <h1 className="font-serif text-3xl text-earth mb-4">Something went wrong.</h1>
      <p className="font-mono text-sm text-earth/60 mb-2 max-w-md text-center leading-relaxed">
        {message}
      </p>
      <p className="font-mono text-[10px] text-earth/30 tracking-widest mb-8 uppercase">
        Code: {code}
      </p>
      <Link href="/auth/signin" className="btn-primary">
        Back to sign in
      </Link>
    </div>
  );
}
