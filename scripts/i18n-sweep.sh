#!/bin/sh
# Opens every settings page in English and lists the texts that still look Turkish.  Needs: npx vite build
# usage: sh scripts/i18n-sweep.sh [lang]
LANGV=${1:-en}
OUT=${TEMP:-/tmp}/i18n-sweep
mkdir -p "$OUT"
EXPR="(async()=>{let out='';const subs=[...document.querySelectorAll('.st-subtabs button')];for(const b of (subs.length?subs:[null])){if(b){b.click();await new Promise(r=>setTimeout(r,250))}out+=document.body.textContent+'\n';out+=[...document.querySelectorAll('[placeholder],[title],[aria-label]')].map(e=>e.getAttribute('placeholder')+' '+e.getAttribute('title')+' '+e.getAttribute('aria-label')).join('\n')+'\n----\n'}return out})()"
for i in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  MSYS_NO_PATHCONV=1 node scripts/shot-page.mjs "#/settings" "$OUT/p$i.png" --tab=$i --size=1280x900 --setting=language:$LANGV --eval="$EXPR" --evalout="$OUT/p$i.txt" --wait=200 > /dev/null 2>&1
done
cat "$OUT"/p*.txt | tr -s ' \n' '\n' > "$OUT/all.txt"
echo "words: $(wc -l < "$OUT/all.txt")"
