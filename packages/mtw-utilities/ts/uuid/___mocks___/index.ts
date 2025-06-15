export class UUIDGenerator {
    index: number = 0
    next(): string {
        this.index += 1
        return `mock-uuid-${this.index}`
    }
}