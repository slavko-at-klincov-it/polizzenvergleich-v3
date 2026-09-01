import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  CaretDown,
  CaretUp,
  CircleNotch,
  FilePdf,
  Plus,
  Scales,
  Trash,
  X,
} from "@phosphor-icons/react";
import PolicyComparison from "@/models/policyComparison";
import showToast from "@/utils/toast";
import { DndUploaderContext } from "../DnDWrapper";
import { saveAs } from "file-saver";
import policyComparisonUploadLock from "@/utils/chat/policyComparisonUploadLock.cjs";
import policyComparisonResultPresenter from "@/utils/chat/policyComparisonResultPresenter.cjs";

const { UNKNOWN_COMPARISON_DOCUMENT_COUNT } = policyComparisonUploadLock;
const { presentComparisonMetrics, presentPointDecision } =
  policyComparisonResultPresenter;

const ROLE_LABELS = {
  MAIN_POLICY: "Hauptpolizze",
  SUPPLEMENT: "Zusatzvertrag",
  ENDORSEMENT: "Nachtrag / Änderung",
  TERMS: "Bedingungen",
  OTHER: "Sonstiges",
};

const STATUS_LABELS = {
  ACTIVE: "Vertragswirksam",
  FRAMEWORK_TERMS: "Rahmenbedingung",
  PROPOSAL: "Vorschlag / Angebot",
};

