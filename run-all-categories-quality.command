#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$SCRIPT_DIR/.runtime/node-v22.23.2/bin/node"

if [ "$#" -lt 1 ] || [ "$#" -gt 3 ]; then
  printf '%s\n' "Verwendung: $0 '/ABSOLUTER/PFAD/POLIZZE.pdf' [FRAMEWORK_TERMS|PROPOSAL|ACTIVE] [AUSGABEORDNER]" >&2
  exit 1
fi

PDF_FILE="$1"
DOCUMENT_STATUS="${2:-FRAMEWORK_TERMS}"
PRIVATE_QA_ROOT="$HOME/Library/Application Support/at.klincov.polizzenvergleich-v3/QA"
OUTPUT_DIR="${3:-$PRIVATE_QA_ROOT/ALL-CATEGORIES-QUALITY-$(date +%Y%m%d-%H%M%S)}"
MODEL="${POLICY_FULL_MODEL:-qwen/qwen3.6-35b-a3b}"
MODEL_TOKEN_LIMIT="${POLICY_FULL_MODEL_TOKEN_LIMIT:-42496}"
DOCUMENT_KEY="$(basename "$PDF_FILE" .pdf)"
DOCUMENT_ARTIFACT="$OUTPUT_DIR/document.private.json"
RUN_MANIFEST="$OUTPUT_DIR/manifest.private.json"
GLOBAL_LOCK_DIR="$PRIVATE_QA_ROOT/.all-categories-quality.lock"
LOCK_ACQUIRED=0

cleanup_global_lock() {
  if [ "$LOCK_ACQUIRED" -eq 1 ]; then
    rm -f "$GLOBAL_LOCK_DIR/owner.private.txt"
    rmdir "$GLOBAL_LOCK_DIR" 2>/dev/null || true
  fi
}

trap cleanup_global_lock EXIT
trap 'exit 130' HUP INT TERM

[ -x "$NODE_BIN" ] || {
  printf '%s\n' "Lokale Node-22-Laufzeit fehlt. Bitte zuerst install.command ausführen." >&2
  exit 1
}
read -r -a CATEGORY_VIEWS <<< "$("$NODE_BIN" -e 'process.stdout.write(require(process.argv[1]).CATEGORY_ORDER.join(" "))' "$SCRIPT_DIR/server/utils/policyComparison/productContract.js")"
[ -f "$PDF_FILE" ] || {
  printf '%s\n' "PDF fehlt: $PDF_FILE" >&2
  exit 1
}
case "$DOCUMENT_STATUS" in
  FRAMEWORK_TERMS|PROPOSAL|ACTIVE) ;;
  *)
    printf '%s\n' "Ungültiger Dokumentstatus: $DOCUMENT_STATUS" >&2
    exit 1
    ;;
esac
if [ -e "$OUTPUT_DIR" ] && [ "$#" -ne 3 ]; then
  printf '%s\n' "Ausgabeordner existiert bereits: $OUTPUT_DIR" >&2
  exit 1
fi
[ ! -e "$OUTPUT_DIR" ] || [ -d "$OUTPUT_DIR" ] || {
  printf '%s\n' "Ausgabepfad ist kein Ordner: $OUTPUT_DIR" >&2
  exit 1
}

umask 077
mkdir -p "$PRIVATE_QA_ROOT"
if ! mkdir "$GLOBAL_LOCK_DIR" 2>/dev/null; then
  printf '%s\n' "Ein anderer All-Kategorien-Lauf hält bereits die globale Modellsperre: $GLOBAL_LOCK_DIR" >&2
  if [ -f "$GLOBAL_LOCK_DIR/owner.private.txt" ]; then
    sed 's/^/[all-categories] Sperrinhaber: /' "$GLOBAL_LOCK_DIR/owner.private.txt" >&2
  fi
  exit 1
fi
LOCK_ACQUIRED=1
printf 'pid=%s output=%s\n' "$$" "$OUTPUT_DIR" > "$GLOBAL_LOCK_DIR/owner.private.txt"

export LMSTUDIO_BASE_PATH="${LMSTUDIO_BASE_PATH:-http://127.0.0.1:1234/v1}"
export LMSTUDIO_MODEL_PREF="$MODEL"
export LMSTUDIO_MODEL_TOKEN_LIMIT="$MODEL_TOKEN_LIMIT"

command -v curl >/dev/null 2>&1 || {
  printf '%s\n' "curl fehlt; LM-Studio-Preflight kann nicht ausgeführt werden." >&2
  exit 1
}
printf '%s\n' "[all-categories] LM Studio und Qwen 3.6 vorprüfen: $MODEL"
MODEL_RESPONSE="$(curl --fail --silent --show-error \
  --connect-timeout 5 --max-time 15 \
  "${LMSTUDIO_BASE_PATH%/}/models")" || {
  printf '%s\n' "LM Studio ist unter ${LMSTUDIO_BASE_PATH%/} nicht erreichbar." >&2
  exit 1
}
printf '%s' "$MODEL_RESPONSE" | "$NODE_BIN" -e '
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { body += chunk; });
  process.stdin.on("end", () => {
    const requested = process.argv.slice(1);
    let payload;
    try { payload = JSON.parse(body); }
    catch { console.error("LM Studio lieferte keine gültige Modellliste."); process.exit(1); }
    const ids = Array.isArray(payload?.data)
      ? payload.data.map((entry) => entry?.id).filter(Boolean)
      : [];
    const missing = requested.filter((model) => !ids.includes(model));
    if (missing.length) {
      console.error(`Angeforderte Modelle sind nicht geladen: ${missing.join(", ")}`);
      console.error(`Geladene Modelle: ${ids.length ? ids.join(", ") : "keine"}`);
      process.exit(1);
    }
  });
