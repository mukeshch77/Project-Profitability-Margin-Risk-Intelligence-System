"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Nav from "../../components/nav";
import { getDrivers } from "../../lib/api";

type Driver = {
  feature: string;
  importance_mean: number;
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getDrivers()
      .then((data) => {
        const mapped = data.rows.map((row) => ({
          feature: String(row.feature ?? ""),
          importance_mean: Number(row.importance_mean ?? 0),
        }));
        setDrivers(mapped);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <div>
      <Nav />
      <section className="panel p-4 animate-rise">
        <h2 className="text-lg font-semibold">Global Profitability Drivers</h2>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={drivers} layout="vertical" margin={{ left: 30, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="feature" width={150} />
              <Tooltip />
              <Bar dataKey="importance_mean" fill="#3a8d8b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-sm text-ink/70">Importance is derived from permutation impact on ROC-AUC.</p>
      </section>
    </div>
  );
}
