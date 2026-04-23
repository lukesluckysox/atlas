"use client";

import { Download, Printer } from "lucide-react";

// Client-side buttons for the Export page. JSON link is a plain download;
// Print opens the browser print dialog against the current page.

export default function ExportControls({ total }: { total: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href="/api/export?format=json"
        className="btn-primary flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        Download JSON ({total})
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="btn-secondary flex items-center gap-2"
      >
        <Printer className="w-4 h-4" />
        Print or Save as PDF
      </button>
      <p className="text-xs text-earth/50 font-mono leading-relaxed">
        JSON is your full copy. Print uses the browser dialog \u2014 choose
        &ldquo;Save as PDF&rdquo; there for a paper-ready record.
      </p>
    </div>
  );
}
