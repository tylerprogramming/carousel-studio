import { closeSync, openSync, readSync } from 'fs'

/**
 * Content type for a served media file.
 *
 * One source of truth on purpose. Every route that streams from disk used to
 * carry its own guess, and each of them defaulted to an image type — so an mp4
 * came back labelled as a picture and would not play. That bug was fixed three
 * times in three handlers before it was fixed once, here.
 */
export function mediaType(name: string): string {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  return ({
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.pdf': 'application/pdf',
  } as Record<string, string>)[ext] ?? 'application/octet-stream'
}

/** Static assets for the built client. */
export const MIME: Record<string, string> = {
  '.js':   'text/javascript',
  '.mjs':  'text/javascript',
  '.css':  'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json',
}

/**
 * Read a PNG's dimensions from its header, without decoding it.
 *
 * Nothing on disk records which variant a finished export was, so the only way
 * to know whether a slide is 4:5 or a tall 9:16 is to look. Twenty-four bytes
 * is cheaper than loading the image, and this runs once per thumbnail.
 */
export function pngSize(path: string): { width: number; height: number } | null {
  let fd: number | undefined
  try {
    fd = openSync(path, 'r')
    const buf = Buffer.alloc(24)
    if (readSync(fd, buf, 0, 24, 0) < 24) return null
    if (buf.toString('ascii', 1, 4) !== 'PNG') return null
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  } catch {
    return null
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

/** Export folder name for a carousel title. Mirrored by slugify() in App.tsx —
 *  when these disagreed, exporting from the UI wrote to a second folder and
 *  left the first silently stale. */
export function slugFromTitle(title: string): string {
  return (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'carousel'
}
