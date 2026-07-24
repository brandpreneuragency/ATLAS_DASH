import { signIn } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/auth-policy";

async function credentialsSignInAction(formData: FormData) {
  "use server";
  const callbackValue = formData.get("callbackUrl");
  const callbackUrl = safeCallbackUrl(
    typeof callbackValue === "string" ? callbackValue : undefined,
  );
  const email = formData.get("email");
  const password = formData.get("password");
  await signIn("credentials", {
    email: typeof email === "string" ? email : "",
    password: typeof password === "string" ? password : "",
    redirectTo: callbackUrl,
  });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground text-lg font-bold">
            MM
          </div>
          <h1 className="text-xl font-bold text-foreground">Model Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Private LLM registry. Sign in with your configured email and password.
          </p>
        </div>
        <form action={credentialsSignInAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <label className="block space-y-1 text-sm font-medium text-foreground">
            <span>Email</span>
            <input
              required
              type="email"
              name="email"
              autoComplete="username"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm font-medium text-foreground">
            <span>Password</span>
            <input
              required
              type="password"
              name="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Sign in
          </button>
        </form>
        {params.error ? (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
            role="alert"
            aria-live="assertive"
            data-testid="login-error"
          >
            Invalid email or password.
          </p>
        ) : null}
      </div>
    </div>
  );
}
