// lib/toNodeReadable.ts
import { Readable } from 'stream'

export function toNodeReadable(webStream: any): Readable {
  return Readable.fromWeb(webStream)
}
