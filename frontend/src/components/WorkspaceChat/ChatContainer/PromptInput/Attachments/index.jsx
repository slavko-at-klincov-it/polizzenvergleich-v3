import {
  CircleNotch,
  FileCode,
  FileCsv,
  FileDoc,
  FileHtml,
  FileText,
  FileImage,
  FilePdf,
  WarningOctagon,
  X,
} from "@phosphor-icons/react";
import { REMOVE_ATTACHMENT_EVENT } from "../../DnDWrapper";
import { openImageLightbox } from "@/components/ImageLightbox";

/**
 * @param {{attachments: import("../../DnDWrapper").Attachment[]}}
 * @returns
 */
export default function AttachmentManager({ attachments }) {
  if (attachments.length === 0) return null;

  function handleImageClick(attachment) {
    const imageAttachments = attachments
      .filter((a) => a.type === "attachment" && a.contentString)
      .map((a) => ({ contentString: a.contentString, name: a.file.name }));
    const idx = imageAttachments.findIndex(
      (img) => img.name === attachment.file?.name
    );
    if (idx !== -1) openImageLightbox(imageAttachments, idx);
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2 mb-4">
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.uid}
          attachment={attachment}
          onImageClick={() => handleImageClick(attachment)}
        />
      ))}
    </div>
  );
}

/**
 * @param {{attachment: import("../../DnDWrapper").Attachment}}
 */
