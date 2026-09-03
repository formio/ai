import type { ResourceConfig } from './types';

export function resourceUrls({
  projectUrl,
  form,
  id,
}: {
  projectUrl: string;
  form: ResourceConfig['form'];
  id?: string;
}) {
  const formUrl = `${projectUrl}/${form}`;
  return { formUrl, submissionUrl: id ? `${formUrl}/submission/${id}` : undefined };
}
