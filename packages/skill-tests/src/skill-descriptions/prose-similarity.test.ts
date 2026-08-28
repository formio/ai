import { describe, expect, it } from 'vitest';
import {
  SAME_PARAGRAPH,
  SHINGLE_CONTAINMENT_FLOOR,
  WORD_OVERLAP_FLOOR,
  shingleContainment,
  shingles,
  similarity,
  wordOverlap,
  words,
} from './prose-similarity.js';

/**
 * A shared paragraph, and the copies a drifting skill would leave beside it.
 *
 * Every bound below is asserted against THIS, rather than against a hand-picked pair
 * that happens to sit where the bound is comfortable. The bounds are optimisations —
 * they decide what is never measured — so each one has to be pinned from the side
 * that makes it dangerous: not "this value is what we chose", but "move it and real
 * drift goes unseen".
 */
const SHARED =
  'Available tools are not a configured project. Every Form.io tool resolves which project it targets per working directory, so pass cwd on every Form.io tool call. Omitting it resolves against the MCP server own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to by calling the project_get tool. Do not shell out for this: the connected server answers it directly.';
const SENTENCES = SHARED.split(/(?<=\.)\s+/);
const keepFirst = (count: number) => SENTENCES.slice(0, count).join(' ');

/**
 * The bounds the drift guard skips work on, asserted directly.
 *
 * Both are optimisations: they decide when the expensive comparison can be skipped
 * without changing the answer. That makes them the part of the guard that can be
 * wrong while every test still passes — and one of them was. The length bound was set
 * to the similarity threshold itself, which is not the same number, and it silently
 * discarded the exact band a one-sentence edit lands in.
 */
