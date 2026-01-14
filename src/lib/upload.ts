import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
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
    console.log('[performDescriptorUpload] Reading file from:', uri);

    // Use expo-file-system to read the file (works with local URIs in React Native)
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist at URI: ' + uri);
    }
    console.log('[performDescriptorUpload] File exists, size:', fileInfo.size);

    // Read file as base64 and convert to blob
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[performDescriptorUpload] File read as base64, length:', base64.length);

    // Convert base64 to blob
    const blob = await fetch(`data:${type};base64,${base64}`).then(r => r.blob());
    console.log('[performDescriptorUpload] Blob created, size:', blob.size);

    const uploadHeaders: Record<string, string> = {
      ...(descriptor.headers || {}),
    };

    if (!uploadHeaders['Content-Type'] && !uploadHeaders['content-type']) {
      uploadHeaders['Content-Type'] = type;
    }

    console.log('[performDescriptorUpload] Uploading to S3:', {
      url: descriptor.uploadUrl.substring(0, 100) + '...',
      method: descriptor.method || 'PUT',
      headers: uploadHeaders,
      blobSize: blob.size,
    });

    // Retry S3 upload up to 3 times with exponential backoff
    let uploadResponse: Response | null = null;
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[performDescriptorUpload] Upload attempt ${attempt}/${maxRetries}`);

        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        uploadResponse = await fetch(descriptor.uploadUrl, {
          method: descriptor.method || 'PUT',
          headers: uploadHeaders,
          body: blob,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (uploadResponse.ok) {
          console.log('[performDescriptorUpload] S3 upload successful on attempt', attempt);
          break; // Success!
        }

        // If not ok but we got a response, don't retry (it's a server error)
        lastError = new Error(`HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`);
        console.warn(`[performDescriptorUpload] S3 upload failed with HTTP ${uploadResponse.status}`);
        break; // Don't retry on HTTP errors

      } catch (error: any) {
        lastError = error;
        console.warn(`[performDescriptorUpload] Attempt ${attempt} failed:`, error.message);

        // If it's a network error and we have retries left, wait and retry
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s
          console.log(`[performDescriptorUpload] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!uploadResponse || !uploadResponse.ok) {
      const errorMsg = lastError?.message || 'Upload failed after retries';
      throw new Error(`S3 upload failed: ${errorMsg}`);
    }

    console.log('[performDescriptorUpload] S3 upload response:', uploadResponse.status, uploadResponse.statusText);
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
  const type = contentType || guessContentType(match ? match[1] : null);
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

function guessContentType(ext: string | null): string {
  if (!ext) {
    return Platform.OS === 'ios' ? 'image/heic' : 'image/jpeg';
  }
  const e = ext.toLowerCase();
  // Video types
  if (e === 'mp4' || e === 'm4v') return 'video/mp4';
  if (e === 'mov') return 'video/quicktime';
  if (e === 'webm') return 'video/webm';
  if (e === 'avi') return 'video/x-msvideo';
  if (e === '3gp') return 'video/3gpp';
  // Image types
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  if (e === 'heic' || e === 'heif') return 'image/heic';
  return `image/${e}`;
}

export function guessImageContentType(uri: string): string {
  const filename = uri.split('/').pop() || '';
  const match = /\.(\w+)$/.exec(filename);
  return guessContentType(match ? match[1] : null);
}
