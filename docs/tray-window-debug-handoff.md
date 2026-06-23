# Handoff: TABS tray icon + invisible main window

## TL;DR (do these first, in order)

1. **Confirm you actually rebuilt and reinstalled.** "I did" is not the same as "I ran the build, the installer appeared, I ran it, it succeeded". See [§1](#1-verify-the-new-build-is-installed) before anything else.
2. **Try the binary directly**, not via the installer. See [§2](#2-run-the-bare-exe-and-capture-output).
3. **Read the Edge WebView2 crash report** if the process dies. See [§3](#3-read-the-webview2-crash-report).
4. If those don't reveal the cause, follow the structured diagnosis in [§4](#4-structured-diagnosis) and [§5](#5-fix-tree).

---

## Symptom (as reported by the user)

- User runs the installed TABS (NSIS installer or `tabs.exe` directly).
- A tray icon appears in the Windows notification area.
- The main window does **not** appear.
- Hovering the tray icon makes it disappear (redrawn as empty / blank).
- The `tabs.exe` process IS running, `MainWindowHandle` is non-null, `MainWindowTitle` is "TABS".

## What I already tried (and why it didn't fix it)

Before you start, know that I (Copilot) attempted these fixes in this session. If the user says "I already did that" — they probably did, but **the binary on disk is from a build BEFORE these changes**. Read [§1](#1-verify-the-new-build-is-installed) first.

### Fixes I attempted

1. **Added `image-png` feature to `tauri` in `Cargo.toml`** so `Image::from_path` is available.
2. **Rewrote `src-tauri/src/tray.rs`** to load icons via `Image::from_path` from disk instead of using the embedded bundle icon.
3. **Changed `visible: false` → `visible: true`** in `src-tauri/tauri.conf.json`.
4. **Added a close-to-tray handler** in `src-tauri/src/lib.rs` that calls `prevent_close()` + `window.hide()`.
5. **Added a `setup()` call to `window.set_focus()`** after `window.show()`.

`cargo check` passes. **The code is correct on paper.** The user rebuilt and reinstalled, but the symptom persists — which means either (a) the install didn't actually replace the binary, (b) the build picked up a stale cached version, or (c) the root cause is something else entirely.

## Files to read before doing anything

| File | Why |
|------|-----|
| `src-tauri/src/tray.rs` | Tray icon setup. Currently uses `Image::from_path` against `tray-icon.png` → `32x32.png` → etc. |
| `src-tauri/src/lib.rs` | Plugin registration, `setup()` block, new `on_window_event(CloseRequested)` handler. |
| `src-tauri/tauri.conf.json` | Window config. **`visible: true`**, `width/height`, `center: true`, `decorations: true`. |
| `src-tauri/Cargo.toml` | `tauri = { version = "2", features = ["tray-icon", "image-png"] }`. |
| `src-tauri/icons/` | List of available icons. `tray-icon.png` does NOT exist; fallbacks exist but are tiny placeholders. |

## Environment facts (from this session)

- Tauri version: **2.11.2** (in `Cargo.lock`).
- User OS: **Windows** (PowerShell, `$env:LOCALAPPDATA` resolves).
- Installed app data lives at: `C:\Users\burak\AppData\Local\com.tabs.app\`
- WebView2 user data: `C:\Users\burak\AppData\Local\com.tabs.app\EBWebView\`
- Cargo build output: `C:\MYAPPS\TABS\src-tauri\target\release\tabs.exe` (18 MB) and installer at `C:\MYAPPS\TABS\src-tauri\target\release\bundle\nsis\TABS_1.0.1_x64-setup.exe`
- Last successful `cargo check`: `Finished dev profile in 1.25s` (clean).

---

## 1. Verify the new build is installed

The user almost certainly is running the **stale binary** from `C:\MYAPPS\TABS\src-tauri\target\release\tabs.exe` (timestamp `6/21/2026 01:07:25` per the diagnostic in this session). That exe predates the tray.rs rewrite.

### 1.1 Check the build timestamp

```powershell
Get-Item C:\MYAPPS\TABS\src-tauri\target\release\tabs.exe | Select-Object Name, LastWriteTime, Length
Get-Item C:\MYAPPS\TABS\src-tauri\target\release\bundle\nsis\*.exe | Select-Object Name, LastWriteTime, Length
```

Expected (post-fix): timestamp from after the latest code changes. If the timestamp is `6/21/2026 01:07:25`, **the build was never re-run**.

### 1.2 Check what's actually installed

The NSIS installer uses `installMode: currentUser`, so it installs to:

```
%LOCALAPPDATA%\Programs\TABS\tabs.exe
```

Verify the version on disk matches the new build:

```powershell
$installed = "$env:LOCALAPPDATA\Programs\TABS\tabs.exe"
$built     = "C:\MYAPPS\TABS\src-tauri\target\release\tabs.exe"
if (Test-Path $installed) {
  $a = Get-Item $installed
  $b = Get-Item $built
  Write-Host "Installed: $($a.LastWriteTime)  size=$($a.Length)"
  Write-Host "Built:     $($b.LastWriteTime)  size=$($b.Length)"
  if ($a.Length -ne $b.Length) {
    Write-Host "MISMATCH — installed binary is stale." -ForegroundColor Red
  } else {
    Write-Host "Sizes match." -ForegroundColor Green
  }
} else {
  Write-Host "Not installed at expected path. NSIS install location may differ." -ForegroundColor Yellow
  Get-ChildItem "$env:LOCALAPPDATA\Programs" -Directory | Where-Object { $_.Name -like "*TABS*" }
}
```

If sizes differ, the fix was never actually installed. Run the build + install:

```powershell
cd C:\MYAPPS\TABS
Get-Process tabs,msedgewebview2 -ErrorAction SilentlyContinue | Stop-Process -Force
npm run tauri:build
& "src-tauri\target\release\bundle\nsis\TABS_1.0.1_x64-setup.exe" /S   # silent install
```

The `/S` flag makes NSIS install silently. Remove it to see the GUI installer.

### 1.3 Verify the rebuild actually compiled our code

```powershell
cd C:\MYAPPS\TABS\src-tauri
cargo clean
cargo build --release
```

If this fails or warnings mention `tauri::image::Image::from_path` not found, the `image-png` feature didn't get applied — double-check `Cargo.toml`.

---

## 2. Run the bare exe and capture output

The user keeps saying "nothing happens". The release build of a Tauri app is a **windowless subsystem** on Windows in some configurations — it doesn't print to stdout in the usual way. But we can force it to log:

### 2.1 Run from PowerShell with output capture

```powershell
cd C:\MYAPPS\TABS\src-tauri\target\release
$proc = Start-Process .\tabs.exe -PassThru -RedirectStandardOutput stdout.log -RedirectStandardError stderr.log
Start-Sleep -Seconds 5
if ($proc.HasExited) {
  Write-Host "Process exited with code $($proc.ExitCode)" -ForegroundColor Red
  Write-Host "--- stderr ---"
  Get-Content stderr.log
} else {
  Write-Host "Process still running (PID $($proc.Id)). Checking windows..." -ForegroundColor Green
  $proc.Refresh()
  Write-Host "MainWindowHandle: $($proc.MainWindowHandle)"
  Write-Host "MainWindowTitle:  $($proc.MainWindowTitle)"
  # Enumerate ALL top-level windows owned by this process
  Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class WL {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static List<string> WindowsForPid(uint pid) {
    var results = new List<string>();
    EnumWindows((h, l) => {
      uint p; GetWindowThreadProcessId(h, out p);
      if (p == pid) {
        int len = GetWindowTextLength(h);
        var sb = new StringBuilder(len + 1);
        GetWindowText(h, sb, sb.Capacity);
        RECT r; GetWindowRect(h, out r);
        results.Add($"hwnd={h} visible={IsWindowVisible(h)} rect=({r.Left},{r.Top})-({r.Right},{r.Bottom}) title='{sb}'");
      }
      return true;
    }, IntPtr.Zero);
    return results;
  }
}
"@
  [WL]::WindowsForPid($proc.Id) | ForEach-Object { Write-Host "  $_" }
}
Stop-Process $proc -Force -ErrorAction SilentlyContinue
```

This will tell you:

- Did the process actually start?
- Did it exit with an error?
- Does it own any windows? If so, where are they on screen, and are they visible?

If `MainWindowTitle` is empty BUT the process is running, the window object exists but its `title` attribute was never set or was reset to empty. That's a different bug than the window being off-screen.

If the window has a valid rect (e.g. `(1920,1080)-(3286,1980)`) that's off your visible monitor area, the fix is to add a startup hook that forces the window to a known position.

---

## 3. Read the WebView2 crash report

Tauri's webview is Edge WebView2. It writes crash dumps to:

```
%LOCALAPPDATA%\com.tabs.app\EBWebView\Crashpad\reports\
```

```powershell
Get-ChildItem "$env:LOCALAPPDATA\com.tabs.app\EBWebView\Crashpad\reports" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 3 |
  ForEach-Object { Write-Host "=== $($_.Name) ==="; Get-Content $_.FullName -First 50 }
```

In this session the reports directory was **empty** — but that was before the user tried the new build. Check again after the new install.

Also check WebView2's own log:

```powershell
Get-Content "$env:LOCALAPPDATA\com.tabs.app\EBWebView\Default\LOG.old" -Tail 30 -ErrorAction SilentlyContinue
```

Look for lines containing `ERROR`, `crash`, `Renderer`, or `GPU process`.

---

## 4. Structured diagnosis

If §§1-3 didn't reveal the cause, run through these in order.

### Check A: Is the window just off-screen?

```powershell
Get-Process tabs -ErrorAction SilentlyContinue | ForEach-Object {
  Add-Type @"
using System; using System.Runtime.InteropServices;
public class R {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr hAfter, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}
"@
  [R]::ShowWindow($_.MainWindowHandle, 9) | Out-Null   # SW_RESTORE
  [R]::SetWindowPos($_.MainWindowHandle, [IntPtr]::Zero, 100, 100, 1366, 900, 0x0040) | Out-Null
  Write-Host "Moved window to (100,100) at 1366x900"
}
```

This forces the window to a known position. If it appears now, the problem is window placement (multi-monitor, saved position, etc.).

### Check B: Is the WebView2 runtime broken?

```powershell
Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue |
  Select-Object pv
```

If this returns nothing or the version is very old, **WebView2 runtime is missing or outdated**. Download the Evergreen Runtime from Microsoft:

```
https://developer.microsoft.com/microsoft-edge/webview2/
```

→ "Evergreen Bootstrapper" → install.

### Check C: Is the frontend bundle missing?

The release build's `frontendDist` is `../dist` per `tauri.conf.json`. After `npm run build`, that directory must exist and contain `index.html`:

```powershell
Test-Path C:\MYAPPS\TABS\dist\index.html
Get-ChildItem C:\MYAPPS\TABS\dist -Recurse | Select-Object -First 10
```

If `dist/` is missing, the webview is loading an empty page and the window will appear blank (but it should still appear). If you see the window but it's pure white, this is the cause.

### Check D: Is the window being hidden by a second instance?

The `tauri-plugin-single-instance` plugin kills the second launch and focuses the first. If the first window was already destroyed but the plugin is in a weird state, the second launch may not show anything. Kill everything and try fresh:

```powershell
Get-Process tabs,msedgewebview2,WebView2 -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
& "C:\MYAPPS\TABS\src-tauri\target\release\tabs.exe"
```

### Check E: Is the close-to-tray handler firing on startup?

The new `on_window_event(CloseRequested)` handler calls `window.hide()`. If the **setup** path is somehow firing `CloseRequested` (e.g. via an event we're not aware of), the window would be hidden immediately. Test by temporarily removing the handler:

```rust
// src-tauri/src/lib.rs — comment out the entire on_window_event block
// in setup(), rebuild, and see if the window appears.
```

If the window appears without the handler, the problem is the handler itself. Likely cause: Tauri 2.x fires `CloseRequested` synthetically during the very first `run()` cycle in some configurations — moving the `on_window_event` registration to AFTER the window is fully shown (e.g. inside a `WebviewWindow::on_page_load` callback) would fix it.

---

## 5. Fix tree

If you reach this point, here are the known fixes in order of likelihood:

### Fix 1: Force window to be shown and focused via raw Win32

Add to `lib.rs` `setup()`, AFTER `app.get_webview_window("main")`:

```rust
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SetWindowPos, ShowWindow, SW_SHOW, HWND_TOP,
};
// ... in setup, after the window is obtained:
let hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
if hwnd != 0 {
    unsafe { ShowWindow(hwnd, SW_SHOW); }
}
```

This bypasses Tauri's own show() and goes directly to Win32. Often more reliable on Windows for the first frame.

### Fix 2: Use `WindowEvent::Focused` to delay close handling

Move the close-to-tray handler so it only registers after the window has been shown at least once:

```rust
use std::sync::atomic::{AtomicBool, Ordering};
static FIRST_SHOWN: AtomicBool = AtomicBool::new(false);

window.on_window_event(move |event| {
    match event {
        WindowEvent::CloseRequested { api, .. } if FIRST_SHOWN.load(Ordering::SeqCst) => {
            api.prevent_close();
            let _ = window_for_close.hide();
        }
        WindowEvent::Focused(true) => {
            FIRST_SHOWN.store(true, Ordering::SeqCst);
        }
        _ => {}
    }
});
```

### Fix 3: Generate a proper tray icon

The current `32x32.png` is 103 bytes — almost certainly empty/placeholder. Replace it with a real 32×32 PNG with a solid background and a simple shape. Even a 32×32 black square will eliminate the "disappears on hover" symptom because the rendering will be predictable.

To create one quickly with PowerShell + .NET:

```powershell
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 32,32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(255, 30, 144, 255))   # dodger blue
$g.FillEllipse([System.Drawing.Brushes]::White, 8, 8, 16, 16)
$bmp.Save("C:\MYAPPS\TABS\src-tauri\icons\tray-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
```

Then rebuild. The new code in `tray.rs` looks for `tray-icon.png` first and will pick it up.

### Fix 4: Force the window to a specific position

In `tauri.conf.json`, add explicit `x` and `y` so it can never be placed off-screen:

```json
{
  "label": "main",
  "x": 100,
  "y": 100,
  "width": 1366,
  "height": 900,
  ...
}
```

Remove `center: true` when using explicit positions.

### Fix 5: Check Windows session / DPI

```powershell
Get-Process tabs | Select-Object MainWindowHandle
Add-Type @"
using System; using System.Runtime.InteropServices;
public class D {
  [DllImport("user32.dll")] public static extern int GetDpiForWindow(IntPtr hwnd);
}
"@
$dpi = [D]::GetDpiForWindow((Get-Process tabs).MainWindowHandle)
Write-Host "Window DPI: $dpi"
```

If the DPI is 0 or wildly off (e.g. 1 or 480), the window is being created at a scale factor that makes it effectively invisible. Set a per-monitor DPI awareness in the manifest or via the `app.windows[].dpiAwareness` config option.

---

## What to do once you find the cause

1. **Document the fix in this file** under a new `## Root cause` section at the bottom, including the specific log/error/output that revealed it. The user is bad at remembering — this handoff is the only continuity.
2. **Apply the fix.**
3. **Verify the rebuild actually happens** by checking the file size of `target\release\tabs.exe` changed.
4. **Verify the install actually happens** by checking the file size of `%LOCALAPPDATA%\Programs\TABS\tabs.exe` matches.
5. **Test by running the installed binary directly** (`%LOCALAPPDATA%\Programs\TABS\tabs.exe`), not the build output. The installer and the dev build are different code paths.

## Files the user will need to share if you ask for more help

- Output of the structured-diagnosis script in [§2.1](#21-run-from-powershell-with-output-capture)
- Output of the window enumeration in the same script
- Contents of the most recent crash dump, if any
- The full path the user is launching the binary from

---

## Root cause

The executable installed on 2026-06-22 was an obsolete 0.1.0 MSI build at
`C:\Program Files\TABS\tabs.exe`, not the current application build. Launching
that exact binary with stderr redirected exposed the otherwise-hidden startup
panic (exit code 101):

```text
PluginInitialization("fs", "Error deserializing 'plugins.fs' within your Tauri configuration: unknown field `scope`, expected `requireLiteralLeadingDot`")
```

The release executable uses the Windows GUI subsystem, so the panic was not
visible when the user double-clicked it. WebView2 and window placement were not
the cause; initialization failed before the main window was created.

The source tree also could not initially produce a replacement because the
frontend TypeScript build had ten errors. Those errors and the Rust package
version mismatch were corrected, then `npm run tauri:build` produced and
runtime-verified version 1.0.1:

- `src-tauri/target/release/tabs.exe`
- `src-tauri/target/release/bundle/msi/TABS_1.0.1_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/TABS_1.0.1_x64-setup.exe`

The bare 1.0.1 executable remained running with a visible `TABS` window at
`(0,0)-(1170,738)`, and the MSI metadata reports product version 1.0.1.
