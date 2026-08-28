/**
 * How near two paragraphs are, and the cheap bounds that decide whether the near
 * comparison is worth running.
 *
 * Extracted from the drift guard so the bounds can be asserted directly. They were
 * reasoned about rather than measured, and one of them was wrong for months in a way
 * no test could see: the guard silently returned "not similar" for the exact band
 * where a shared paragraph with one sentence added or removed lands.
 */

/** Above this, two paragraphs are the same paragraph — one of them edited. */
export const SAME_PARAGRAPH = 0.9;

/**
 * A cheap lower bound on the SYMMETRIC reading, used to skip the expensive comparison.
 *
 * Two paragraphs sharing 90% of their characters in order share almost all of their
 * words, so a Jaccard overlap this far below the real threshold cannot exclude a
 * near-duplicate reached by ADDITION.
 *
 * It excludes plenty reached by deletion, though, and that was the hole: Jaccard
 * divides by the UNION, so dropping sentences from one copy drives it down even while
 * every surviving word is shared. Measured on a five-sentence shared paragraph, a copy
 * keeping two sentences scores 0.383 here — less than half the 0.82 this floor was
 * once justified by — while its similarity is 1.000. The floor is the same shape of
 * mistake the old length bound was, one threshold down, so it is no longer the only
 * way in: see SHINGLE_CONTAINMENT_FLOOR.
 */
export const WORD_OVERLAP_FLOOR = 0.4;

/** How many consecutive words make a shingle. */
const SHINGLE_SIZE = 5;

/**
 * The other way in, and the one a deletion survives.
 *
 * A copy with text removed keeps every word-shingle of the text it retained, so
 * containment over shingles is ~1 for a deletion of any depth while Jaccard collapses.
 * Shingles rather than bare words because bare-word containment is useless here: on
 * this library's own corpus it admitted 33341 pairs where Jaccard admitted 111, since
 * a short paragraph of ordinary English words is "contained" in most longer ones.
 * Five-word runs are not: measured over the same corpus this admits FEWER pairs than
 * Jaccard does (3 against 8) while scoring 1.000 on every deletion depth and 0.000 on
 * unrelated prose.
 */
export const SHINGLE_CONTAINMENT_FLOOR = 0.5;

/** The word-runs of a paragraph, the unit the containment bound is measured over. */
export function shingles(text: string): Set<string> {
  const run = text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
  const found = new Set<string>();
  for (let index = 0; index + SHINGLE_SIZE <= run.length; index += 1) {
    found.add(run.slice(index, index + SHINGLE_SIZE).join(' '));
  }
  return found;
}

/** What fraction of the SHORTER paragraph's shingles the longer one also has. */
export function shingleContainment(a: Set<string>, b: Set<string>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  if (small.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const run of small) {
    if (large.has(run)) {
      shared += 1;
    }
  }
  return shared / small.size;
}

export function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean)
  );
}

export function wordOverlap(a: Set<string>, b: Set<string>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const word of small) {
    if (large.has(word)) {
      shared += 1;
    }
  }
  return shared / (a.size + b.size - shared);
}

/**
 * How near two paragraphs are, on the higher of two readings of one LCS.
 *
 * The symmetric reading, 2·LCS/(|a|+|b|), is the difflib measure, and it answers "how
 * much of BOTH strings is shared". It charges a deletion twice — once for the missing
 * characters and once for the length gap it opens — so one copy of a two-sentence
 * paragraph with a sentence removed scored 0.000 against the other. There is no bound
 * that repairs that, because the number itself is right and the QUESTION is wrong: the
 * copies really do share only half their combined length.
 *
 * The containment reading, LCS/|shorter|, answers "how much of the SHORTER string is
 * shared", which is 1 for a copy with something taken out of it, and that is the drift
 * being looked for.
 *
 * It is the more permissive of the two, and a minimum paragraph length is NOT what
 * holds it back — a 138-character rule sentence quoted verbatim inside a 283-character
 * host paragraph is well over any such floor and scores 1.000. What holds it back is
 * the prefilter, and only just: that pair survives on word overlap by 0.008. Treat a
 * containment hit as "one of these contains the other", which for prose this long is
 * shared text either way — the paragraph carrying the extra material is the one that
 * has to move it somewhere else.
 */
export function similarity(a: string, b: string): number {
  return Math.max(...readings(a, b));
}

/** How much of BOTH paragraphs is shared — the difflib measure. Blind to deletion. */
export function symmetric(a: string, b: string): number {
  return readings(a, b)[0];
}

/** How much of the SHORTER paragraph is shared. 1 for a copy with text removed. */
export function containment(a: string, b: string): number {
  return readings(a, b)[1];
}

/** Both readings of one longest common subsequence: [symmetric, containment]. */
function readings(a: string, b: string): [number, number] {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) {
    return [1, 1];
  }
  if (shorter.length === 0) {
    return [0, 0];
  }
  let previous = new Array<number>(shorter.length + 1).fill(0);
  for (let index = 1; index <= longer.length; index += 1) {
    const current = new Array<number>(shorter.length + 1).fill(0);
    for (let inner = 1; inner <= shorter.length; inner += 1) {
      current[inner] =
        longer[index - 1] === shorter[inner - 1]
          ? previous[inner - 1] + 1
          : Math.max(previous[inner], current[inner - 1]);
    }
    previous = current;
  }
  const common = previous[shorter.length];
  return [(2 * common) / (longer.length + shorter.length), common / shorter.length];
}

/** What the paragraph SAYS, with markdown link targets removed. */
export function comparable(paragraph: string): string {
  return paragraph.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}
