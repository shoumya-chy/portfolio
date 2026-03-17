"use client";

import { useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import type { Keyword } from "@/lib/types";

interface Props {
  keywords: Keyword[];
  blurred?: boolean;
}

type SortKey = "query" | "impressions" | "clicks" | "ctr" | "position";

export function KeywordTable({ keywords, blurred = false }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 20;

  const sorted = [...keywords].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string") return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const paginated = sorted.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(sorted.length / perPage);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} className="opacity-40" />;

  const cols: { key: SortKey; label: string; align?: string }[] = [
    { key: "query", label: "Keyword" },
    { key: "impressions", label: "Impressions", align: "text-right" },
    { key: "clicks", label: "Clicks", align: "text-right" },
    { key: "ctr", label: "CTR %", align: "text-right" },
    { key: "position", label: "Position", align: "text-right" },
  ];

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {cols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`px-4 py-3 font-medium text-[var(--color-text-dim)] cursor-pointer hover:text-[var(--color-text)] transition-colors ${col.align || "text-left"}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon k={col.key} />
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 font-medium text-[var(--color-text-dim)] text-center">Source</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((kw, i) => (
              <tr key={i} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-card-hover)] transition-colors">
                <td className={`px-4 py-3 font-mono text-xs ${blurred ? "blur-sm select-none" : ""}`}>{kw.query}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${blurred ? "blur-sm select-none" : ""}`}>{kw.impressions.toLocaleString()}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${blurred ? "blur-sm select-none" : ""}`}>{kw.clicks.toLocaleString()}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${blurred ? "blur-sm select-none" : ""}`}>{kw.ctr}%</td>
                <td className={`px-4 py-3 text-right tabular-nums ${blurred ? "blur-sm select-none" : ""}`}>{kw.position}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-md border"
                    style={{
                      color: kw.source === "gsc" ? "var(--color-accent)" : "var(--color-green)",
                      borderColor: kw.source === "gsc" ? "var(--color-accent)" : "var(--color-green)",
                    }}
                  >
                    {kw.source.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-text-dim)]">
            {sorted.length} keywords · Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs border border-[var(--color-border)] rounded-md hover:bg-[var(--color-bg-card-hover)] disabled:opacity-30 transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-xs border border-[var(--color-border)] rounded-md hover:bg-[var(--color-bg-card-hover)] disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
