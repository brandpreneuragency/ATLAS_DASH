import { AuditTable } from "@/components/admin/audit-table";
export default function AuditPage(){return <div className="space-y-4"><h1 className="text-2xl font-bold text-foreground">Audit Log</h1><p className="text-sm text-muted-foreground">Read-only history. Sensitive token values and hashes are redacted.</p><AuditTable/></div>}
