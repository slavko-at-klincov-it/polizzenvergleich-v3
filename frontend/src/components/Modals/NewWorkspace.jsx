import React, { useCallback, useEffect, useRef, useState } from "react";
import Workspace from "@/models/workspace";
import paths from "@/utils/paths";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { WORKSPACE_CREATED_EVENT } from "@/utils/constants";
import Modal, {
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalPrimaryButton,
  ModalInput,
  ModalHint,
} from "@/components/lib/Modal";

const noop = () => false;
export default function NewWorkspaceModal({ hideModal = noop }) {
  const formEl = useRef(null);
  const mountedRef = useRef(true);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateError, setTemplateError] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const loadTemplates = useCallback(async () => {
    setTemplateError(null);
    setTemplatesLoading(true);
    try {
      const availableTemplates = await Workspace.templates();
      if (mountedRef.current) setTemplates(availableTemplates);
    } catch (loadError) {
      if (!mountedRef.current) return;
      setTemplates([]);
      setSelectedTemplate("");
      setTemplateError(loadError.message);
    } finally {
      if (mountedRef.current) setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadTemplates();
    return () => {
      mountedRef.current = false;
    };
  }, [loadTemplates]);

  const handleCreate = async (e) => {
    setError(null);
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const form = new FormData(formEl.current);
    const data = {
      name: form.get("name"),
      analysisMode: selectedTemplate || null,
    };
    const { workspace, message } = await Workspace.new(data);
    if (!!workspace) {
      window.dispatchEvent(
        new CustomEvent(WORKSPACE_CREATED_EVENT, { detail: { workspace } })
      );
      hideModal();
      navigate(paths.workspace.chat(workspace.slug));
      return;
    }
    setError(message);
    setSaving(false);
  };

  return (
    <Modal isOpen={true} onClose={hideModal} size="xl">
      <form
        ref={formEl}
        onSubmit={handleCreate}
        className="flex flex-col gap-y-5"
      >
        <ModalHeader
          title={t("new-workspace.title")}
          subtitle={t("new-workspace.subtitle")}
          onClose={hideModal}
        />
        <ModalBody>
          <ModalInput
            label={t("common.workspaces-name")}
            name="name"
            type="text"
            id="name"
            placeholder={t("new-workspace.placeholder")}
            required={true}
            autoComplete="off"
            autoFocus={true}
          />

          <fieldset className="flex flex-col gap-y-2 w-full">
            <legend className="text-sm font-medium text-zinc-50 light:text-slate-700">
              {t("new-workspace.template-title")}
            </legend>
            <ModalHint>{t("new-workspace.template-hint")}</ModalHint>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {templates.map((template) => (
                <TemplateChoice
                  key={template.id}
                  id={template.id}
                  name={template.name}
                  description={template.description}
                  selected={selectedTemplate === template.id}
                  onSelect={setSelectedTemplate}
                />
              ))}
            </div>
            {templateError && (
              <div className="text-sm text-red-400">
                <p>{templateError}</p>
                <button
                  type="button"
                  className="mt-2 underline"
                  onClick={loadTemplates}
                >
                  Erneut versuchen
                </button>
              </div>
            )}
          </fieldset>

          <div className="rounded-lg border border-zinc-700 light:border-slate-300 bg-zinc-800/60 light:bg-slate-50 p-4">
            <p className="text-sm font-medium text-zinc-100 light:text-slate-800 mb-2">
              {t("new-workspace.settings-title")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-300 light:text-slate-600">
              <p>{t("new-workspace.settings-chat")}</p>
              <p>{t("new-workspace.settings-vector")}</p>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">Error: {error}</p>}
        </ModalBody>
        <ModalFooter className="justify-end">
          <ModalPrimaryButton
            type="submit"
            disabled={saving || templatesLoading || !selectedTemplate}
          >
            {saving ? t("common.saving") : t("new-workspace.create")}
          </ModalPrimaryButton>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function TemplateChoice({ id, name, description, selected, onSelect }) {
  const inputId = `workspace-template-${id}`;
  return (
    <label
      htmlFor={inputId}
      className={`flex items-center gap-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
        selected
          ? "border-sky-500 bg-sky-500/10"
          : "border-zinc-700 light:border-slate-300 hover:border-zinc-500 light:hover:border-slate-400"
      }`}
    >
      <input
        id={inputId}
        type="radio"
        name="workspace-template-choice"
        value={id}
        checked={selected}
        onChange={() => onSelect(id)}
        className="accent-sky-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-100 light:text-slate-800">
          {name}
        </span>
        <span className="mt-1 block text-xs leading-4 text-zinc-400 light:text-slate-500">
          {description}
        </span>
      </span>
    </label>
  );
}

export function useNewWorkspaceModal() {
  const [showing, setShowing] = useState(false);
  const showModal = () => {
    setShowing(true);
  };
  const hideModal = () => {
    setShowing(false);
  };

  return { showing, showModal, hideModal };
}
