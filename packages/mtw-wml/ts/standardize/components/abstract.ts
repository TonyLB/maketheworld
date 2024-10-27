import { SchemaTag } from "../../schema/baseClasses";
import { GenericTree } from "../../tree/baseClasses";
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

    get schema(): GenericTree<SchemaTag> {
        return []
    }
}

export default StandardComponentAbstract