function formatBytes(value) {
  if (!Number.isFinite(value)) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PolicyComparisonPanel({
  workspaceSlug,
  threadSlug = null,
}) {
  const { files: chatFiles = [], setComparisonDocumentCount } =
    useContext(DndUploaderContext);
  const [expanded, setExpanded] = useState(false);
  const [session, setSession] = useState(null);
  const [options, setOptions] = useState({
    documentRoles: Object.keys(ROLE_LABELS),
    documentStatuses: Object.keys(STATUS_LABELS),
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const mountedRef = useRef(true);

  const loadSession = useCallback(async () => {
    try {
      const data = await PolicyComparison.get(workspaceSlug, threadSlug);
      if (!mountedRef.current) return;
      setSession(data.session);
      if (data.session?.status !== "COMPLETED") setResult(null);
      if (data.options) setOptions(data.options);
      const documentCount = data.session?.documents?.length || 0;
      setComparisonDocumentCount?.(documentCount);
      if (documentCount > 0) setExpanded(true);
    } catch (error) {
      if (mountedRef.current) showToast(error.message, "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [workspaceSlug, threadSlug, setComparisonDocumentCount]);

  useEffect(() => {
    if (!["QUEUED", "RUNNING"].includes(session?.status)) return;
    const timer = window.setInterval(() => void loadSession(), 5000);
    return () => window.clearInterval(timer);
  }, [session?.status, loadSession]);

  useEffect(() => {
    if (session?.status !== "COMPLETED" || !session.resultAvailable || result)
      return;
    PolicyComparison.getResult({
      workspaceSlug,
      threadSlug,
      sessionUuid: session.uuid,
    })
      .then((data) => {
        if (mountedRef.current) setResult(data.result);
      })
      .catch((error) => showToast(error.message, "error"));
  }, [
    session?.status,
    session?.resultAvailable,
    session?.uuid,
    result,
    workspaceSlug,
    threadSlug,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    setComparisonDocumentCount?.(UNKNOWN_COMPARISON_DOCUMENT_COUNT);
    void loadSession();
    return () => {
      mountedRef.current = false;
      setComparisonDocumentCount?.(0);
    };
  }, [loadSession, setComparisonDocumentCount]);

  const locked = ["QUEUED", "RUNNING"].includes(session?.status);
  const chatUploadActive = chatFiles.length > 0;
  const documents = session?.documents || [];
  const totalCount = documents.length;

  async function toggleExpanded() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (!session) {
      setLoading(true);
      try {
        const data = await PolicyComparison.create(workspaceSlug, threadSlug);
        if (!mountedRef.current) return;
        setSession(data.session);
        if (data.options) setOptions(data.options);
      } catch (error) {
        showToast(error.message, "error");
        return;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    setExpanded(true);
  }

  async function uploadFiles(side, selectedFiles) {
    if (!session || busy || locked || chatUploadActive) return;
    const pdfs = Array.from(selectedFiles || []);
    if (!pdfs.length) return;
    const existing = documents.filter((document) => document.side === side);
    if (existing.length + pdfs.length > (session.limits?.perSide || 9)) {
      showToast("Pro Paket sind höchstens neun Dokumente zulässig.", "error");
      return;
    }
    setBusy(true);
    try {
      for (const [index, file] of pdfs.entries()) {
        const role =
          existing.length + index === 0 ? "MAIN_POLICY" : "SUPPLEMENT";
        await PolicyComparison.upload({
          workspaceSlug,
          threadSlug,
          sessionUuid: session.uuid,
          side,
          role,
          documentStatus: role === "TERMS" ? "FRAMEWORK_TERMS" : "ACTIVE",
          file,
        });
      }
      await loadSession();
    } catch (error) {
      showToast(error.message, "error");
      await loadSession();
    } finally {
      setBusy(false);
    }
  }

  async function updateDocument(document, changes) {
    if (busy || locked) return;
    setBusy(true);
    try {
      await PolicyComparison.updateDocument({
        workspaceSlug,
        threadSlug,
        sessionUuid: session.uuid,
        documentUuid: document.uuid,
        changes,
      });
      await loadSession();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(document) {
    if (busy || locked) return;
    setBusy(true);
    try {
      await PolicyComparison.deleteDocument({
        workspaceSlug,
        threadSlug,
        sessionUuid: session.uuid,
        documentUuid: document.uuid,
      });
      await loadSession();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetComparison() {
    if (!session || busy || locked || totalCount === 0) return;
    setBusy(true);
    try {
      const data = await PolicyComparison.reset({
        workspaceSlug,
        threadSlug,
        sessionUuid: session.uuid,
      });
      setSession(data.session);
      setResult(null);
      setComparisonDocumentCount?.(0);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function startComparison() {
    if (
      !session ||
      busy ||
      locked ||
      (session.counts?.A || 0) === 0 ||
      (session.counts?.B || 0) === 0
    )
      return;
    setBusy(true);
    setResult(null);
    try {
      const data = await PolicyComparison.start({
        workspaceSlug,
        threadSlug,
        sessionUuid: session.uuid,
      });
      setSession(data.session);
      showToast(
        "Der Vergleich der fünf Kernkategorien wurde gestartet.",
        "success"
      );
    } catch (error) {
      showToast(error.message, "error");
      await loadSession();
    } finally {
      setBusy(false);
    }
  }

  async function downloadWorkbook() {
    if (!session?.resultAvailable || busy) return;
    setBusy(true);
    try {
      const blob = await PolicyComparison.downloadWorkbook({
        workspaceSlug,
        threadSlug,
        sessionUuid: session.uuid,
      });
      saveAs(blob, "Gesamtvergleich.xlsx");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function cancelComparison() {
    if (!session || !locked || busy) return;
    setBusy(true);
    try {
      const data = await PolicyComparison.cancel({
        workspaceSlug,
        threadSlug,
        sessionUuid: session.uuid,
      });
      setSession(data.session);
      showToast("Der Vergleichslauf wurde abgebrochen.", "info");
    } catch (error) {
      showToast(error.message, "error");
      await loadSession();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-[95vw] md:w-[750px] max-h-[55vh] md:max-h-[65vh] mb-3 rounded-2xl border border-zinc-700/80 light:border-slate-300 bg-zinc-900/95 light:bg-slate-50 shadow-xl overflow-y-auto">
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-800 light:hover:bg-slate-100 transition-colors"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Scales size={20} className="shrink-0 text-sky-400" weight="bold" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white light:text-slate-900">
              Polizzenvergleich A/B
            </span>
            <span className="block truncate text-xs text-zinc-400 light:text-slate-500">
              {loading
                ? "Vergleichssitzung wird geladen …"
                : `${session?.counts?.A || 0} Dokument(e) in A · ${session?.counts?.B || 0} in B`}
            </span>
          </span>
        </span>
        {loading || busy ? (
          <CircleNotch size={18} className="animate-spin text-zinc-400" />
        ) : expanded ? (
          <CaretUp size={18} />
        ) : (
          <CaretDown size={18} />
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-700/80 light:border-slate-300 p-3">
          {chatUploadActive && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 light:text-amber-800">
              <X size={15} className="mt-0.5 shrink-0" />
              Entferne zuerst die normalen Chat-Anhänge. Chat-Upload und
              Vergleichspakete werden bewusst nicht vermischt.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PackageColumn
              side="A"
              title="Dokumentpaket A"
              documents={documents.filter(({ side }) => side === "A")}
              roleOptions={options.documentRoles}
              statusOptions={options.documentStatuses}
              disabled={loading || busy || locked || chatUploadActive}
              onFiles={(files) => uploadFiles("A", files)}
              onUpdate={updateDocument}
              onRemove={removeDocument}
            />
            <PackageColumn
              side="B"
              title="Dokumentpaket B"
              documents={documents.filter(({ side }) => side === "B")}
              roleOptions={options.documentRoles}
              statusOptions={options.documentStatuses}
              disabled={loading || busy || locked || chatUploadActive}
              onFiles={(files) => uploadFiles("B", files)}
              onUpdate={updateDocument}
              onRemove={removeDocument}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] leading-4 text-zinc-400 light:text-slate-500 max-w-[490px]">
              Die PDFs bleiben außerhalb des Workspace-Index. Rolle und
              Geltungsstatus werden pro Quelldokument gespeichert.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetComparison}
                disabled={busy || locked || totalCount === 0}
                className="px-3 py-2 rounded-lg text-xs font-medium border border-zinc-600 light:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 light:hover:bg-slate-100"
              >
                Vergleich leeren
              </button>
              {session?.resultAvailable ? (
                <button
                  type="button"
                  onClick={downloadWorkbook}
                  disabled={busy}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Excel herunterladen
                </button>
              ) : locked ? (
                <button
                  type="button"
                  onClick={cancelComparison}
                  disabled={busy}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-500 text-rose-950 hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lauf abbrechen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startComparison}
                  disabled={
                    busy ||
                    chatUploadActive ||
                    (session?.counts?.A || 0) === 0 ||
                    (session?.counts?.B || 0) === 0
                  }
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-sky-500 text-sky-950 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  5 Kernkategorien vergleichen
                </button>
              )}
            </div>
          </div>
          {locked && <ComparisonProgress progress={session.progress} />}
          {session?.status === "FAILED" && (
            <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 light:text-rose-800">
              Vergleich fehlgeschlagen: {session.error || "Unbekannter Fehler"}
            </div>
          )}
          {session?.status === "CANCELLED" && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 light:text-amber-800">
              Der letzte Vergleichslauf wurde abgebrochen. Die Pakete können
              angepasst oder erneut gestartet werden.
            </div>
          )}
          {result && <ComparisonResult result={result} />}
        </div>
      )}
    </div>
  );
}

function ComparisonProgress({ progress }) {
  const completed = progress?.completedDocuments || 0;
  const total = progress?.totalDocuments || 0;
  const completedCategories = progress?.completedCategories;
  const totalCategories = progress?.totalCategories;
  const percent =
    totalCategories > 0
      ? Math.round((completedCategories / totalCategories) * 100)
      : total > 0
        ? Math.round((completed / total) * 100)
        : 0;
  return (
    <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
      <div className="flex items-center justify-between text-xs text-sky-200 light:text-sky-800">
        <span>
          {progress?.phase === "BUILDING_COMPARISON"
            ? "Vergleichstabelle wird erstellt"
            : totalCategories > 0
              ? `Kategorien ${completedCategories}/${totalCategories}`
              : `Dokumentanalyse ${completed}/${total}`}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-700 light:bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-sky-400 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {progress?.currentDocument?.originalName && (
        <p className="mt-1.5 truncate text-[11px] text-zinc-400 light:text-slate-500">
          Aktuell: Paket {progress.currentDocument.side} ·{" "}
          {progress.currentDocument.originalName}
          {progress.currentCategory ? ` · ${progress.currentCategory}` : ""}
        </p>
      )}
    </div>
  );
}

function ComparisonResult({ result }) {
  const customerMetrics = presentComparisonMetrics(result);
  const [activeCategory, setActiveCategory] = useState(
    result.categories?.[0]?.categoryView || "VS"
  );
  const category = result.categories?.find(
    ({ categoryView }) => categoryView === activeCategory
  );
  return (
    <div className="mt-3 rounded-xl border border-emerald-500/30 overflow-hidden">
      <div className="px-3 py-2 bg-emerald-500/10">
        <p className="text-xs font-semibold text-emerald-200 light:text-emerald-800">
          Technisches Ergebnis · {customerMetrics.rows} Kategorienzeilen
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-400 light:text-slate-500">
          {result.proofLimit}
        </p>
        <p className="mt-1 text-[10px] font-semibold text-amber-200 light:text-amber-800">
          Kundenprüfung erforderlich:{" "}
          {customerMetrics.customerReviewRequired === null
            ? "nicht verfügbar"
            : customerMetrics.customerReviewRequired}
        </p>
        {customerMetrics.storedMetricDiscrepancy && (
          <p className="mt-1 text-[10px] font-semibold text-red-200 light:text-red-800">
            Gespeicherte Kennzahl widerspricht den sichtbaren Zeilen. Angezeigt
            wird die unabhängig nachgezählte Zeilenzahl.
          </p>
        )}
        {customerMetrics.customerReviewBreakdown.length > 0 && (
          <p className="mt-1 text-[10px] text-zinc-300 light:text-slate-600">
            Prüfgründe:{" "}
            {customerMetrics.customerReviewBreakdown
              .map(({ label, count }) => `${label}: ${count}`)
              .join(" · ")}
          </p>
        )}
        {customerMetrics.pointDecisions && (
          <p className="mt-1 text-[10px] text-zinc-300 light:text-slate-600">
            Punktentscheidungen: A{" "}
            {customerMetrics.pointDecisions.VORTEIL_A || 0} · B{" "}
            {customerMetrics.pointDecisions.VORTEIL_B || 0} · gleichwertig{" "}
            {customerMetrics.pointDecisions.GLEICHWERTIG || 0} · kein
            dokumentierter Vorteil{" "}
            {customerMetrics.pointDecisions.KEIN_DOKUMENTIERTER_VORTEIL || 0} ·
            Dokumentationsunterschiede{" "}
            {customerMetrics.pointDecisions.DOKUMENTATIONSUNTERSCHIED || 0} ·
            nicht vergleichbar{" "}
            {customerMetrics.pointDecisions.NICHT_VERGLEICHBAR || 0} · unklar{" "}
            {customerMetrics.pointDecisions.UNKLAR || 0}
          </p>
        )}
      </div>
      <div className="flex gap-1 overflow-x-auto p-2 border-t border-zinc-700 light:border-slate-200">
        {result.categories?.map(({ categoryView }) => (
          <button
            type="button"
            key={categoryView}
            onClick={() => setActiveCategory(categoryView)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium ${
              categoryView === activeCategory
                ? "bg-sky-500 text-sky-950"
                : "bg-zinc-800 light:bg-slate-100 text-zinc-300 light:text-slate-600"
            }`}
          >
            {categoryView}
          </button>
        ))}
      </div>
      <div className="max-h-[320px] overflow-auto border-t border-zinc-700 light:border-slate-200">
        <table className="min-w-[1050px] w-full text-[11px]">
          <thead className="sticky top-0 bg-zinc-800 light:bg-slate-100 text-zinc-200 light:text-slate-700">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Kategorie</th>
              <th className="p-2 text-left">Paket A</th>
              <th className="p-2 text-left">Paket B</th>
              <th className="p-2 text-left">Punktentscheidung</th>
            </tr>
          </thead>
          <tbody>
            {category?.rows?.map((row) => {
              const pointDecision = presentPointDecision(row);
              return (
                <tr
                  key={row.categoryId}
                  className="border-t border-zinc-800 light:border-slate-200 align-top"
                >
                  <td className="p-2 font-semibold whitespace-nowrap">
                    {row.categoryId}
                  </td>
                  <td className="p-2 min-w-[170px]">{row.categoryName}</td>
                  <PackageResultCell value={row.packageA} />
                  <PackageResultCell value={row.packageB} />
                  <td className="p-2 min-w-[270px]">
                    <span className="inline-flex rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-200 light:text-sky-800">
                      {pointDecision.label}
                    </span>
                    <p className="mt-1.5">{pointDecision.reason}</p>
                    <p className="mt-1 text-[10px] text-zinc-500 light:text-slate-500">
                      Regel: {pointDecision.ruleId} · Technisch: {row.outcome}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PackageResultCell({ value }) {
  return (
    <td className="p-2 min-w-[300px]">
      <div className="flex flex-wrap gap-1 mb-1.5">
        <span className="rounded-full border border-zinc-600 light:border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold">
          {value.reviewStatus}
        </span>
        <span className="rounded-full bg-zinc-800 light:bg-slate-100 px-1.5 py-0.5 text-[10px]">
          Deckung: {value.coverage}
        </span>
        <span className="rounded-full bg-zinc-800 light:bg-slate-100 px-1.5 py-0.5 text-[10px]">
          Betrag: {value.coverageAmount}
        </span>
      </div>
      <p className="whitespace-pre-wrap">{value.documentedContent}</p>
      <details className="mt-1.5 text-[10px] text-zinc-400 light:text-slate-500">
        <summary className="cursor-pointer">Quellen anzeigen</summary>
        <p className="mt-1 whitespace-pre-wrap">{value.source}</p>
      </details>
    </td>
  );
}

function PackageColumn({
  side,
  title,
  documents,
  roleOptions,
  statusOptions,
  disabled,
  onFiles,
  onUpdate,
  onRemove,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (!disabled) onFiles(event.dataTransfer.files);
  }

  return (
    <section className="rounded-xl border border-zinc-700 light:border-slate-300 bg-zinc-950/40 light:bg-white p-2.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white light:text-slate-900">
          {title}
        </h3>
        <span className="text-[11px] text-zinc-400 light:text-slate-500">
          {documents.length}/9
        </span>
      </div>
      <div className="space-y-2">
        {documents.map((document) => (
          <DocumentRow
            key={document.uuid}
            document={document}
            roleOptions={roleOptions}
            statusOptions={statusOptions}
            disabled={disabled}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging(false);
        }}
        onDrop={handleDrop}
        disabled={disabled || documents.length >= 9}
        className={`mt-2 w-full min-h-[64px] flex items-center justify-center gap-2 rounded-lg border border-dashed text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          dragging
            ? "border-sky-400 bg-sky-500/10 text-sky-300"
            : "border-zinc-600 light:border-slate-300 text-zinc-300 light:text-slate-600 hover:border-sky-400 hover:text-sky-300"
        }`}
      >
        <Plus size={16} weight="bold" />
        PDF(s) für Paket {side} ablegen
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        disabled={disabled || documents.length >= 9}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </section>
  );
}

function DocumentRow({
  document,
  roleOptions,
  statusOptions,
  disabled,
  onUpdate,
  onRemove,
}) {
  return (
    <div className="rounded-lg border border-zinc-700/70 light:border-slate-200 bg-zinc-900 light:bg-slate-50 p-2">
      <div className="flex items-start gap-2">
        <FilePdf size={18} className="mt-0.5 shrink-0 text-rose-400" />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs font-medium text-zinc-100 light:text-slate-800"
            title={document.originalName}
          >
            {document.originalName}
          </p>
          <p className="text-[10px] text-zinc-500 light:text-slate-500">
            {formatBytes(document.byteSize)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(document)}
          disabled={disabled}
          className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
          aria-label={`${document.originalName} entfernen`}
        >
          <Trash size={15} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5">
        <select
          value={document.role}
          disabled={disabled}
          onChange={(event) => onUpdate(document, { role: event.target.value })}
          className="w-full rounded-md border border-zinc-700 light:border-slate-300 bg-zinc-800 light:bg-white px-2 py-1.5 text-[11px] text-zinc-100 light:text-slate-700"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role] || role}
            </option>
          ))}
        </select>
        <select
          value={document.documentStatus}
          disabled={disabled}
          onChange={(event) =>
            onUpdate(document, { documentStatus: event.target.value })
          }
          className="w-full rounded-md border border-zinc-700 light:border-slate-300 bg-zinc-800 light:bg-white px-2 py-1.5 text-[11px] text-zinc-100 light:text-slate-700"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status] || status}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
