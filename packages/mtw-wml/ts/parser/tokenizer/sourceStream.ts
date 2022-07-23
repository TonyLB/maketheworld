export class SourceStream {
    source: string
    position: number = 0
    constructor(source: string) {
        this.source = source
    }
    lookAhead(compare: string): boolean {
        return this.source.slice(this.position, this.position + compare.length) === compare
    }
    consume(compare: string): void {
        if (this.lookAhead(compare)) {
            this.position += compare.length
        }
    }
    get isEndOfSource(): boolean {
        return this.position === this.source.length
    }
}

export default SourceStream
