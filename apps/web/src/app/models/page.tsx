function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">
        This section is scaffolded in Phase 1 and implemented in later phases.
      </p>
    </div>
  );
}

export default function ModelsPage() {
  return <Placeholder title="Models" />;
}
