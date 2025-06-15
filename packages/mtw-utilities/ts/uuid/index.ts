import { v4 as uuidv4 } from 'uuid'

export class UUIDGenerator {
  next(): string {
    return uuidv4()
  }
}
