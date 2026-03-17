import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/drivers", label: "Drivers" },
  { href: "/predict", label: "Predict" },
];

export default function Nav() {
  return (
    <nav className="panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4 animate-rise">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Margin Risk Intelligence</h1>
        <p className="text-sm text-ink/70">Project Profitability Monitoring Console</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
