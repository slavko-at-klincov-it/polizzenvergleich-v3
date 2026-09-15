const STOPWORDS = new Set(
  "aber alle allen als also am an auch auf aus bei beim bis da das dass dem den der des die dies diese diesem diesen dieser dieses doch durch ein eine einem einen einer eines er es fuer für gegen hat im in ins ist je kann kein keine mit nach nicht noch nur oder ohne pro sein sind so sowie ueber über um und unter vom von vor war werden wie wird zu zum zur".split(
    " "
  )
);

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/ß/gu, "ss")
    .replace(/[^a-z0-9€%]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function bm25Index(candidates) {
  const documentFrequency = new Map();
  let totalLength = 0;
  for (const candidate of candidates) {
    const list =
      candidate.tokenList || tokens(candidate.text || candidate.exactText);
    candidate.tokenList = list;
    candidate.normalizedText =
      candidate.normalizedText ||
      normalize(candidate.text || candidate.exactText);
    totalLength += list.length;
    for (const token of new Set(list))
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  }
  return {
    candidateCount: candidates.length,
    averageLength: candidates.length ? totalLength / candidates.length : 0,
    documentFrequency,
  };
}

// German insurance terminology frequently joins a descriptive prefix with a
// stable noun head (for example a narrower A term versus the same noun used
// independently in B). Derive only long, rare suffix relations from the
// actual B corpus. These terms widen navigation; the source-bound semantic
// reviewer remains the sole authority for counterpart decisions.
function corpusCompoundLexicalVariants({
  focalTokens,
  index,
  minimumTokenLength = 7,
  minimumAffixLength = 3,
  minimumLengthRatio = 0.6,
} = {}) {
  if (
    !Array.isArray(focalTokens) ||
    !index?.documentFrequency ||
    !Number.isInteger(index.candidateCount) ||
    index.candidateCount < 1
  )
    return [];
  const corpusTokens = [...index.documentFrequency.keys()];
  return [
    ...new Set(
      focalTokens.flatMap((focalToken) =>
        corpusTokens.filter((corpusToken) => {
          if (
            focalToken === corpusToken ||
            Math.min(focalToken.length, corpusToken.length) <
              minimumTokenLength ||
            Math.abs(focalToken.length - corpusToken.length) <
              minimumAffixLength
          )
            return false;
          const shorter =
            focalToken.length < corpusToken.length ? focalToken : corpusToken;
          const longer =
            focalToken.length < corpusToken.length ? corpusToken : focalToken;
          if (
            !longer.endsWith(shorter) ||
            shorter.length / longer.length < minimumLengthRatio
          )
            return false;
          const documentFrequency =
            index.documentFrequency.get(corpusToken) || 0;
          return (
            documentFrequency === 1 ||
            documentFrequency / index.candidateCount <= 0.2
          );
        })
      )
    ),
  ].sort();
}

function rankLexicalCandidates({
  target,
  candidates,
  index = bm25Index(candidates),
  topK = 5,
  structural = false,
}) {
  const queryTokens = target.queryTokens || tokens(target.query);
  const phrases = target.phrases || [];
  const k1 = 1.2;
  const b = 0.75;
  return candidates
    .map((candidate) => {
      const frequencies = new Map();
      for (const token of candidate.tokenList)
        frequencies.set(token, (frequencies.get(token) || 0) + 1);
      let score = 0;
      const matchedTokens = [];
      for (const token of queryTokens) {
        const frequency = frequencies.get(token) || 0;
        if (!frequency) continue;
        const documentFrequency = index.documentFrequency.get(token) || 0;
        const idf = Math.log(
          1 +
            (index.candidateCount - documentFrequency + 0.5) /
              (documentFrequency + 0.5)
        );
        const lengthNormalization =
          frequency +
          k1 *
            (1 -
              b +
              b *
                (candidate.tokenList.length /
                  Math.max(index.averageLength, 1)));
        score += (idf * frequency * (k1 + 1)) / lengthNormalization;
        matchedTokens.push(token);
      }
      const phraseHits = phrases.filter((phrase) =>
        candidate.normalizedText.includes(phrase)
      );
      score += phraseHits.length * 3;
      if (structural && candidate.structuralKinds?.length)
        score *= 1 + Math.min(candidate.structuralKinds.length, 2) * 0.08;
      return { candidate, score, matchedTokens, phraseHits };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.documentStart - right.candidate.documentStart ||
        left.candidate.documentEnd - right.candidate.documentEnd
    )
    .slice(0, topK)
    .map(({ candidate, score, matchedTokens, phraseHits }, rank) => ({
      ...candidate,
      rank: rank + 1,
      score: Number(score.toFixed(8)),
      matchedTokens,
      phraseHits,
    }));
}

module.exports = {
  bm25Index,
  corpusCompoundLexicalVariants,
  normalize,
  rankLexicalCandidates,
  tokens,
};
