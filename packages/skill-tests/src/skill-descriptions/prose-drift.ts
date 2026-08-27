/**
 * Which paragraphs two skills carry that are NEARLY, but not exactly, each other's.
 *
 * Separated from the guard that reads the skill library so this logic can be exercised
 * against paragraphs chosen to break it, rather than only against a corpus that happens
 * to be clean today. Every bound below decides what is never compared, which makes them
 * the part that can be wrong while the guard stays green — and the guard's own use of
 * them was unpinned even after the bounds themselves were pinned: deleting the shingle
 * clause here left deletion drift invisible again with all 387 tests passing.
 */
import {
  SAME_PARAGRAPH,
  SHINGLE_CONTAINMENT_FLOOR,
  WORD_OVERLAP_FLOOR,
  containment,
  shingleContainment,
  similarity,
  symmetric,
  wordOverlap,
} from './prose-similarity.js';

/**
 * Word overlap at or above this, with character similarity below the threshold, means
 * the same sentences in a different arrangement rather than two different paragraphs.
 */
export const REORDERED_WORD_OVERLAP = 0.95;

export interface ProseEntry {
  /** The paragraph as compared — link targets stripped. */
  text: string;
  /** The paragraph as written, for quoting back. */
  raw: string;
  words: Set<string>;
  shingles: Set<string>;
  /** The skills carrying this exact paragraph. */
  carriers: Set<string>;
}

export function findDrift(entries: readonly ProseEntry[]): string[] {
  const drifted: string[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [a, b] = [entries[i], entries[j]];
      // Only prose two DIFFERENT skills carry: a skill may legitimately say a similar
      // thing twice within its own document.
      //
      // Asked in ONE direction this was order-dependent. Where one carrier set is a
      // strict subset of the other — ten skills sharing a paragraph and one carrying a
      // drifted copy of it — "some carrier of a is missing from b" is false whenever the
      // variant is `a`, so whether the drift was reported came down to which paragraph
      // the map happened to build first. The question is whether the two paragraphs are
      // carried by different sets of skills, which is symmetric.
      const across =
        [...a.carriers].some((carrier) => !b.carriers.has(carrier)) ||
        [...b.carriers].some((carrier) => !a.carriers.has(carrier));
      if (!across) {
        continue;
      }
      // TWO ways past the prefilter, because one bound cannot see both shapes of drift.
      // Jaccard catches a copy grown by addition; it divides by the UNION, so a copy
      // shrunk by deletion drives it down while every surviving word is still shared,
      // and those were discarded unmeasured. Shingle containment is ~1 for a deletion of
      // any depth and ~0 for unrelated prose, so it costs almost nothing to admit: on
      // this library's corpus it lets in fewer pairs than Jaccard does. Neither bound
      // subsumes the other — drift where BOTH copies changed leaves neither containing
      // the other, and only Jaccard admits it.
      const overlap = wordOverlap(a.words, b.words);
      if (
        overlap < WORD_OVERLAP_FLOOR &&
        shingleContainment(a.shingles, b.shingles) < SHINGLE_CONTAINMENT_FLOOR
      ) {
        continue;
      }
      const ratio = similarity(a.text, b.text);
      const carriers = `${[...a.carriers].join(', ')} and ${[...b.carriers].join(', ')}`;
      const quote =
        `  ${[...a.carriers].join(', ')}: ${a.raw.slice(0, 200)}\n` +
        `  ${[...b.carriers].join(', ')}: ${b.raw.slice(0, 200)}`;

      if (ratio >= SAME_PARAGRAPH) {
        // Both readings are printed. The score is the HIGHER of the two, so a bare
        // "1.000 similar" over two paragraphs differing by 200 characters reads as a
        // mistake in the guard rather than as the containment it is.
        drifted.push(
          `${carriers} carry the same paragraph with differences (${ratio.toFixed(3)} similar; ${symmetric(a.text, b.text).toFixed(3)} by length, ${containment(a.text, b.text).toFixed(3)} contained):\n${quote}`
        );
        continue;
      }
      // Identical WORDS, different order. Neither reading of the LCS sees this — a
      // swapped pair of sentences scores ~0.59, an inverted "X, not Y" clause ~0.79,
      // both far below the threshold — and an inverted clause is the most consequential
      // drift this library has, since its preflight prose is built out of them. The
      // signal is already computed: word overlap this high with a character similarity
      // this low means the same sentences in a different arrangement.
      if (overlap >= REORDERED_WORD_OVERLAP) {
        drifted.push(
          `${carriers} carry the same words in a different order (${overlap.toFixed(3)} word overlap, only ${ratio.toFixed(3)} similar) — a reordered or inverted clause reads as a different instruction:\n${quote}`
        );
      }
    }
  }

  return drifted;
}

/** The three fixes that resolve a drift report, and the one that does not work. */
export function driftReport(drifted: readonly string[]): string {
  return [
    'Shared prose has drifted. One of three fixes applies:',
    '  - the paragraph is shared: update EVERY copy so they are byte-identical;',
    '  - one copy carries an extra sentence meant for that skill alone: MOVE it into its',
    '    own paragraph beside the shared one — rewording the shared half to escape this',
    '    check is the drift the check exists to stop, and adding text never escapes it,',
    '    because containment survives any amount of added material;',
    '  - the two really are different prose: reword the one that is meant to differ.',
    '',
    drifted.join('\n\n'),
  ].join('\n');
}
