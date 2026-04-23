import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";

export function ProGate({ embedded = false }: { embedded?: boolean } = {}) {
  const card = (
    <div className="flex items-center justify-center px-8 py-16">
      <div className="max-w-md text-center">
        <p className="font-serif text-lg text-earth/80 leading-relaxed mb-8">
          Collections let you group traces by hand. A trip. A year. A mood. Nothing automatic.
        </p>
        <Link href="/settings" className="btn-primary inline-block">
          Go Pro
        </Link>
      </div>
    </div>
  );

  if (embedded) return card;

  return (
    <div className="min-h-[70vh] flex flex-col">
      <PageHeader label="Collections" h1="Curate your traces." tagline="A Pro feature." />
      <div className="flex-1">{card}</div>
    </div>
  );
}
