export interface PdfSettings {
  id: string;
  src: string;
}

export interface UploadResponse {
  path: string;
  file: string;
  filesServer?: string;
}

// The rule @formio/js's PDFBuilder applies when the portal uploads a PDF, so a form
// saved with this value renders exactly as one built in the portal.
export function derivePdfSettings({
  projectUrl,
  response,
}: {
  projectUrl: string;
  response: UploadResponse;
}): PdfSettings {
  const src = response.filesServer
    ? `${response.filesServer}${response.path}`
    : `${new URL(projectUrl).origin}/pdf-proxy${response.path}`;
  return { id: response.file, src };
}
