import os
import re
import shutil
import subprocess
import tempfile


MAX_PT = 14400
PAD = 0  # padding around the drawing, in user units

# Content bounding box (x, y, width, height), measured in Inkscape
BX, BY = 0.388, -64.088
BW, BH = 1676.017 - 0.388, 1510.517 - (-64.088)

map_dir = r"C:\Users\Owner\OneDrive\Desktop\Writing\Blog\Substack\ptmapmelb\maps"
input_dir = os.path.join(map_dir, "small_maps")
output_dir = os.path.join(map_dir, "poster_maps")
os.makedirs(output_dir, exist_ok=True)

maps = ["weekday_small_light", "sat_small_light", "sun_small_light",
        "weekday_small_dark",  "sat_small_dark", "sun_small_dark"]

INKSCAPE = shutil.which("inkscape") or r"C:\Program Files\Inkscape\bin\inkscape.com"

def set_root(svg, viewbox, width, height):
    """Replace viewBox/width/height on the root <svg> tag."""
    root = re.search(r"<svg\b[^>]*>", svg, flags=re.S).group(0)
    new = re.sub(r'\s(viewBox|width|height)\s*=\s*"[^"]*"', "", root)
    new = new[:-1] + f' viewBox="{viewbox}" width="{width}" height="{height}">'
    return svg.replace(root, new, 1)


def write_tmp(text):
    tmp = tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False,
                                      encoding="utf-8")
    tmp.write(text)
    tmp.close()
    return tmp.name


bx, by = BX - PAD, BY - PAD
bw, bh = BW + 2 * PAD, BH + 2 * PAD
scale = MAX_PT / max(bw, bh)
w_pt, h_pt = round(bw * scale, 3), round(bh * scale, 3)

for name in maps:
    src = os.path.join(input_dir, f"{name}.svg")
    dst = os.path.join(output_dir, f"{name}.pdf")

    with open(src, encoding="utf-8") as f:
        svg = f.read()

    svg = set_root(svg, f"{bx} {by} {bw} {bh}", f"{w_pt}pt", f"{h_pt}pt")
    tmp = write_tmp(svg)

    print(f"{name}: exporting {w_pt:.0f} x {h_pt:.0f} pt ...")
    result = subprocess.run(
        [INKSCAPE, tmp, "--export-type=pdf", "--export-area-page",
         f"--export-filename={dst}"],
        capture_output=True, text=True,
    )
    os.remove(tmp)

    print(f"{name}: done -> {dst}" if result.returncode == 0
          else f"{name}: ERROR\n{result.stderr}")