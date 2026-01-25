#!/bin/bash

# Audioland Verkefnastjórnun - Tvísmella til að keyra

cd "$(dirname "$0")"

# Athuga hvort node sé uppsett
if ! command -v node &> /dev/null; then
    osascript -e 'display alert "Node.js vantar!" message "Farðu á nodejs.org og settu upp Node.js (LTS) fyrst." as warning'
    open "https://nodejs.org"
    exit 1
fi

# Athuga hvort npm install hafi verið keyrt
if [ ! -d "node_modules" ]; then
    echo "Set upp dependencies í fyrsta skipti..."
    npm install
fi

# Opna vafra eftir smá bið
(sleep 2 && open "http://localhost:3000") &

# Keyra serverinn
echo ""
echo "═══════════════════════════════════════════════════"
echo "   AUDIOLAND VERKEFNASTJÓRNUN"
echo "═══════════════════════════════════════════════════"
echo ""
echo "   Opna í vafra:"
echo "   Stjórnborð:  http://localhost:3000"
echo "   Booth:       http://localhost:3000/booth"
echo ""
echo "   Til að stoppa: Lokaðu þessum glugga"
echo ""
echo "═══════════════════════════════════════════════════"
echo ""

npm start