' "$MODEL"

LMSTUDIO_RUNTIME_ROOT="${LMSTUDIO_BASE_PATH%/v1}"
RUNTIME_MODEL_RESPONSE="$(curl --fail --silent --show-error \
  --connect-timeout 5 --max-time 15 \
  "${LMSTUDIO_RUNTIME_ROOT%/}/api/v0/models")" || {
  printf '%s\n' "LM-Studio-Runtimeinformationen sind unter ${LMSTUDIO_RUNTIME_ROOT%/}/api/v0/models nicht erreichbar." >&2
  exit 1
}
printf '%s' "$RUNTIME_MODEL_RESPONSE" | "$NODE_BIN" -e '
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { body += chunk; });
  process.stdin.on("end", () => {
    const model = process.argv[1];
    const expectedContext = Number(process.argv[2]);
    let payload;
    try { payload = JSON.parse(body); }
    catch { console.error("LM Studio lieferte keine gültigen Runtimeinformationen."); process.exit(1); }
    const loaded = Array.isArray(payload?.data)
      ? payload.data.find((entry) => entry?.id === model && entry?.state === "loaded")
      : null;
    if (!loaded) {
      console.error(`Das angeforderte Modell ist nicht im Zustand loaded: ${model}`);
      process.exit(1);
    }
    if (Number(loaded.loaded_context_length) !== expectedContext) {
      console.error(
        `Falsche geladene Kontextlänge für ${model}: ${loaded.loaded_context_length ?? "nicht ausgewiesen"}; erwartet ${expectedContext}.`
      );
      process.exit(1);
    }
  });
' "$MODEL" "$MODEL_TOKEN_LIMIT"
printf '%s\n' "[all-categories] Runtime bestätigt: $MODEL mit $MODEL_TOKEN_LIMIT Token Kontext"

MANIFEST_ARGS=(
  --manifest "$RUN_MANIFEST"
  --output "$OUTPUT_DIR"
  --repository "$SCRIPT_DIR"
  --pdfFile "$PDF_FILE"
  --model "$MODEL"
  --modelTokenLimit "$MODEL_TOKEN_LIMIT"
  --documentStatus "$DOCUMENT_STATUS"
)
if [ -n "${POLICY_RUN_RELEASE_ID:-}" ]; then
  [ "${NODE_ENV:-}" = "test" ] || {
    printf '%s\n' "POLICY_RUN_RELEASE_ID ist ausschließlich im Test-Harness zulässig." >&2
    exit 1
  }
  MANIFEST_ARGS+=(--releaseId "$POLICY_RUN_RELEASE_ID")
fi
"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/ensureAllCategoryRunManifest.cjs" \
  "${MANIFEST_ARGS[@]}"

catalog_file() {
  case "$1" in
    VS) printf '%s\n' "$SCRIPT_DIR/server/resources/policyAnalysis/vs-occurrence-full-draft.v0.2.json" ;;
    *) printf '%s\n' "$SCRIPT_DIR/server/resources/policyAnalysis/$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')-occurrence-full-draft.v0.1.json" ;;
  esac
}

prompt_file() {
  case "$1" in
    VS) printf '%s\n' "$SCRIPT_DIR/server/resources/workspaceTemplates/VS_versicherungssumme_und_versicherte_sachen.md" ;;
    FE) printf '%s\n' "$SCRIPT_DIR/server/resources/workspaceTemplates/FE_feuer.md" ;;
    LW) printf '%s\n' "$SCRIPT_DIR/server/resources/workspaceTemplates/LW_leitungswasser.md" ;;
    ST) printf '%s\n' "$SCRIPT_DIR/server/resources/workspaceTemplates/ST_sturm.md" ;;
    EL) printf '%s\n' "$SCRIPT_DIR/server/resources/workspaceTemplates/EL_elementar_und_zusatzdeckungen.md" ;;
    HP) printf '%s\n' "$SCRIPT_DIR/server/resources/workspaceTemplates/HP_haus_und_grundbesitzhaftpflicht.md" ;;
    VB) printf '%s\n' "$SCRIPT_DIR/server/resources/workspaceTemplates/VB_vertragsbestimmungen.md" ;;
    WE) printf '%s\n' "$SCRIPT_DIR/server/resources/workspaceTemplates/WE_wohnungseigentum.md" ;;
  esac
}

