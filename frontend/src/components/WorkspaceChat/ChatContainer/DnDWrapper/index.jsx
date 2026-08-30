import { useState, useEffect, createContext, useContext, useRef } from "react";
import { v4 } from "uuid";
import System from "@/models/system";
import { useDropzone } from "react-dropzone";
import DndIcon from "./dnd-icon.png";
import Workspace from "@/models/workspace";
import {
  countActiveDocumentUploads,
  embedParsedDocumentParts,
  summarizeParsedDocumentTokens,
} from "@/utils/chatAttachmentProcessing";
import showToast from "@/utils/toast";

export const DndUploaderContext = createContext();
export const REMOVE_ATTACHMENT_EVENT = "ATTACHMENT_REMOVE";
export const CLEAR_ATTACHMENTS_EVENT = "ATTACHMENT_CLEAR";
export const PASTE_ATTACHMENT_EVENT = "ATTACHMENT_PASTED";
export const ATTACHMENTS_PROCESSING_EVENT = "ATTACHMENTS_PROCESSING";
export const ATTACHMENTS_PROCESSED_EVENT = "ATTACHMENTS_PROCESSED";
export const PARSED_FILE_ATTACHMENT_REMOVED_EVENT =
  "PARSED_FILE_ATTACHMENT_REMOVED";

