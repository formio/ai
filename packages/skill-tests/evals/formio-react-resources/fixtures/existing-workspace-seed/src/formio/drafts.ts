type Submission = { state?: string; [key: string]: unknown };

/** A draft that round-trips through edit stays a draft. */
export function preserveDraftState({
  existing,
  incoming,
}: {
  existing?: Submission;
  incoming: Submission;
}): Submission {
  if (incoming.state || !existing?.state) return incoming;
  return { ...incoming, state: existing.state };
}
