const isArrayBufferView = value => ArrayBuffer.isView(value);

export const isBinaryFileContent = value => value instanceof Blob || value instanceof ArrayBuffer || isArrayBufferView(value);

export function fileContentSize(value) {
  if (value instanceof Blob) return value.size;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (isArrayBufferView(value)) return value.byteLength;
  const text = String(value ?? '');
  const dataUrl = text.match(/^data:[^,]*;base64,([\s\S]*)$/i);
  if (dataUrl) return Math.floor(dataUrl[1].replace(/\s/g, '').length * 3 / 4) - (dataUrl[1].endsWith('==') ? 2 : dataUrl[1].endsWith('=') ? 1 : 0);
  return new TextEncoder().encode(text).byteLength;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export async function encodeBackupContent(content) {
  if (content instanceof Blob) return { encoding: 'base64', data: bytesToBase64(new Uint8Array(await content.arrayBuffer())) };
  if (content instanceof ArrayBuffer) return { encoding: 'base64', data: bytesToBase64(new Uint8Array(content)) };
  if (isArrayBufferView(content)) return { encoding: 'base64', data: bytesToBase64(new Uint8Array(content.buffer, content.byteOffset, content.byteLength)) };
  return String(content ?? '');
}

export function decodeBackupContent(content, mime = 'application/octet-stream') {
  if (typeof content === 'string') return content;
  if (!content || content.encoding !== 'base64' || typeof content.data !== 'string'
    || content.data.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content.data)) {
    throw new Error('O backup contém conteúdo de ficheiro inválido.');
  }
  const binary = atob(content.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}