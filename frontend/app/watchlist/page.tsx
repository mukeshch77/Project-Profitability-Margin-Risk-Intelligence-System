"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/nav";
import { getWatchlist } from "../../lib/api";

type Row = Record<string, unknown>;

export default function WatchlistPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getWatchlist()
      .then((data) => setRows(data.rows))
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <div>
      <Nav />
      <section className="panel p-4 animate-rise">
        <h2 className="text-lg font-semibold">Critical Project Watchlist</h2>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left">
                <th className="p-2">Budget</th>
                <th className="p-2">Actual Cost</th>
                <th className="p-2">Risk Probability</th>
                <th className="p-2">Alert Level</th>
                <th className="p-2">Root Causes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-ink/10 align-top">
                  <td className="p-2">{Number(r.budget ?? 0).toLocaleString()}</td>
                  <td className="p-2">{Number(r.actual_cost ?? 0).toLocaleString()}</td>
                  <td className="p-2">{(Number(r.risk_probability ?? 0) * 100).toFixed(1)}%</td>
                  <td className="p-2 font-medium">{String(r.alert_level ?? "")}</td>
                  <td className="p-2">{String(r.root_causes ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