printf '%s\n' "[all-categories] Dokument einmalig vorbereiten"
"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/extractPolicyDocument.cjs" \
  --pdfFile "$PDF_FILE" \
  --output "$DOCUMENT_ARTIFACT"

for CATEGORY in "${CATEGORY_VIEWS[@]}"; do
  CATEGORY_DIR="$OUTPUT_DIR/$CATEGORY"
  WORKSHEET="$CATEGORY_DIR/worksheet.private.json"
  TRIAGE_DIR="$CATEGORY_DIR/triage"
  EFFECTS_DIR="$CATEGORY_DIR/effects"
  RESULT_DIR="$CATEGORY_DIR/result"
  mkdir -p "$TRIAGE_DIR" "$EFFECTS_DIR" "$RESULT_DIR"

  if [ -f "$RESULT_DIR/report.json" ] && \
     [ -f "$RESULT_DIR/answer.md" ] && \
     [ -f "$RESULT_DIR/rows.private.json" ]; then
    printf '%s\n' "[all-categories] $CATEGORY – bereits vollständig, übersprungen"
    continue
  fi

  if [ "$CATEGORY" = "VS" ]; then
    TRIAGE_PROMPT="$SCRIPT_DIR/server/resources/policyAnalysis/vs-candidate-triage-system.v0.1.md"
    EFFECTS_PROMPT="$SCRIPT_DIR/server/resources/policyAnalysis/vs-prepared-evidence-system.v0.1.md"
  else
    TRIAGE_PROMPT="$SCRIPT_DIR/server/resources/policyAnalysis/candidate-triage-system.v0.1.md"
    EFFECTS_PROMPT="$SCRIPT_DIR/server/resources/policyAnalysis/prepared-evidence-system.v0.1.md"
  fi

  printf '%s\n' "[all-categories] $CATEGORY – Worksheet"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/buildCategoryOccurrenceWorksheet.cjs" \
    --documentArtifact "$DOCUMENT_ARTIFACT" \
    --catalogFile "$(catalog_file "$CATEGORY")" \
    --output "$WORKSHEET"

  printf '%s\n' "[all-categories] $CATEGORY – Candidate-Triage"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runVsCandidateTriage.cjs" \
    --worksheet "$WORKSHEET" \
    --systemPromptFile "$TRIAGE_PROMPT" \
    --hybridSystemPromptFile "$SCRIPT_DIR/server/resources/policyAnalysis/hybrid-candidate-triage-addon.v0.1.md" \
    --controlMode technical-review \
    --output "$TRIAGE_DIR" \
    --model "$MODEL" \
    --modelTokenLimit "$MODEL_TOKEN_LIMIT" \
    --maxAttemptsPerTarget 2

  printf '%s\n' "[all-categories] $CATEGORY – atomare Wirkungsprüfung"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/runPreparedEvidenceEvaluation.cjs" \
    --worksheet "$WORKSHEET" \
    --triageFile "$TRIAGE_DIR/materialized-triage.private.json" \
    --systemPromptFile "$EFFECTS_PROMPT" \
    --controlMode technical-review \
    --documentStatus "$DOCUMENT_STATUS" \
    --output "$EFFECTS_DIR" \
    --model "$MODEL" \
    --modelTokenLimit "$MODEL_TOKEN_LIMIT" \
    --maxAttemptsPerTarget 2 \
    --allowUniqueCandidateIdRepair true

  printf '%s\n' "[all-categories] $CATEGORY – vollständige Tabelle"
  "$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/materializeCategoryFullResult.cjs" \
    --categoryView "$CATEGORY" \
    --documentKey "$DOCUMENT_KEY" \
    --pdf "$PDF_FILE" \
    --documentArtifact "$DOCUMENT_ARTIFACT" \
    --promptFile "$(prompt_file "$CATEGORY")" \
    --catalogFile "$(catalog_file "$CATEGORY")" \
    --worksheet "$WORKSHEET" \
    --triage "$TRIAGE_DIR/materialized-triage.private.json" \
    --triageReport "$TRIAGE_DIR/report.json" \
    --effects "$EFFECTS_DIR/materialized.private.json" \
    --effectsReport "$EFFECTS_DIR/report.json" \
    --sources "$EFFECTS_DIR/selected-sources.private.json" \
    --documentStatus "$DOCUMENT_STATUS" \
    --model "$MODEL" \
    --output "$RESULT_DIR"
done

"$NODE_BIN" "$SCRIPT_DIR/server/scripts/qa/summarizeAllCategoryRun.cjs" \
  --root "$OUTPUT_DIR" \
  --documentKey "$DOCUMENT_KEY" \
  --documentStatus "$DOCUMENT_STATUS" \
  --model "$MODEL"

printf '%s\n' "[all-categories] FERTIG: $OUTPUT_DIR"
printf '%s\n' "[all-categories] Zusammenfassung: $OUTPUT_DIR/summary.md"
printf '%s\n' "[all-categories] Für die Analyse zippen:"
printf 'cd %q && /usr/bin/zip -r %q .\n' "$OUTPUT_DIR" "$HOME/Desktop/ALL-CATEGORIES-QUALITY.zip"
