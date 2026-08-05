#!/usr/bin/env bash
# ===============================================================================
#  SUPER-UCE DOC — Script de Ejecución del Centro de Control (Linux Ubuntu)
# ===============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🏥 Iniciando Centro de Control SUPER-UCE DOC..."

# Activar entorno virtual de Python si existe
if [ -d "$ROOT_DIR/BackEnd/venv" ]; then
    source "$ROOT_DIR/BackEnd/venv/bin/activate"
fi

python3 "$SCRIPT_DIR/control_center.py"