function AttachmentItem({ attachment, onImageClick }) {
  const {
    uid,
    file,
    status,
    error,
    document,
    tokenCountEstimate,
    modelTokenCount,
    modelTokenLabel,
    qwenTokenCount,
    parsedFileId,
    pageCount,
    type,
    contentString,
  } = attachment;
  const { iconBgColor, Icon } = displayFromFile(file);
  const exactModelTokenLabel = Number.isFinite(modelTokenCount)
    ? `${new Intl.NumberFormat().format(modelTokenCount)} ${modelTokenLabel || "Modell"}-Tokens`
    : null;
  const legacyQwenTokenLabel = Number.isFinite(qwenTokenCount)
    ? `${new Intl.NumberFormat().format(qwenTokenCount)} Tokens`
    : null;
  const estimatedTokenLabel = Number.isFinite(tokenCountEstimate)
    ? `ca. ${new Intl.NumberFormat().format(tokenCountEstimate)} Tokens`
    : null;
  const tokenLabel =
    exactModelTokenLabel ?? legacyQwenTokenLabel ?? estimatedTokenLabel;
  const pageLabel = Number.isFinite(pageCount)
    ? `${new Intl.NumberFormat().format(pageCount)} Seiten`
    : null;

  function removeFileFromQueue() {
    window.dispatchEvent(
      new CustomEvent(REMOVE_ATTACHMENT_EVENT, {
        detail: { uid, document, attachmentType: type, parsedFileId },
      })
    );
  }

  if (["in_progress", "reading", "indexing", "deleting"].includes(status)) {
    const progressLabel =
      status === "indexing"
        ? document?.status === "ready" && document?.inventoryStatus !== "ready"
          ? "Inventar wird erstellt …"
          : "Wird indexiert …"
        : status === "deleting"
          ? "Wird entfernt …"
          : "Text wird gelesen …";
    return (
      <div className="relative flex items-center gap-x-1 rounded-lg bg-theme-attachment-bg border-none w-[180px] group">
        <div
          className={`bg-theme-attachment-icon-spinner-bg rounded-md flex items-center justify-center flex-shrink-0 h-[32px] w-[32px] m-1`}
        >
          <CircleNotch
            size={18}
            weight="bold"
            className="text-theme-attachment-icon-spinner animate-spin"
          />
        </div>
        <div className="flex flex-col w-[125px]">
          <p className="text-theme-attachment-text text-xs font-semibold truncate">
            {file.name}
          </p>
          <p className="text-theme-attachment-text-secondary text-[10px] leading-[14px] font-medium">
            {progressLabel}
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div
        data-tooltip-id="attachment-status-tooltip"
        data-tooltip-content={error}
        className={`relative flex items-center gap-x-1 rounded-lg bg-theme-attachment-error-bg border-none w-[180px] group`}
      >
        <div className="invisible group-hover:visible absolute -top-[5px] -right-[5px] w-fit h-fit z-[10]">
          <button
            onClick={removeFileFromQueue}
            type="button"
            className="bg-white hover:bg-error hover:text-theme-attachment-text rounded-full p-1 flex items-center justify-center hover:border-transparent border border-theme-attachment-bg"
          >
            <X size={10} className="flex-shrink-0" />
          </button>
        </div>
        <div
          className={`bg-error rounded-md flex items-center justify-center flex-shrink-0 h-[32px] w-[32px] m-1`}
        >
          <WarningOctagon size={24} className="text-theme-attachment-icon" />
        </div>
        <div className="flex flex-col w-[125px]">
          <p className="text-theme-attachment-text text-xs font-semibold truncate">
            {file.name}
          </p>
          <p className="text-theme-attachment-text-secondary text-[10px] leading-[14px] font-medium truncate">
            {error ?? "File not embedded!"}
          </p>
        </div>
      </div>
    );
  }

  if (type === "attachment") {
    if (contentString) {
      return (
        <div
          data-tooltip-id="attachment-status-tooltip"
          data-tooltip-content={`${file.name} will be attached to this prompt. It will not be embedded into the workspace permanently.`}
          className={`relative flex items-center gap-x-1 rounded-lg border-none group`}
        >
          <div className="invisible group-hover:visible absolute -top-[5px] -right-[5px] w-fit h-fit z-[10]">
            <button
              onClick={removeFileFromQueue}
              type="button"
              className="bg-white hover:bg-error hover:text-theme-attachment-text rounded-full p-1 flex items-center justify-center hover:border-transparent border border-theme-attachment-bg"
            >
              <X size={10} className="flex-shrink-0" />
            </button>
          </div>
          <button
            type="button"
            onClick={onImageClick}
            className="p-0 border-none bg-transparent cursor-pointer"
          >
            <img
              alt={`Preview of ${file.name}`}
              src={contentString}
              style={{ objectFit: "cover", objectPosition: "center" }}
              className={`${iconBgColor} w-[40px] h-[40px] rounded-lg flex items-center justify-center`}
            />
          </button>
        </div>
      );
    }

    return (
      <div
        data-tooltip-id="attachment-status-tooltip"
        data-tooltip-content={`${file.name} will be attached to this prompt. It will not be embedded into the workspace permanently.`}
        className={`relative flex items-center gap-x-1 rounded-lg bg-theme-attachment-success-bg border-none w-[180px] group`}
      >
        <div className="invisible group-hover:visible absolute -top-[5px] -right-[5px] w-fit h-fit z-[10]">
          <button
            onClick={removeFileFromQueue}
            type="button"
            className="bg-white hover:bg-error hover:text-theme-attachment-text rounded-full p-1 flex items-center justify-center hover:border-transparent border border-theme-attachment-bg"
          >
            <X size={10} className="flex-shrink-0" />
          </button>
        </div>
        <div
          className={`${iconBgColor} rounded-md flex items-center justify-center flex-shrink-0 h-[32px] w-[32px] m-1`}
        >
          <Icon size={24} className="text-theme-attachment-icon" />
        </div>
        <div className="flex flex-col w-[125px]">
          <p className="text-theme-attachment-text text-xs font-semibold truncate">
            {file.name}
          </p>
          <p className="text-theme-attachment-text-secondary text-[10px] leading-[14px] font-medium">
            Image attached!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-tooltip-id="attachment-status-tooltip"
      data-tooltip-content={
        status === "ready"
          ? `${file.name} ist für diesen Vergleich indexiert.${tokenLabel ? ` Extrahierter Text: ${tokenLabel}.` : ""}`
          : `${file.name} wird nur in diesem Vergleich verwendet.`
      }
      className={`relative flex items-center gap-x-1 rounded-lg bg-theme-attachment-bg border-none w-[180px] group`}
    >
      <div className="invisible group-hover:visible absolute -top-[5px] -right-[5px] w-fit h-fit z-[10]">
        <button
          onClick={removeFileFromQueue}
          type="button"
          className="bg-white hover:bg-error hover:text-theme-attachment-text rounded-full p-1 flex items-center justify-center hover:border-transparent border border-theme-attachment-bg"
        >
          <X size={10} className="flex-shrink-0" />
        </button>
      </div>
      <div
        className={`${iconBgColor} rounded-md flex items-center justify-center flex-shrink-0 h-[32px] w-[32px] m-1`}
      >
        <Icon size={24} weight="light" className="text-theme-attachment-icon" />
      </div>
      <div className="flex flex-col w-[125px]">
        <p className="text-white text-xs font-semibold truncate">{file.name}</p>
        <p className="text-theme-attachment-text-secondary text-[10px] leading-[14px] font-medium">
          {status === "ready"
            ? `Bereit${pageLabel ? ` · ${pageLabel}` : ""}${tokenLabel ? ` · ${tokenLabel}` : ""}`
            : "Zum Vergleich hinzugefügt"}
        </p>
      </div>
    </div>
  );
}

/**
 * @param {File} file
 * @returns {{iconBgColor:string, Icon: React.Component}}
 */
function displayFromFile(file) {
  const extension = file?.name?.split(".")?.pop()?.toLowerCase() ?? "txt";
  switch (extension) {
    case "pdf":
      return { iconBgColor: "bg-magenta", Icon: FilePdf };
    case "doc":
    case "docx":
      return { iconBgColor: "bg-royalblue", Icon: FileDoc };
    case "html":
      return { iconBgColor: "bg-purple", Icon: FileHtml };
    case "csv":
    case "xlsx":
      return { iconBgColor: "bg-success", Icon: FileCsv };
    case "json":
    case "sql":
    case "js":
    case "jsx":
    case "cpp":
    case "c":
      return { iconBgColor: "bg-warn", Icon: FileCode };
    case "png":
    case "jpg":
    case "jpeg":
      return { iconBgColor: "bg-royalblue", Icon: FileImage };
    default:
      return { iconBgColor: "bg-royalblue", Icon: FileText };
  }
}
