#!/bin/bash

# Finna möppuna þar sem þessi skrá er
cd "$(dirname "$0")"

# Drepa gamla processa á porti 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null

clear
echo ""
echo "═══════════════════════════════════════════════════"
echo "   🐕 BESSI - Verkefnastjórnun"
echo "═══════════════════════════════════════════════════"
echo ""
echo "   Opna í vafra:"
echo "   Stjórnborð:  http://localhost:3001"
echo "   Booth:       http://localhost:3001/booth.html"
echo ""
echo "   Til að stoppa: Lokaðu þessum glugga"
echo ""
echo "═══════════════════════════════════════════════════"
echo ""

# Keyra server
npm start
