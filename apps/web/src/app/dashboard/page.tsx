export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Active subscriptions</p>
          <p className="mt-2 text-3xl font-bold text-foreground">—</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Monthly fixed cost</p>
          <p className="mt-2 text-3xl font-bold text-foreground">—</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Canonical models</p>
          <p className="mt-2 text-3xl font-bold text-foreground">—</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Dashboard data will appear after running the seed.
      </p>
    </div>
  );
}
