import { listDevelopers } from "@model-monitor/database";
import { db } from "@/lib/db";
import { ModelForm } from "@/components/models/model-form";

export default async function NewModelPage() {
  const developers = await listDevelopers(db);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create model</h1>
        <p className="text-sm text-muted-foreground">
          Add a canonical model identity. Access paths are managed separately.
        </p>
      </div>
      <ModelForm mode="create" developers={developers} />
    </div>
  );
}
