const { isAbortError } = require("../helpers/abortSignals");
const { PolicyInferenceQueue } = require("./PolicyInferenceQueue");
const REDUCTION_CONTEXT_CHARACTERS = 12_000;

function reductionGroups(texts, maxCharacters = REDUCTION_CONTEXT_CHARACTERS) {
  const fragments = texts.flatMap((text) => {
    if (text.length <= maxCharacters) return [text];
    const chunks = [];
    for (let offset = 0; offset < text.length; offset += maxCharacters)
      chunks.push(text.slice(offset, offset + maxCharacters));
    return chunks;
  });
  const groups = [];
  let current = "";
  for (const fragment of fragments) {
    const next = current ? `${current}\n\n${fragment}` : fragment;
    if (current && next.length > maxCharacters) {
      groups.push(current);
      current = fragment;
    } else current = next;
  }
  if (current) groups.push(current);
  return groups;
}

/**
 * Synthesizes large comparisons in whole topic batches. Each evidence batch is
 * compressed independently, so the generic middle-truncation path can never
 * silently remove a topic or one side of an A/B cell.
 */
const ComparisonBatchSynthesizer = {
  async run({
    Connector,
    contextBatches = [],
    systemPrompt,
    userPrompt,
    chatHistory = [],
    rawHistory = [],
    attachments = [],
    temperature,
    user = null,
    signal = null,
    onBatch = null,
    onFinal = null,
    inferenceTimeoutMs = undefined,
    documentSlots = ["A", "B"],
  }) {
    const sections = [];
    const metrics = [];
    for (let index = 0; index < contextBatches.length; index++) {
      if (signal?.aborted) {
        const error = new Error("Comparison generation was cancelled.");
        error.name = "AbortError";
        throw error;
      }
      const batchNumber = index + 1;
      const scope =
        documentSlots.length === 1
          ? `Dokument ${documentSlots[0]}`
          : `Dokumente ${documentSlots.join(" und ")}`;
      const batchSystemPrompt = `${systemPrompt}\n\nDies ist Belegbatch ${batchNumber} von ${contextBatches.length}. Bearbeite jedes enthaltene Thema vollständig für ${scope}. Gib ausschließlich die belegte Analyse der Themen dieses Batches aus. Eine fehlende Fundstelle ist kein Vertragsausschluss.`;
      const messages = await Connector.compressMessages(
        {
          systemPrompt: batchSystemPrompt,
          userPrompt,
          contextTexts: [contextBatches[index]],
          chatHistory,
          attachments,
        },
        rawHistory
      );
      try {
        const result = await PolicyInferenceQueue.run({
          Connector,
          messages,
          timeoutMs: inferenceTimeoutMs,
          completionOptions: { temperature, user },
        });
        const sectionLabel =
          documentSlots.length === 1 ? "Analyseteil" : "Vergleichsteil";
        const section = `## ${sectionLabel} ${batchNumber}/${contextBatches.length}\n${result.textResponse}`;
        sections.push(section);
        metrics.push(result.metrics || {});
        if (typeof onBatch === "function") await onBatch(section, batchNumber);
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) throw error;
        throw new Error(
          `Belegbatch ${batchNumber}/${contextBatches.length} konnte nicht ausgewertet werden: ${error.message}`
        );
      }
    }

    let reductionTexts = [...sections];
    let reductionRound = 0;
    while (reductionGroups(reductionTexts).length > 1) {
      reductionRound += 1;
      if (reductionRound > 4)
        throw new Error(
          "Die vollständige Gesamtbewertung überschreitet das sichere Kontextbudget."
        );
      const reduced = [];
      for (const group of reductionGroups(reductionTexts)) {
        if (signal?.aborted) {
          const error = new Error("Comparison generation was cancelled.");
          error.name = "AbortError";
          throw error;
        }
        const messages = await Connector.compressMessages(
          {
            systemPrompt: `${systemPrompt}\n\nVerdichte die folgenden belegten Analyseteile verlustarm. Bewahre jedes Thema, die Dokumentzuordnung und vorhandene Seitenangaben. Füge keine neuen Vertragsfakten hinzu.`,
            userPrompt,
            contextTexts: [group],
            chatHistory: [],
            attachments: [],
          },
          []
        );
        const result = await PolicyInferenceQueue.run({
          Connector,
          messages,
          timeoutMs: inferenceTimeoutMs,
          completionOptions: { temperature, user },
        });
        reduced.push(result.textResponse);
        metrics.push(result.metrics || {});
      }
      reductionTexts = reduced;
    }

    const finalMessages = await Connector.compressMessages(
      {
        systemPrompt: `${systemPrompt}\n\nErstelle aus den belegten Analyseteilen eine knappe Gesamtbewertung zur Nutzerfrage. Verwende ausschließlich enthaltene Fakten, behalte Dokument- und vorhandene Seitenangaben und kennzeichne fehlende Fundstellen vorsichtig.`,
        userPrompt,
        contextTexts: [reductionTexts.join("\n\n")],
        chatHistory: [],
        attachments: [],
      },
      []
    );
    const finalResult = await PolicyInferenceQueue.run({
      Connector,
      messages: finalMessages,
      timeoutMs: inferenceTimeoutMs,
      completionOptions: { temperature, user },
    });
    metrics.push(finalResult.metrics || {});
    const finalSection = `## Gesamtbewertung\n${finalResult.textResponse}`;
    if (typeof onFinal === "function") await onFinal(finalSection);
    return {
      textResponse: `${sections.join("\n\n")}\n\n${finalSection}`,
      metrics,
    };
  },
};

module.exports = { ComparisonBatchSynthesizer, reductionGroups };
