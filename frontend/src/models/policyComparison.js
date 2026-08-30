import { fullApiUrl } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

function scopedUrl(workspaceSlug, suffix = "", threadSlug = null) {
  const url = new URL(
    `${fullApiUrl()}/workspace/${workspaceSlug}/policy-comparison${suffix}`
  );
  if (threadSlug) url.searchParams.set("threadSlug", threadSlug);
  return url;
}

async function responseData(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `Comparison request failed (${response.status})`);
  return data;
}

const PolicyComparison = {
  get: async function (workspaceSlug, threadSlug = null) {
    const response = await fetch(scopedUrl(workspaceSlug, "", threadSlug), {
      method: "GET",
      headers: baseHeaders(),
    });
    return responseData(response);
  },

  create: async function (workspaceSlug, threadSlug = null) {
    const response = await fetch(scopedUrl(workspaceSlug, "", threadSlug), {
      method: "POST",
      headers: baseHeaders(),
    });
    return responseData(response);
  },

  upload: async function ({
    workspaceSlug,
    threadSlug = null,
    sessionUuid,
    side,
    role,
    documentStatus,
    file,
  }) {
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("side", side);
    body.append("role", role);
    body.append("documentStatus", documentStatus);
    const response = await fetch(
      scopedUrl(
        workspaceSlug,
        `/${sessionUuid}/documents`,
        threadSlug
      ),
      { method: "POST", headers: baseHeaders(), body }
    );
    return responseData(response);
  },

  updateDocument: async function ({
    workspaceSlug,
    threadSlug = null,
    sessionUuid,
    documentUuid,
    changes,
  }) {
    const response = await fetch(
      scopedUrl(
        workspaceSlug,
        `/${sessionUuid}/documents/${documentUuid}`,
        threadSlug
      ),
      {
        method: "PATCH",
        headers: baseHeaders(),
        body: JSON.stringify(changes),
      }
    );
    return responseData(response);
  },

  deleteDocument: async function ({
    workspaceSlug,
    threadSlug = null,
    sessionUuid,
    documentUuid,
  }) {
    const response = await fetch(
      scopedUrl(
        workspaceSlug,
        `/${sessionUuid}/documents/${documentUuid}`,
        threadSlug
      ),
      { method: "DELETE", headers: baseHeaders() }
    );
    return responseData(response);
  },

  reset: async function ({
    workspaceSlug,
    threadSlug = null,
    sessionUuid,
  }) {
    const response = await fetch(
      scopedUrl(workspaceSlug, `/${sessionUuid}/reset`, threadSlug),
      { method: "POST", headers: baseHeaders() }
    );
    return responseData(response);
  },

  start: async function ({
    workspaceSlug,
    threadSlug = null,
    sessionUuid,
  }) {
    const response = await fetch(
      scopedUrl(workspaceSlug, `/${sessionUuid}/start`, threadSlug),
      { method: "POST", headers: baseHeaders() }
    );
    return responseData(response);
  },

  cancel: async function ({
    workspaceSlug,
    threadSlug = null,
    sessionUuid,
  }) {
    const response = await fetch(
      scopedUrl(workspaceSlug, `/${sessionUuid}/cancel`, threadSlug),
      { method: "POST", headers: baseHeaders() }
    );
    return responseData(response);
  },

  getResult: async function ({
    workspaceSlug,
    threadSlug = null,
    sessionUuid,
  }) {
    const response = await fetch(
      scopedUrl(workspaceSlug, `/${sessionUuid}/result`, threadSlug),
      { method: "GET", headers: baseHeaders() }
    );
    return responseData(response);
  },

  downloadWorkbook: async function ({
    workspaceSlug,
    threadSlug = null,
    sessionUuid,
  }) {
    const response = await fetch(
      scopedUrl(
        workspaceSlug,
        `/${sessionUuid}/download/xlsx`,
        threadSlug
      ),
      { method: "GET", headers: baseHeaders() }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Workbook download failed");
    }
    return response.blob();
  },
};

export default PolicyComparison;
