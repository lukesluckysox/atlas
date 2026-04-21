import Link from "next/link";

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center px-8">
      <h1 className="font-serif text-3xl text-earth mb-4">Something went wrong.</h1>
      <p className="font-mono text-sm text-earth/50 mb-8">
        Authentication failed. Try again.
      </p>
      <Link href="/auth/signin" className="btn-primary">
        Back to sign in
      </Link>
    </div>
  );
}
