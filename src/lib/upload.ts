import { Platform } from 'react-native';
import { ENV } from '../lib/env';
import { readIdToken } from '../lib/storage';

type UploadDescriptor = {
  uploadUrl: string;
  method?: string;
  fields?: Record<string, string>;
  key?: string;
  headers?: Record<string, string>;
};

export type UploadIntent = 'post-image' | 'avatar-image' | string;

export interface UploadMediaOptions {
  uri: string;
  intent?: UploadIntent;
  fileName?: string;
  contentType?: string;
  descriptorPaths?: string[];
  uploadPaths?: string[];
}

const DEFAULT_DESCRIPTOR_PATHS = [
  '/media/upload-url',
  '/media/presign',
  '/uploads/presign',
  '/upload-url',
  '/media/uploads',
];

const DEFAULT_DIRECT_UPLOAD_PATHS = ['/media/upload', '/media', '/upload', '/uploads'];

const parseDescriptor = (data: any): UploadDescriptor | null => {
  if (!data || typeof data !== 'object') return null;
  const candidateUrl =
    data.uploadUrl || data.url || data.signedUrl || data.putUrl || data.presignedUrl;
  if (!candidateUrl || typeof candidateUrl !== 'string') return null;
  const fields =
    data.fields && typeof data.fields === 'object'
      ? (data.fields as Record<string, string>)
      : undefined;
  const key =
    data.key ||
    data.imageKey ||
    data.fileKey ||
    data.storageKey ||
    data.objectKey ||
    (fields && fields.key);
  const headers =
    data.headers && typeof data.headers === 'object'
      ? (data.headers as Record<string, string>)
      : data.uploadHeaders && typeof data.uploadHeaders === 'object'
      ? (data.uploadHeaders as Record<string, string>)
      : undefined;
  return {
    uploadUrl: candidateUrl,
    method:
      typeof data.method === 'string'
        ? data.method
        : typeof data.httpMethod === 'string'
        ? data.httpMethod
        : typeof data.verb === 'string'
        ? data.verb
        : undefined,
    fields,
    key,
    headers,
  };
};

