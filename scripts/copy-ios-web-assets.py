"""Copy web resources into the app without iCloud numbered conflict copies."""
import os
import re
import shutil
from pathlib import Path

source = Path(os.environ["SRCROOT"]) / "App" / "public"
destination = Path(os.environ["TARGET_BUILD_DIR"]) / os.environ["UNLOCALIZED_RESOURCES_FOLDER_PATH"] / "public"
numbered = re.compile(r"(?: \d+)+(?=\.[^.]+$)")
text_extensions = {".html", ".js", ".css", ".json", ".webmanifest", ".svg", ".xml", ".md"}
# Capacitor's delivered tree is authoritative. A checked-in xcfilelist can lag
# behind a newly added banner, silently producing a successful but incomplete
# build. After adding resources, regenerate both xcfilelists with
# writeIOSAssetManifest: Xcode's script sandbox requires each discovered file
# to be declared even when the public directory is also an input.
files = sorted(path for path in source.rglob("*") if path.is_file())
references = "\n".join(
    path.read_text(encoding="utf-8") for path in files
    if path.suffix in text_extensions and not numbered.search(path.name)
)
from urllib.parse import quote

destination.mkdir(parents=True, exist_ok=True)
count = 0
size = 0
for path in files:
    if numbered.search(path.name) and path.name not in references and quote(path.name, safe="") not in references:
        continue
    target = destination / path.relative_to(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
    count += 1
    size += target.stat().st_size
print(f"Bundled {count} web assets, {size:,} bytes; ignored unused numbered conflict copies.")
