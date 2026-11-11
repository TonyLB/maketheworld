import { createHash } from 'crypto'

/** A short hash of the text a batch used, so two batches are comparable and a draft is never mistaken for the deployed text. */
export const textHash = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 8)
