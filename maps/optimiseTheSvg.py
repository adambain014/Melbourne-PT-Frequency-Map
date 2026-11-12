import subprocess
import sys
import os
map_dir = r"C:\Users\Owner\OneDrive\Desktop\Writing\Blog\Substack\ptmapmelb\maps"
input_dir = map_dir + "\\big_maps\\"
output_dir = map_dir + "\\small_maps\\"

maps = ["weekday", "sat", "sun"]

protected_ids = (
    "layer3,layer5,layer60,layer49,layer74,layer67,layer40,layer27,layer80,"
    "layer6,layer73,layer50,layer66,layer79,layer42,layer59,layer24,layer37,layer28,"
    "layer7,layer72,layer53,layer65,layer78,layer39,layer58,layer23,layer32,"
    "layer8,layer71,layer52,layer64,layer77,layer41,layer57,layer14,layer34,layer107,"
    "layer9,layer70,layer51,layer63,layer76,layer43,layer56,layer22,layer31,"
    "layer10,layer69,layer48,layer62,layer75,layer44,layer55,layer25,layer36,layer29,"
    "layer4,path3295"
)

for m in maps:
    input_file = os.path.join(input_dir, m + "_big.svg")
    output_file = os.path.join(output_dir, m + "_small_light.svg")

    cmd = [
        sys.executable, "-m", "scour.scour",
        "-i", input_file,
        "-o", output_file,
        "--enable-viewboxing",
        "--enable-id-stripping",
        "--enable-comment-stripping",
        "--remove-metadata",
        "--remove-descriptive-elements",
        "--indent=none",
        "--no-line-breaks",
        "--set-precision=5",
        "--set-c-precision=5",
        "--protect-ids-list", protected_ids,
    ]

    print(f"Optimising {input_file} -> {output_file} ...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        before = os.path.getsize(input_file) / 1e6
        after = os.path.getsize(output_file) / 1e6
        print(f"{m}: done, {before:.1f} MB -> {after:.1f} MB")
    else:
        print(f"{m}: ERROR")
        print(result.stderr)

