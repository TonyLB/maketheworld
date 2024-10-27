import { StandardBaseData } from "./dataTypes/abstract"

export class StandardComponentAbstract {
    _key: string;
    constructor(args: StandardBaseData) {
        this._key = args.key
    }

    get key(): string {
        return this._key
    }

    toJSON(): StandardBaseData {
        throw new Error('Cannot call toJSON on abstract class')
    }
}

export default StandardComponentAbstract
