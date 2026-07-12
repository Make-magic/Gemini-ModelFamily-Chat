import type { UploadedFile } from '../types';

const managedObjectUrls = new Set<string>();

export const createManagedObjectUrl = (blob: Blob): string => {
  const url = URL.createObjectURL(blob);
  managedObjectUrls.add(url);
  return url;
};

export const revokeManagedObjectUrl = (url?: string | null): void => {
  if (!url?.startsWith('blob:')) return;
  URL.revokeObjectURL(url);
  managedObjectUrls.delete(url);
};

export const releaseFileObjectUrl = (file?: UploadedFile | null): void => {
  revokeManagedObjectUrl(file?.dataUrl);
};

export const releaseFilesObjectUrls = (files: Iterable<UploadedFile>): void => {
  for (const file of files) releaseFileObjectUrl(file);
};

export const releaseSessionObjectUrls = (messages: Array<{ files?: UploadedFile[] }>): void => {
  for (const message of messages) releaseFilesObjectUrls(message.files ?? []);
};

export const materializeFileObjectUrl = (file: UploadedFile): UploadedFile => {
  if (!(file.rawFile instanceof Blob)) return file;
  revokeManagedObjectUrl(file.dataUrl);
  return { ...file, dataUrl: createManagedObjectUrl(file.rawFile) };
};

export const revokeAllManagedObjectUrls = (): void => {
  for (const url of managedObjectUrls) URL.revokeObjectURL(url);
  managedObjectUrls.clear();
};

export const getManagedObjectUrlCount = (): number => managedObjectUrls.size;

export const downloadBlob = (blob: Blob, filename: string, revokeDelayMs = 1000): void => {
  const url = createManagedObjectUrl(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => revokeManagedObjectUrl(url), revokeDelayMs);
};