describe('the bounds that let the guard skip work', () => {
  // There is no length below which a pair is skipped unmeasured. A floor was derived
  // for the symmetric reading, correctly, and it still discarded every deletion —
  // because a deletion is exactly a length gap, so the bound that says "too different
  // in length to be the same paragraph" is the bound that hides the drift.
  it('measures a pair however far apart their lengths are', () => {
    const shared =
      'Authentication is implicit: the first authenticated tool call opens the portal-login flow itself when no cached JWT is present. There is no authenticate-first step to ask the user for, and no unauthenticated state to diagnose before a call has actually failed.';
    const drifted = `${shared} One extra sentence, added to this copy alone.`;

    expect(shared.length / drifted.length).toBeLessThan(SAME_PARAGRAPH);
    expect(similarity(shared, drifted)).toBeGreaterThanOrEqual(SAME_PARAGRAPH);
  });

  // The bound above was right for the measure and the MEASURE was blind: a symmetric
  // denominator charges a deletion twice, once for the characters missing and once for
  // the length gap, so removing one sentence of two scored 0.000 — "nothing alike" — for
  // the two copies of a paragraph that differ by exactly that sentence. Drift by
  // deletion is at least as likely as drift by addition, and it was invisible.
  it('sees a sentence deleted from one copy', () => {
    const shared =
      'Authentication is implicit: the first authenticated tool call opens the portal-login flow itself when no cached JWT is present. There is no authenticate-first step to ask the user for, and no unauthenticated state to diagnose before a call has actually failed.';
    const sentences = shared.split(/(?<=\.)\s+/);

    for (let dropped = 0; dropped < sentences.length; dropped += 1) {
      const drifted = sentences.filter((_, index) => index !== dropped).join(' ');

      expect(
        similarity(shared, drifted),
        `dropping sentence ${dropped + 1} went unseen`
      ).toBeGreaterThanOrEqual(SAME_PARAGRAPH);
    }
  });

  it('still scores unrelated prose well below the threshold, at any length', () => {
    const long =
      'The committed formio.json is read by this server and never written by it, so a deployment missing from one is added by editing that file rather than by calling project_set, which records only this machine mapping.';
    const short =
      'Roles and actions are configured per project on the Enterprise server, and each role carries its own submission access.';

    expect(similarity(short, long)).toBeLessThan(SAME_PARAGRAPH);
  });

  it('scores identical text as one, and unrelated text well below the threshold', () => {
    const text = 'The committed formio.json is read by this server and never written by it.';
    expect(similarity(text, text)).toBe(1);
    expect(
      similarity(text, 'Roles and actions are configured per project on the Enterprise server.')
    ).toBeLessThan(SAME_PARAGRAPH);
  });

  // P2 — the word-overlap floor, pinned from the side that hides drift.
  //
  // It was justified by measuring ADDITIONS ("true positives never fall below 0.82"),
  // and a deletion is a size gap, so the justification did not transfer: a copy that
  // keeps two of five sentences scores 0.383 here and was discarded unmeasured while
  // its similarity was 1.000 — the largest drift possible, invisible. The floor could
  // also be doubled without a single test noticing. Both are pinned now, by requiring
  // that every depth of deletion actually REACH the comparison.
  it('lets every depth of a deletion reach the comparison', () => {
    for (let kept = SENTENCES.length - 1; kept >= 1; kept -= 1) {
      const drifted = keepFirst(kept);
      const reaches =
        wordOverlap(words(SHARED), words(drifted)) >= WORD_OVERLAP_FLOOR ||
        shingleContainment(shingles(SHARED), shingles(drifted)) >= SHINGLE_CONTAINMENT_FLOOR;

      expect(
        reaches,
        `a copy keeping ${kept}/${SENTENCES.length} sentences is never measured`
      ).toBe(true);
      expect(similarity(SHARED, drifted)).toBeGreaterThanOrEqual(SAME_PARAGRAPH);
    }
  });

  // And the other side of the same bound: prose that is genuinely unrelated must still
  // be skipped, or the floors buy nothing and the guard pays LCS on every pair.
  it('still skips prose that is genuinely unrelated', () => {
    const unrelated =
      'Roles and actions are configured per project on the Enterprise server, and each role carries its own submission access array which the renderer consults before it draws a field.';

    expect(wordOverlap(words(SHARED), words(unrelated))).toBeLessThan(WORD_OVERLAP_FLOOR);
    expect(shingleContainment(shingles(SHARED), shingles(unrelated))).toBeLessThan(
      SHINGLE_CONTAINMENT_FLOOR
    );
  });

  // The Jaccard floor, pinned from ABOVE — and the reason it survives at all now that
  // shingle containment covers deletion. Drift where BOTH copies changed leaves neither
  // containing the other: a word substituted every eighth word scores 0.410 on shingles,
  // under that floor, while Jaccard reads 0.789 and the pair is 0.910 similar. Raise this
  // floor and that pair is discarded unmeasured; remove it and the shingle bound alone
  // discards it. Both bounds are load-bearing, in opposite directions.
  it('lets scattered substitution reach the comparison, which only word overlap admits', () => {
    const run = SHARED.split(' ');
    const drifted = run
      .map((word, index) => (index > 0 && index % 8 === 0 ? [...word].reverse().join('') : word))
      .join(' ');

    const overlap = wordOverlap(words(SHARED), words(drifted));
    const contained = shingleContainment(shingles(SHARED), shingles(drifted));

    expect(similarity(SHARED, drifted)).toBeGreaterThanOrEqual(SAME_PARAGRAPH);
    expect(contained, 'shingle containment would discard this pair').toBeLessThan(
      SHINGLE_CONTAINMENT_FLOOR
    );
    expect(overlap, 'so word overlap is the only bound that admits it').toBeGreaterThanOrEqual(
      WORD_OVERLAP_FLOOR
    );
  });

  // P4 — the threshold, pinned from ABOVE. Every other assertion here compares a pure
  // insertion or deletion, which scores 1.000, so the threshold could be raised to
  // 0.999 with the suite green while a copy differing by a reworded clause — the most
  // ordinary drift there is — went unreported.
  it('reports a copy with one clause reworded', () => {
    // A SUBSTITUTION, not an insertion: text added to one copy leaves the other a
    // subsequence of it, which scores 1.000 by containment and would pin nothing.
    const reworded = SHARED.replace(
      'which project it targets per working directory',
      'which project it points at for a given folder'
    );

    expect(reworded).not.toBe(SHARED);
    expect(similarity(SHARED, reworded)).toBeGreaterThanOrEqual(SAME_PARAGRAPH);
    expect(similarity(SHARED, reworded)).toBeLessThan(1);
  });

  // The word-overlap floor is the other skip, and it has margin measured against the
  // library's real prose rather than assumed: a one-word edit scores near 1.
  it('the word-overlap floor sits far below what a real edit scores', () => {
    const shared = words(
      'Never invent a Base URL, never reuse one from another project or an earlier session.'
    );
    const edited = words(
      'Never invent a Base URL, never re-use one from another project or an earlier session.'
    );

    expect(wordOverlap(shared, edited)).toBeGreaterThan(0.8);
    expect(WORD_OVERLAP_FLOOR).toBeLessThan(0.8);
  });
});
