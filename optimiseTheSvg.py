import subprocess
import sys
 
input_file = r"C:\Users\Owner\OneDrive\Desktop\Writing\Blog\Substack\Nicer Map\recent_map_big.svg"
output_file = r"C:\Users\Owner\OneDrive\Desktop\Writing\Blog\Substack\Nicer Map\recent_map.svg"
 
protected_ids = (
    "layer3,layer5,layer60,layer49,layer74,layer67,layer40,layer27,layer80,"
    "layer6,layer73,layer50,layer66,layer79,layer42,layer59,layer24,layer37,layer28,"
    "layer7,layer72,layer53,layer65,layer78,layer39,layer58,layer23,layer32,"
    "layer8,layer71,layer52,layer64,layer77,layer41,layer57,layer14,layer34,layer107,"
    "layer9,layer70,layer51,layer63,layer76,layer43,layer56,layer22,layer31,"
    "layer10,layer69,layer48,layer62,layer75,layer44,layer55,layer25,layer36,layer29,"
    "layer4,path3295"
)
 
cmd = [
    sys.executable, "-m", "scour.scour",
    "-i", input_file,
    "-o", output_file,
    "--enable-viewboxing",
    "--enable-id-stripping",
    "--enable-comment-stripping",
    "--remove-metadata",
    "--indent=space",
    "--protect-ids-list", protected_ids,
]
 
print(f"Optimising {input_file} -> {output_file} ...")
result = subprocess.run(cmd, capture_output=True, text=True)
 
if result.returncode == 0:
    print("Done.")
else:
    print("Error:")
    print(result.stderr)


