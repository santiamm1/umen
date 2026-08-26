#!/bin/bash
# Resizes/compresses JPGs in assets/ in place using macOS's built-in `sips` (no deps).
# Never upscales, and only keeps the result if it's actually smaller.
# Run after adding new images: ./scripts/compress-images.sh
set -e
MAX_WIDTH=1600
QUALITY=75
MIN_SIZE=51200  # skip files under 50KB, already small

find assets -type f \( -iname "*.jpg" -o -iname "*.jpeg" \) ! -path "*/Logo/*" | while read -r f; do
    size=$(stat -f%z "$f")
    if [ "$size" -lt "$MIN_SIZE" ]; then continue; fi

    width=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')
    resize_flag=""
    if [ "$width" -gt "$MAX_WIDTH" ]; then
        resize_flag="-Z $MAX_WIDTH"
    fi

    tmp="${f%.*}.tmp.jpg"
    sips $resize_flag -s formatOptions "$QUALITY" "$f" --out "$tmp" >/dev/null 2>&1
    newsize=$(stat -f%z "$tmp")

    if [ "$newsize" -lt "$size" ]; then
        mv "$tmp" "$f"
        echo "$f: $size -> $newsize bytes"
    else
        rm "$tmp"
        echo "$f: kept original ($size bytes, recompress would grow it)"
    fi
done
