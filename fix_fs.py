"""
Replace all CSS rules:
  font-size: var(--fs-xs);   -> font-size: clamp(12px, 1.1vw, 18px);
  font-size: var(--fs-10);   -> font-size: clamp(12px, 1.1vw, 18px);
  font-size: var(--fs-11);   -> font-size: clamp(12px, 1.1vw, 18px);
  font-size: var(--fs-12);   -> font-size: clamp(12px, 1.1vw, 18px);

Also replaces all whitespace variants (e.g., spaces, tabs, newlines).
Reports all changed lines.
"""
import re

PATH = r"C:\MYAPPS\TABS\src\index.css"
CLAMP = "font-size: clamp(12px, 1.1vw, 18px)"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

pattern = re.compile(r"font-size\s*:\s*var\(--fs-(?:xs|10|11|12)\)\s*;")

matches = list(pattern.finditer(src))
print(f"Found {len(matches)} matches")

# Track changed lines
line_changes = {}
for m in matches:
    # Find line number of the match
    line_no = src.count("\n", 0, m.start()) + 1
    line_changes[line_no] = m.group(0)

new_src, count = pattern.subn(CLAMP, src)
print(f"Replaced {count} occurrences")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(new_src)

print("DONE")
print(f"\nChanged lines ({len(line_changes)}):")
for ln in sorted(line_changes):
    print(f"  L{ln}: {line_changes[ln]!r} -> {CLAMP}")
