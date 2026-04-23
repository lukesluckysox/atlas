import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";

export function ProGate() {
  return (
    <div className="min-h-[70vh] flex flex-col">
      <PageHeader label="Collections" h1="Curate your traces." tagline="A Pro feature." />
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-md text-center">
          <p className="font-serif text-lg text-earth/80 leading-relaxed mb-8">
            Collections let you group traces by hand. A trip. A year. A mood. Nothing automatic.
          </p>
          <Link href="/settings" className="btn-primary inline-block">
            Go Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