/**
 * File Attachment for automatic upload on the chat container page.
 * @typedef Attachment
 * @property {string} uid - unique file id.
 * @property {File} file - native File object
 * @property {string|null} contentString - base64 encoded string of file
 * @property {('reading'|'indexing'|'ready'|'failed'|'success')} status - the automatic upload status.
 * @property {string|null} error - Error message
 * @property {{id:string, location?:string, docpath?:string}|null} document - first indexed document (legacy UI compatibility)
 * @property {{id:string, location?:string, docpath?:string}[]} documents - all indexed document parts
 * @property {number[]} parsedFileIds - Temporary parsed-file handles.
 * @property {number|null} documentTokenCount - Tokens in the extracted document text.
 * @property {('exact_model'|'estimated')|null} documentTokenCountKind - Provenance of the document token count.
 * @property {string|null} documentTokenLabel - Configured tokenizer label for exact counts.
 * @property {('attachment'|'upload')} type - The type of upload. Attachments are chat-specific, uploads go to the workspace.
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
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [comparisonDocumentCount, setComparisonDocumentCount] = useState(0);
  const comparisonDocumentCountRef = useRef(0);
  const processingCount = countActiveDocumentUploads(files);

  useEffect(() => {
    comparisonDocumentCountRef.current = comparisonDocumentCount;
  }, [comparisonDocumentCount]);

  useEffect(() => {
    System.checkDocumentProcessorOnline().then((status) => setReady(status));
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(
        processingCount > 0
          ? ATTACHMENTS_PROCESSING_EVENT
          : ATTACHMENTS_PROCESSED_EVENT,
        { detail: { pendingCount: processingCount } }
      )
    );
  }, [processingCount]);

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
    setFiles((prev) =>
      prev.filter((prevFile) => prevFile.document?.id !== document.id)
    );
  }

  /**
   * Remove file from uploader queue.
   * @param {CustomEvent<{uid: string}>} event
   */
  async function handleRemove(event) {
    /** @type {{uid: Attachment['uid'], document: Attachment['document'], documents?: Attachment['documents'], parsedFileIds?: number[]}} */
    const { uid, document, documents = [], parsedFileIds = [] } = event.detail;
    setFiles((prev) => prev.filter((prevFile) => prevFile.uid !== uid));
    if (parsedFileIds.length)
      await Workspace.deleteParsedFiles(workspace.slug, parsedFileIds);
    const indexedDocuments = documents.length ? documents : [document];
    await Promise.all(
      indexedDocuments.map((indexedDocument) => {
        const location = indexedDocument?.location || indexedDocument?.docpath;
        if (!location) return true;
        return Workspace.deleteAndUnembedFile(workspace.slug, location);
      })
    );
  }

  /**
   * Clear queue of attached files currently in prompt box
   */
  function resetAttachments() {
    setFiles([]);
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

  async function acceptFiles(acceptedFiles, storageFilename = null) {
    if (comparisonDocumentCountRef.current > 0) {
      showToast(
        "Der normale Chat-Upload ist gesperrt, solange Dokumente im Polizzenvergleich liegen.",
        "warning"
      );
      return;
    }
    /** @type {Attachment[]} */
    const newAccepted = [];
    for (const file of acceptedFiles) {
      if (file.type.startsWith("image/")) {
        newAccepted.push({
          uid: v4(),
          file,
          contentString: await toBase64(file),
          status: "success",
          error: null,
          type: "attachment",
          ...(storageFilename && { storageFilename }),
        });
      } else {
        newAccepted.push({
          uid: v4(),
          file,
          contentString: null,
          status: "reading",
          error: null,
          parsedFileIds: [],
          type: "upload",
        });
      }
    }

    setFiles((prev) => [...prev, ...newAccepted]);
    void embedEligibleAttachments(newAccepted);
  }

  /**
   * Embeds attachments that are eligible for embedding - basically files that are not images.
   * @param {Attachment[]} newAttachments
   */
  async function embedEligibleAttachments(newAttachments = []) {
    const uploads = newAttachments.filter(
      (attachment) => attachment.type === "upload"
    );
    await Promise.all(
      uploads.map(async (attachment) => {
        let parsedFileIds = [];
        try {
          const formData = new FormData();
          formData.append("file", attachment.file, attachment.file.name);
          formData.append("threadSlug", threadSlug || null);
          const { response: parseResponse, data: parseData } =
            await Workspace.parseFile(workspace.slug, formData);
          if (!parseResponse.ok || !parseData?.success)
            throw new Error(parseData?.error || "Document parsing failed");

          const parsedFiles = Array.isArray(parseData.files)
            ? parseData.files
            : [];
          if (!parsedFiles.length)
            throw new Error("Document parser returned no files");
          parsedFileIds = parsedFiles.map((file) => file.id);
          const tokenSummary = summarizeParsedDocumentTokens(parsedFiles);

          setFiles((prev) =>
            prev.map((prevFile) =>
              prevFile.uid === attachment.uid
                ? {
                    ...prevFile,
                    status: "indexing",
                    parsedFileIds,
                    documentTokenCount: tokenSummary?.count ?? null,
                    documentTokenCountKind: tokenSummary?.kind ?? null,
                    documentTokenLabel: tokenSummary?.label ?? null,
                  }
                : prevFile
            )
          );

          const embedResult = await embedParsedDocumentParts({
            parsedFiles,
            embed: (fileId) =>
              Workspace.embedParsedFile(workspace.slug, fileId),
            rollback: (location) =>
              Workspace.deleteAndUnembedFile(workspace.slug, location),
          });
          parsedFileIds = embedResult.remainingParsedFileIds;
          if (!embedResult.success) throw new Error(embedResult.error);

          setFiles((prev) =>
            prev.map((prevFile) =>
              prevFile.uid === attachment.uid
                ? {
                    ...prevFile,
                    status: "ready",
                    error: null,
                    parsedFileIds: [],
                    document: embedResult.documents[0] ?? null,
                    documents: embedResult.documents,
                  }
                : prevFile
            )
          );
        } catch (error) {
          setFiles((prev) =>
            prev.map((prevFile) =>
              prevFile.uid === attachment.uid
                ? {
                    ...prevFile,
                    status: "failed",
                    error: error.message || "Document indexing failed",
                    parsedFileIds,
                  }
                : prevFile
            )
          );
        }
      })
    );
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
        comparisonDocumentCount,
        setComparisonDocumentCount,
      }}
    >
      {children}
    </DndUploaderContext.Provider>
  );
}

export default function DnDFileUploaderWrapper({ children }) {
  const {
    onDrop,
    ready,
    dragging,
    setDragging,
    comparisonDocumentCount = 0,
  } =
    useContext(DndUploaderContext);
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    disabled: !ready || comparisonDocumentCount > 0,
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
            <p className="text-white text-[24px] font-semibold">Add anything</p>
            <p className="text-white text-[16px] text-center">
              Drop a file or image here to attach it to your <br />
              workspace auto-magically.
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
