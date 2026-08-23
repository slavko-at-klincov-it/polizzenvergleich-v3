import { useState, useEffect, createContext, useContext, useRef } from "react";
import { v4 } from "uuid";
import System from "@/models/system";
import { useDropzone } from "react-dropzone";
import DndIcon from "./dnd-icon.png";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";
import { THREAD_CREATED_EVENT } from "@/components/Sidebar/ActiveWorkspaces/ThreadContainer";

export const DndUploaderContext = createContext();
export const REMOVE_ATTACHMENT_EVENT = "ATTACHMENT_REMOVE";
export const CLEAR_ATTACHMENTS_EVENT = "ATTACHMENT_CLEAR";
export const PASTE_ATTACHMENT_EVENT = "ATTACHMENT_PASTED";
export const ATTACHMENTS_PROCESSING_EVENT = "ATTACHMENTS_PROCESSING";
export const ATTACHMENTS_PROCESSED_EVENT = "ATTACHMENTS_PROCESSED";
export const COMPARISON_DOCUMENTS_CHANGED_EVENT =
  "COMPARISON_DOCUMENTS_CHANGED";
export const PARSED_FILE_ATTACHMENT_REMOVED_EVENT =
  "PARSED_FILE_ATTACHMENT_REMOVED";

/**
 * File Attachment for automatic upload on the chat container page.
 * @typedef Attachment
 * @property {string} uid - unique file id.
 * @property {File} file - native File object
 * @property {string|null} contentString - base64 encoded string of file
 * @property {('reading'|'indexing'|'ready'|'deleting'|'failed'|'success')} status - the upload status.
 * @property {string|null} error - Error message
 * @property {{id:string, location:string}|null} document - uploaded document details
 * @property {number|null} tokenCountEstimate - Approximate tokens in the parsed document.
 * @property {number|null} modelTokenCount - Exact tokens for the configured local model.
 * @property {string|null} modelTokenLabel - Short name of the tokenizer/model.
 * @property {number|null} qwenTokenCount - Exact Qwen tokens in the extracted document text.
 * @property {number|null} parsedFileId - Thread-scoped parsed source used for retry/cleanup.
 * @property {('attachment'|'comparison_document')} type - Images are prompt attachments; PDFs are thread comparison documents.
 */

/**
 * @typedef {Object} ParsedFile
 * @property {number} id - The id of the parsed file.
 * @property {string} filename - The name of the parsed file.
 * @property {number} workspaceId - The id of the workspace the parsed file belongs to.
 * @property {string|null} userId - The id of the user the parsed file belongs to.
 * @property {string|null} threadId - The id of the thread the parsed file belongs to.
 * @property {string} metadata - The metadata of the parsed file.
 * @property {number} tokenCountEstimate - The estimated token count of the parsed file.
 */