async function resolveUploadDescriptor(
  uri: string,
  type: string,
  filename: string,
  intent: string | undefined,
  descriptorPaths: string[],
  authHeader: Record<string, string>
): Promise<{ descriptor: UploadDescriptor | null; directKey: string | null; lastError?: string | null }> {
  let lastDescriptorError: string | null = null;
  const jsonHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Ignore-Auth-Redirect': '1',
    ...authHeader,
  };

  for (const path of descriptorPaths) {
    try {
      const bodyPayload: Record<string, any> = {
        contentType: type,
        fileName: filename,
      };
      if (intent) {
        bodyPayload.intent = intent;
      }

      const response = await fetch(`${ENV.API_URL}${path}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(bodyPayload),
      });

      if (response.status === 404) {
        const text = await response.text().catch(() => '');
        lastDescriptorError = `Upload descriptor endpoint ${path} returned 404${
          text ? `: ${text}` : ''
        }`;
        console.warn(lastDescriptorError);
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        lastDescriptorError = `Descriptor request to ${path} failed: ${text || `HTTP ${response.status}`}`;
        console.warn(lastDescriptorError);
        continue;
      }

      let data: any = null;
      try {
        data = await response.json();
      } catch (parseError) {
        lastDescriptorError = `Descriptor response from ${path} was not valid JSON`;
        console.warn(lastDescriptorError);
        continue;
      }

      const parsed = parseDescriptor(data);
      if (parsed) {
        console.log(`Received upload descriptor from ${path}:`, data);
        return { descriptor: parsed, directKey: null, lastError: lastDescriptorError };
      }

      if (data && (data.key || data.imageKey || data.fileKey)) {
        const directKey = data.key || data.imageKey || data.fileKey;
        if (typeof directKey === 'string') {
          console.log(`Upload descriptor ${path} returned final key without storage upload.`);
          return { descriptor: null, directKey, lastError: lastDescriptorError };
        }
      }

      lastDescriptorError = `Descriptor response from ${path} did not include an upload URL`;
      console.warn(lastDescriptorError);
    } catch (error: any) {
      lastDescriptorError = `Descriptor request to ${path} threw: ${error?.message || error}`;
      console.warn(lastDescriptorError);
    }
  }

  return { descriptor: null, directKey: null, lastError: lastDescriptorError };
}

async function performDescriptorUpload(
  uri: string,
  type: string,
  filename: string,
  descriptor: UploadDescriptor
): Promise<string> {
  let finalKey: string | undefined = descriptor.key;

  if (descriptor.fields) {
    const formData = new FormData();
    Object.entries(descriptor.fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', {
      uri,
      name: filename,
      type,
    } as any);

    const uploadResponse = await fetch(descriptor.uploadUrl, {
      method: descriptor.method || 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text().catch(() => '');
      throw new Error(
        text ? `Storage upload failed: ${text}` : `Storage upload failed: HTTP ${uploadResponse.status}`
      );
    }

    finalKey = finalKey || descriptor.fields?.key;
  } else {
    const fileResponse = await fetch(uri);
    if (!fileResponse.ok) {
      throw new Error('Failed to read image data for upload');
    }
    const blob = await fileResponse.blob();
    const uploadHeaders: Record<string, string> = {
      ...(descriptor.headers || {}),
    };

    if (!uploadHeaders['Content-Type'] && !uploadHeaders['content-type']) {
      uploadHeaders['Content-Type'] = type;
    }

    const uploadResponse = await fetch(descriptor.uploadUrl, {
      method: descriptor.method || 'PUT',
      headers: uploadHeaders,
      body: blob,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text().catch(() => '');
      throw new Error(
        text ? `Storage upload failed: ${text}` : `Storage upload failed: HTTP ${uploadResponse.status}`
      );
    }
  }

  if (!finalKey) {
    throw new Error('Upload failed: storage key missing from descriptor response');
  }

  return finalKey;
}

async function performDirectUpload(
  uri: string,
  filename: string,
  type: string,
  uploadPaths: string[],
  authHeader: Record<string, string>,
  lastDescriptorError: string | null | undefined
): Promise<string> {
  const createFormData = () => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: filename,
      type,
    } as any);
    return formData;
  };

  const directHeadersBase: Record<string, string> = {
    Accept: 'application/json',
    'X-Ignore-Auth-Redirect': '1',
    ...authHeader,
  };

  let lastNotFoundMessage: string | null = lastDescriptorError || null;

  for (const path of uploadPaths) {
    const headers = { ...directHeadersBase };
    const response = await fetch(`${ENV.API_URL}${path}`, {
      method: 'POST',
      body: createFormData(),
      headers,
    });

    if (response.status === 404) {
      const notFoundText = await response.text().catch(() => '');
      lastNotFoundMessage = `Upload endpoint ${path} returned 404${
        notFoundText ? `: ${notFoundText}` : ''
      }`;
      console.warn(lastNotFoundMessage);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const message = errorText || `HTTP ${response.status}`;
      throw new Error(message);
    }

    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error('Upload failed: invalid JSON response');
    }

    const key = data.key || data.imageKey || data.fileKey;
    if (!key) {
      throw new Error('Upload failed: missing image key');
    }

    console.log(`Image uploaded via ${path}:`, data);
    return key;
  }

  throw new Error(lastNotFoundMessage || 'Upload failed: endpoint not found');
}

export async function uploadMedia({
  uri,
  intent,
  fileName,
  contentType,
  descriptorPaths = DEFAULT_DESCRIPTOR_PATHS,
  uploadPaths = DEFAULT_DIRECT_UPLOAD_PATHS,
}: UploadMediaOptions): Promise<string> {
  const filename = fileName || uri.split('/').pop() || 'upload.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = contentType || (match ? `image/${match[1]}` : 'image/jpeg');
  const token = await readIdToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const { descriptor, directKey, lastError } = await resolveUploadDescriptor(
    uri,
    type,
    filename,
    intent,
    descriptorPaths,
    authHeader
  );

  if (directKey) {
    return directKey;
  }

  if (descriptor) {
    return performDescriptorUpload(uri, type, filename, descriptor);
  }

  return performDirectUpload(uri, filename, type, uploadPaths, authHeader, lastError);
}

export function guessImageContentType(uri: string): string {
  const filename = uri.split('/').pop() || '';
  const match = /\.(\w+)$/.exec(filename);
  if (!match) {
    return Platform.OS === 'ios' ? 'image/heic' : 'image/jpeg';
  }
  const ext = match[1].toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return `image/${ext}`;
}
