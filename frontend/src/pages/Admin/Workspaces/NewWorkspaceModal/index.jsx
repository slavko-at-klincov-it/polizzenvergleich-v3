import React, { useEffect, useState } from "react";
import Admin from "@/models/admin";
import Workspace from "@/models/workspace";
import { useTranslation } from "react-i18next";
import {
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalPrimaryButton,
  ModalSecondaryButton,
  ModalInput,
  ModalHint,
} from "@/components/lib/Modal";

export default function NewWorkspaceModal({ closeModal }) {
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [analysisMode, setAnalysisMode] = useState("");
  const { t } = useTranslation();
  useEffect(() => {
    let mounted = true;
    Workspace.templates().then((availableTemplates) => {
      if (mounted) setTemplates(availableTemplates);
    });
    return () => {
      mounted = false;
    };
  }, []);
  const handleCreate = async (e) => {
    setError(null);
    e.preventDefault();
    const form = new FormData(e.target);
    const { workspace, error } = await Admin.newWorkspace(
      form.get("name"),
      analysisMode
    );
    if (!!workspace) window.location.reload();
    setError(error);
  };

  return (
    <form onSubmit={handleCreate} className="flex flex-col gap-y-5">
      <ModalHeader title="Create new workspace" onClose={closeModal} />
      <ModalBody>
        <ModalInput
          label={t("common.workspaces-name")}
          name="name"
          type="text"
          placeholder="My workspace"
          minLength={4}
          required={true}
          autoComplete="off"
        />
        <fieldset className="flex flex-col gap-y-2 w-full">
          <legend className="text-sm font-medium text-zinc-50 light:text-slate-700">
            {t("new-workspace.template-title")}
          </legend>
          <ModalHint>{t("new-workspace.template-hint")}</ModalHint>
          {templates.map((template) => (
            <label
              key={template.id}
              className={`rounded-lg border p-3 cursor-pointer ${
                analysisMode === template.id
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-zinc-700 light:border-slate-300"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="analysisMode"
                  value={template.id}
                  checked={analysisMode === template.id}
                  onChange={() => setAnalysisMode(template.id)}
                  className="mt-1 accent-sky-500"
                />
                <span>
                  <span className="block text-sm text-zinc-100 light:text-slate-800">
                    {template.name}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-400 light:text-slate-500">
                    {template.description}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <p className="text-red-400 text-sm">Error: {error}</p>}
        <p className="text-zinc-400 light:text-slate-600 text-xs md:text-sm">
          After creating this workspace only admins will be able to see it. You
          can add users after it has been created.
        </p>
      </ModalBody>
      <ModalFooter>
        <ModalSecondaryButton onClick={closeModal} type="button">
          Cancel
        </ModalSecondaryButton>
        <ModalPrimaryButton type="submit" disabled={!analysisMode}>
          Create workspace
        </ModalPrimaryButton>
      </ModalFooter>
    </form>
  );
}
