import {
  LayoutDashboard,
  Boxes,
  CreditCard,
  Grid3x3,
  BarChart3,
  Upload,
  ScrollText,
  Settings,
} from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/models", label: "Models", icon: Boxes },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/access-matrix", label: "Access Matrix", icon: Grid3x3 },
  { href: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
  { href: "/imports", label: "Imports", icon: Upload },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            MM
          </div>
          <span className="text-sm font-semibold text-foreground">Model Monitor</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="flex h-14 items-center justify-between border-b border-border px-6">
          <div className="text-sm text-muted-foreground">Model Monitor</div>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
