import { describe, expect, it } from 'vitest';
import { ProseEntry, findDrift } from './prose-drift.js';
import { comparable, shingles, words } from './prose-similarity.js';

/**
 * The drift detector, against paragraphs chosen to break it.
 *
 * The bounds it applies are pinned in `prose-similarity.test.ts`, but pinning a
 * constant says nothing about whether the code that reads it still does: deleting the
 * shingle-containment clause from the detector left every deletion invisible again with
 * the whole suite green, because the only thing exercising the detector was the real
 * skill corpus, which is clean. These fixtures are the corpus the corpus cannot be.
 */
const SHARED =
  'Available tools are not a configured project. Every Form.io tool resolves which project it targets per working directory, so pass cwd on every Form.io tool call. Omitting it resolves against the MCP server own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to by calling the project_get tool.';

function entry(raw: string, ...carriers: string[]): ProseEntry {
  const text = comparable(raw);
  return {
    text,
    raw,
    words: words(text),
    shingles: shingles(text),
    carriers: new Set(carriers),
  };
}

const sentences = SHARED.split(/(?<=\.)\s+/);

describe('the drift detector', () => {
  it('says nothing when every copy is byte-identical', () => {
    expect(
      findDrift([
        entry(SHARED, 'skill-a', 'skill-b'),
        entry(
          'Something else entirely about roles and actions on the Enterprise server, which shares no phrasing with the paragraph above it at all.',
          'skill-c'
        ),
      ])
    ).toEqual([]);
  });

  // The shape the symmetric measure was blind to, at every depth. A copy that keeps two
  // of four sentences is the largest drift possible short of deleting the paragraph.
  it.each([3, 2, 1])('reports a copy with only %i sentences kept', (kept) => {
    const drifted = findDrift([
      entry(SHARED, 'skill-a'),
      entry(sentences.slice(0, kept).join(' '), 'skill-b'),
    ]);

    expect(
      drifted,
      `a copy keeping ${kept}/${sentences.length} sentences went unreported`
    ).toHaveLength(1);
    expect(drifted[0]).toContain('contained');
  });

  it('reports a copy grown by an extra sentence', () => {
    const drifted = findDrift([
      entry(SHARED, 'skill-a'),
      entry(`${SHARED} One extra sentence, added to this copy alone and to no other.`, 'skill-b'),
    ]);

    expect(drifted).toHaveLength(1);
  });

  // Drift where BOTH copies changed, so neither contains the other — the case only the
  // Jaccard bound admits.
  it('reports scattered substitution, which containment alone would discard', () => {
    const substituted = SHARED.split(' ')
      .map((word, index) => (index > 0 && index % 8 === 0 ? [...word].reverse().join('') : word))
      .join(' ');

    expect(findDrift([entry(SHARED, 'skill-a'), entry(substituted, 'skill-b')])).toHaveLength(1);
  });

  // Same words, different arrangement. Both readings of the LCS score this well below
  // the threshold, and an inverted "X, not Y" clause is a different instruction.
  it('reports the same sentences in a different order', () => {
    const reordered = [sentences[3], sentences[1], sentences[2], sentences[0]].join(' ');
    const drifted = findDrift([entry(SHARED, 'skill-a'), entry(reordered, 'skill-b')]);

    expect(drifted, 'a reordered copy went unreported').toHaveLength(1);
    expect(drifted[0]).toContain('different order');
  });

  it('reports an inverted clause', () => {
    const rule =
      'Check this when you reach your first Form.io tool call, not when this skill activates, because the tools are what the check is about and activation is not.';
    const inverted =
      'Check this when this skill activates, not when you reach your first Form.io tool call, because the tools are what the check is about and activation is not.';

    expect(findDrift([entry(rule, 'skill-a'), entry(inverted, 'skill-b')])).toHaveLength(1);
  });

  // The other side: unrelated prose must stay unreported, or the guard is noise and the
  // library cannot be edited.
  it('says nothing about prose that is merely on the same subject', () => {
    const one =
      'Roles and actions are configured per project on the Enterprise server, and each role carries its own submission access array which the renderer consults before drawing a field.';
    const two =
      'A committed formio.json is read by this server and never written by it, so a deployment missing from one is added by editing that file rather than by calling project_set.';

    expect(findDrift([entry(one, 'skill-a'), entry(two, 'skill-b')])).toEqual([]);
  });

  // The "different skills" gate has to be SYMMETRIC. Asking only whether some carrier of
  // a is missing from b made the answer depend on which entry the map happened to build
  // first: where one carrier set is a strict subset of the other — the ordinary shape of
  // "ten skills share this paragraph and one carries a drifted copy" — the drift was
  // reported or silently dropped according to which paragraph appeared earlier in the
  // file, and the alphabetically-first skill's variant is exactly the one that appears
  // earlier.
  it.each([
    ['the drifted copy first', true],
    ['the shared copy first', false],
  ])('reports a subset carrier either way: %s', (_label, variantFirst) => {
    const variant = entry(sentences.slice(0, 2).join(' '), 'skill-a');
    const canonical = entry(SHARED, 'skill-a', 'skill-b', 'skill-c');

    expect(findDrift(variantFirst ? [variant, canonical] : [canonical, variant])).toHaveLength(1);
  });

  // A skill may repeat itself; only prose crossing a skill boundary is shared prose.
  it('says nothing about two near-identical paragraphs in the SAME skill', () => {
    expect(
      findDrift([entry(SHARED, 'skill-a'), entry(sentences.slice(0, 2).join(' '), 'skill-a')])
    ).toEqual([]);
  });
});