export function DnDFileUploaderProvider({
  workspace,
  threadSlug = null,
  children,
}) {
  const [files, setFiles] = useState([]);
  const filesRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);
  const [hydrating, setHydrating] = useState(Boolean(threadSlug));
  const [hydrationVersion, setHydrationVersion] = useState(0);
  const [comparisonThread, setComparisonThread] = useState(
    threadSlug ? { slug: threadSlug } : null
  );
  const threadRef = useRef(threadSlug ? { slug: threadSlug } : null);
  const threadPromiseRef = useRef(null);

  function updateFiles(updater) {
    const previous = filesRef.current;
    const next = typeof updater === "function" ? updater(previous) : updater;
    filesRef.current = next;
    setFiles(next);
  }

  function beginProcessing() {
    setProcessingCount((count) => count + 1);
  }

  function endProcessing() {
    setProcessingCount((count) => Math.max(0, count - 1));
  }

  useEffect(() => {
    System.checkDocumentProcessorOnline().then((status) => setReady(status));
  }, []);

  useEffect(() => {
    const nextThread = threadSlug ? { slug: threadSlug } : null;
    threadRef.current = nextThread;
    setComparisonThread(nextThread);
  }, [threadSlug]);

  const documentsProcessing = files.some(
    (file) =>
      file.type === "comparison_document" &&
      ["reading", "indexing", "deleting"].includes(file.status)
  );
  const isProcessing = processingCount > 0 || documentsProcessing || hydrating;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(
        isProcessing
          ? ATTACHMENTS_PROCESSING_EVENT
          : ATTACHMENTS_PROCESSED_EVENT
      )
    );
  }, [isProcessing]);

  useEffect(() => {
    const refresh = (event) => {
      const { workspaceSlug, threadSlug: changedThreadSlug } =
        event.detail || {};
      if (
        workspaceSlug === workspace?.slug &&
        changedThreadSlug === threadRef.current?.slug
      )
        setHydrationVersion((version) => version + 1);
    };
    window.addEventListener(COMPARISON_DOCUMENTS_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(COMPARISON_DOCUMENTS_CHANGED_EVENT, refresh);
  }, [workspace?.slug]);

  useEffect(() => {
    const activeSlug = comparisonThread?.slug;
    if (!workspace?.slug || !activeSlug) return;
    let cancelled = false;
    let retryTimer = null;
    setHydrating(true);
    Workspace.listComparisonDocuments(workspace.slug, activeSlug)
      .then(({ response, data }) => {
        if (cancelled || !response.ok) return;
        const documents = data?.documents ?? data?.comparisonDocuments ?? [];
        const hydrated = documents
          .slice(0, 2)
          .map(comparisonDocumentAttachment);
        updateFiles((previous) =>
          mergeHydratedComparisonDocuments(previous, hydrated)
        );
        if (
          hydrated.some((item) =>
            ["indexing", "deleting"].includes(item.status)
          )
        )
          retryTimer = window.setTimeout(
            () => setHydrationVersion((version) => version + 1),
            1_000
          );
      })
      .catch((error) => {
        if (!cancelled)
          showToast(
            error.message ||
              "Die Vergleichsdokumente konnten nicht geladen werden.",
            "error"
          );
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [workspace?.slug, comparisonThread?.slug, hydrationVersion]);

  useEffect(() => {
    window.addEventListener(REMOVE_ATTACHMENT_EVENT, handleRemove);
    window.addEventListener(CLEAR_ATTACHMENTS_EVENT, resetAttachments);
    window.addEventListener(PASTE_ATTACHMENT_EVENT, handlePastedAttachment);
    window.addEventListener(
      PARSED_FILE_ATTACHMENT_REMOVED_EVENT,
      handleRemoveParsedFile
    );

    return () => {
      window.removeEventListener(REMOVE_ATTACHMENT_EVENT, handleRemove);
      window.removeEventListener(CLEAR_ATTACHMENTS_EVENT, resetAttachments);
      window.removeEventListener(
        PARSED_FILE_ATTACHMENT_REMOVED_EVENT,
        handleRemoveParsedFile
      );
      window.removeEventListener(
        PASTE_ATTACHMENT_EVENT,
        handlePastedAttachment
      );
    };
  }, []);

  /**
   * Handles the removal of a parsed file attachment from the uploader queue.
   * Only uses the document id to remove the file from the queue
   * @param {CustomEvent<{document: ParsedFile}>} event
   */
  async function handleRemoveParsedFile(event) {
    const { document } = event.detail;
    updateFiles((prev) =>
      prev.filter((prevFile) => prevFile.document?.id !== document.id)
    );
  }

  /**
   * Remove file from uploader queue.
   * @param {CustomEvent<{uid: string}>} event
   */
  async function handleRemove(event) {
    /** @type {{uid: Attachment['uid'], document: Attachment['document'], attachmentType: Attachment['type']}} */
    const { uid, document, attachmentType } = event.detail;
    if (attachmentType !== "comparison_document") {
      updateFiles((prev) => prev.filter((prevFile) => prevFile.uid !== uid));
      return;
    }

    const activeSlug = threadRef.current?.slug;
    if (!document?.id) {
      if (event.detail?.parsedFileId) {
        await Workspace.deleteParsedFiles(workspace.slug, [
          event.detail.parsedFileId,
        ]);
      }
      updateFiles((prev) => prev.filter((prevFile) => prevFile.uid !== uid));
      return;
    }
    if (!activeSlug) return;
    updateFiles((prev) =>
      prev.map((item) =>
        item.uid === uid ? { ...item, status: "deleting", error: null } : item
      )
    );
    beginProcessing();
    try {
      const { response, data } = await Workspace.deleteComparisonDocument(
        workspace.slug,
        activeSlug,
        document.id
      );
      if (!response.ok || data?.success === false)
        throw new Error(
          data?.error || "Das Dokument konnte nicht entfernt werden."
        );
      updateFiles((prev) => prev.filter((prevFile) => prevFile.uid !== uid));
      emitComparisonDocumentsChanged(workspace.slug, activeSlug);
    } catch (error) {
      updateFiles((prev) =>
        prev.map((item) =>
          item.uid === uid
            ? { ...item, status: "failed", error: error.message }
            : item
        )
      );
    } finally {
      endProcessing();
    }
  }

  /**
   * Clear queue of attached files currently in prompt box
   */
  function resetAttachments() {
    updateFiles((previous) =>
      previous.filter((file) => file.type === "comparison_document")
    );
  }

  /**
   * Turns files into attachments we can send as body request to backend
   * for a chat.
   * @returns {{name:string,mime:string,contentString:string}[]}
   */
  function parseAttachments() {
    return (
      files
        ?.filter((file) => file.type === "attachment")
        ?.map(
          (
            /** @type {Attachment} */
            attachment
          ) => {
            return {
              name: attachment.file.name,
              mime: attachment.file.type,
              contentString: attachment.contentString,
              ...(attachment.storageFilename && {
                storageFilename: attachment.storageFilename,
              }),
            };
          }
        ) || []
    );
  }

  /**
   * Handle pasted attachments.
   * @param {CustomEvent<{files: File[]}>} event
   */
  async function handlePastedAttachment(event) {
    const { files = [], storageFilename = null } = event.detail;
    if (!files.length) return;
    await acceptFiles(files, storageFilename);
  }

  /**
   * Handle dropped files.
   * @param {Attachment[]} acceptedFiles
   * @param {any[]} _rejections
   */
  async function onDrop(acceptedFiles, _rejections) {
    setDragging(false);
    await acceptFiles(acceptedFiles);
  }

  async function ensureComparisonThread() {
    if (threadRef.current?.slug) return threadRef.current;
    if (threadPromiseRef.current) return threadPromiseRef.current;

    threadPromiseRef.current = Workspace.threads
      .new(workspace.slug)
      .then(({ thread, error }) => {
        if (!thread?.slug)
          throw new Error(
            error || "Der Vergleichs-Thread konnte nicht erstellt werden."
          );
        threadRef.current = thread;
        setComparisonThread(thread);
        window.dispatchEvent(
          new CustomEvent(THREAD_CREATED_EVENT, {
            detail: { workspaceSlug: workspace.slug, thread },
          })
        );
        return thread;
      })
      .finally(() => {
        threadPromiseRef.current = null;
      });
    return threadPromiseRef.current;
  }

  async function acceptFiles(acceptedFiles, storageFilename = null) {
    const images = acceptedFiles.filter((file) =>
      file.type.startsWith("image/")
    );
    const pdfs = acceptedFiles.filter(isPdf);
    const unsupported = acceptedFiles.filter(
      (file) => !file.type.startsWith("image/") && !isPdf(file)
    );

    if (unsupported.length > 0)
      showToast(
        "Für den Policenvergleich sind nur PDF-Dateien erlaubt. Bilder bleiben normale Chat-Anhänge.",
        "warning"
      );

    const existingPdfCount = filesRef.current.filter(
      (item) =>
        item.type === "comparison_document" &&
        (item.status !== "failed" || Boolean(item.document?.id))
    ).length;
    const acceptedPdfs = pdfs.slice(0, Math.max(0, 2 - existingPdfCount));
    if (acceptedPdfs.length < pdfs.length)
      showToast(
        "Pro Vergleich können maximal zwei PDFs verwendet werden.",
        "warning"
      );

    const imageAttachments = await Promise.all(
      images.map(async (file) => ({
        uid: v4(),
        file,
        contentString: await toBase64(file),
        status: "success",
        error: null,
        type: "attachment",
        ...(storageFilename && { storageFilename }),
      }))
    );
    const pdfAttachments = acceptedPdfs.map((file) => ({
      uid: v4(),
      file,
      contentString: null,
      status: "reading",
      error: null,
      document: null,
      type: "comparison_document",
    }));
    updateFiles((previous) => [
      ...previous,
      ...imageAttachments,
      ...pdfAttachments,
    ]);

    if (pdfAttachments.length === 0) return;
    beginProcessing();
    try {
      const thread = await ensureComparisonThread();
      await Promise.all(
        pdfAttachments.map((attachment) =>
          ingestComparisonDocument(attachment, thread.slug)
        )
      );
    } catch (error) {
      const ids = new Set(pdfAttachments.map((attachment) => attachment.uid));
      updateFiles((previous) =>
        previous.map((item) =>
          ids.has(item.uid)
            ? { ...item, status: "failed", error: error.message }
            : item
        )
      );
    } finally {
      endProcessing();
    }
  }

  async function ingestComparisonDocument(attachment, activeThreadSlug) {
    try {
      const formData = new FormData();
      formData.append("file", attachment.file, attachment.file.name);
      formData.append("threadSlug", activeThreadSlug);
      const parsed = await Workspace.parseFile(workspace.slug, formData);
      if (!parsed.response.ok || !parsed.data?.files?.[0])
        throw new Error(
          parsed.data?.error || "Der PDF-Text konnte nicht gelesen werden."
        );

      const parsedFile = parsed.data.files[0];
      updateFiles((previous) =>
        previous.map((item) =>
          item.uid === attachment.uid
            ? {
                ...item,
                status: "indexing",
                tokenCountEstimate: parsedFile.tokenCountEstimate ?? null,
                modelTokenCount: parsedFile.modelTokenCount ?? null,
                modelTokenLabel: parsedFile.modelTokenLabel ?? null,
                qwenTokenCount: parsedFile.qwenTokenCount ?? null,
                parsedFileId: parsedFile.id,
              }
            : item
        )
      );

      const embedded = await Workspace.embedComparisonDocument(
        workspace.slug,
        activeThreadSlug,
        parsedFile.id
      );
      if (!embedded.response.ok || embedded.data?.success === false) {
        const embedError = new Error(
          embedded.data?.error || "Das PDF konnte nicht indexiert werden."
        );
        embedError.document = embedded.data?.document ?? null;
        embedError.parsedFileId = parsedFile.id;
        throw embedError;
      }

      const document = embedded.data?.document ?? embedded.data;
      updateFiles((previous) =>
        previous.map((item) =>
          item.uid === attachment.uid
            ? {
                ...comparisonDocumentAttachment(document, attachment.uid),
                file: attachment.file,
                tokenCountEstimate:
                  document?.tokenCountEstimate ??
                  document?.tokenCount ??
                  parsedFile.tokenCountEstimate ??
                  null,
                modelTokenCount:
                  document?.modelTokenCount ??
                  parsedFile.modelTokenCount ??
                  null,
                modelTokenLabel:
                  document?.modelTokenLabel ??
                  parsedFile.modelTokenLabel ??
                  null,
                qwenTokenCount:
                  document?.qwenTokenCount ?? parsedFile.qwenTokenCount ?? null,
              }
            : item
        )
      );
    } catch (error) {
      updateFiles((previous) =>
        previous.map((item) =>
          item.uid === attachment.uid
            ? {
                ...item,
                status: "failed",
                error: error.message,
                document: error.document ?? item.document,
                parsedFileId: error.parsedFileId ?? item.parsedFileId ?? null,
              }
            : item
        )
      );
    } finally {
      emitComparisonDocumentsChanged(workspace.slug, activeThreadSlug);
    }
  }

  return (
    <DndUploaderContext.Provider
      value={{
        files,
        ready,
        dragging,
        setDragging,
        onDrop,
        parseAttachments,
        comparisonThread,
        ensureComparisonThread,
        isProcessing,
      }}
    >
      {children}
    </DndUploaderContext.Provider>
  );
}

export default function DnDFileUploaderWrapper({ children }) {
  const { onDrop, ready, dragging, setDragging } =
    useContext(DndUploaderContext);
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    disabled: !ready,
    noClick: true,
    noKeyboard: true,
    onDragEnter: () => setDragging(true),
    onDragLeave: () => setDragging(false),
  });

  return (
    <div
      className={`relative flex flex-col h-full w-full md:mt-0 mt-[40px] p-[1px]`}
      {...getRootProps()}
    >
      <div
        hidden={!dragging}
        className="absolute top-0 w-full h-full bg-dark-text/90 light:bg-[#C2E7FE]/90 rounded-2xl border-[4px] border-white z-[9999]"
      >
        <div className="w-full h-full flex justify-center items-center rounded-xl">
          <div className="flex flex-col gap-y-[14px] justify-center items-center">
            <img
              src={DndIcon}
              width={69}
              height={69}
              alt="Drag and drop icon"
            />
            <p className="text-white text-[24px] font-semibold">
              PDFs zum Vergleich hinzufügen
            </p>
            <p className="text-white text-[16px] text-center">
              Maximal zwei PDF-Dateien. Bilder bleiben normale <br />
              Chat-Anhänge.
            </p>
          </div>
        </div>
      </div>
      <input id="dnd-chat-file-uploader" {...getInputProps()} />
      {children}
    </div>
  );
}

/**
 * Convert image types into Base64 strings for requests.
 * @param {File} file
 * @returns {Promise<string>}
 */
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result.split(",")[1];
      resolve(`data:${file.type};base64,${base64String}`);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function isPdf(file) {
  return (
    file?.type === "application/pdf" ||
    file?.name?.toLowerCase()?.endsWith(".pdf")
  );
}

function emitComparisonDocumentsChanged(workspaceSlug, threadSlug) {
  window.dispatchEvent(
    new CustomEvent(COMPARISON_DOCUMENTS_CHANGED_EVENT, {
      detail: { workspaceSlug, threadSlug },
    })
  );
}

function mergeHydratedComparisonDocuments(previous, hydrated) {
  const promptAttachments = previous.filter(
    (item) => item.type === "attachment"
  );
  const current = previous.filter(
    (item) => item.type === "comparison_document"
  );
  const consumed = new Set();
  const remoteDocuments = hydrated.map((remote) => {
    const localIndex = current.findIndex(
      (local, index) =>
        !consumed.has(index) &&
        ((local.document?.id && local.document.id === remote.document?.id) ||
          local.file?.name === remote.file?.name)
    );
    if (localIndex < 0) return remote;
    consumed.add(localIndex);
    const local = current[localIndex];
    return {
      ...remote,
      uid: local.uid,
      file: local.file || remote.file,
    };
  });
  const localOnly = current.filter(
    (item, index) =>
      !consumed.has(index) &&
      (["reading", "indexing", "deleting"].includes(item.status) ||
        (item.status === "failed" && !item.document?.id))
  );
  return [...promptAttachments, ...localOnly, ...remoteDocuments];
}

function comparisonDocumentAttachment(document = {}, uid = null) {
  const filename =
    document.originalFilename ||
    document.name ||
    document.filename ||
    document.title ||
    "PDF-Dokument";
  const status = ["indexing", "ready", "deleting", "failed"].includes(
    document.status
  )
    ? document.status
    : "ready";
  return {
    uid: uid || `comparison-document-${document.id}`,
    file: { name: filename, type: "application/pdf" },
    contentString: null,
    status,
    error: document.error ?? null,
    document,
    tokenCountEstimate:
      document.tokenCountEstimate ?? document.tokenCount ?? null,
    modelTokenCount: document.modelTokenCount ?? document.tokenCount ?? null,
    modelTokenLabel: document.modelTokenLabel ?? "Modell",
    qwenTokenCount: document.qwenTokenCount ?? null,
    parsedFileId: document.parsedFileId ?? null,
    pageCount: document.pageCount ?? document.pages ?? null,
    type: "comparison_document",
  };
}
