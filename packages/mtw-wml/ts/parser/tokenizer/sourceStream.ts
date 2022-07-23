export class SourceStream {
    source: string
    position: number = 0
    constructor(source: string) {
        this.source = source
    }
    lookAhead(compare: string, position?: number): boolean {
        const currentPosition = (position !== undefined) ? position : this.position
        if (currentPosition + compare.length > this.source.length) {
            return false
        }
        const chars = [...compare]
        return chars.reduce((previous, character, index) => (previous && (character === this.source[currentPosition + index])), true)
    }
    consume(compare: undefined): string
    consume(compare: string): void
    consume(length: number): string
    consume(compare?: string | number): void | string {
        if (compare === undefined) {
            const returnValue = this.source.slice(this.position, this.source.length)
            this.position = this.source.length
            return returnValue
        }
        if (typeof compare === 'number') {
            const adjustedLength = (compare + this.position >= this.source.length) ? (this.source.length - (this.position + 1)) : compare
            const returnValue = this.source.slice(this.position, this.position + adjustedLength)
            this.position += adjustedLength
            return returnValue
        }
        else {
            if (this.lookAhead(compare)) {
                this.position += compare.length
            }
        }
    }
    get isEndOfSource(): boolean {
        return this.position === this.source.length
    }
    nextInstance(compare: string[]): number {
        const sourceLength = this.source.length
        for(let i=this.position; i < sourceLength; i++) {
            const match = compare.find((check) => (this.lookAhead(check, i)))
            if (match) {
                return i - this.position
            }
        }
        return -1
    }
}

export default SourceStream
