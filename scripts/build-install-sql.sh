#!/usr/bin/env bash
#
# Agendik · arma supabase/install.sql
#
# Junta todas las migraciones y el seed en un archivo único, pensado para
# pegar en el SQL Editor del Studio de un Supabase self-hosted (donde no
# corre `supabase db push`, porque ese comando es para proyectos de la nube).
#
# Correlo cada vez que agregues una migración.
#
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=supabase/install.sql

{
  cat <<'HDR'
-- =====================================================================
-- Agendik · instalación completa del esquema
--
-- Generado a partir de supabase/migrations/*.sql + supabase/seed.sql.
-- Sirve para un proyecto en la nube o para uno self-hosted:
-- pegalo entero en el SQL Editor del proyecto y ejecutá.
-- Es seguro correrlo más de una vez (el seed usa ON CONFLICT).
--
-- NO EDITAR A MANO: se regenera con scripts/build-install-sql.sh
-- =====================================================================

HDR
  for f in supabase/migrations/*.sql supabase/seed.sql; do
    printf -- '\n-- ─────────────────────────────────────────────────────────────────────\n-- %s\n-- ─────────────────────────────────────────────────────────────────────\n\n' "$f"
    cat "$f"
  done
} > "$OUT"

echo "Listo · $OUT ($(wc -l < "$OUT" | tr -d ' ') líneas)"
