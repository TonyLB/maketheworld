import { SchemaTag } from "../../schema/baseClasses";
import { GenericTreeNode } from "../../tree/baseClasses";
import { StandardBaseData } from "./dataTypes/abstract"
import { isSchemaTreeNode } from "./utils";

export class StandardComponentAbstract {
    _key: string;
    constructor(args: StandardBaseData | GenericTreeNode<SchemaTag>) {
        if (isSchemaTreeNode(args)) {
            const { data } = args
            if (!(data && 'key' in data && data.key)) {
                throw new Error('Cannot convert non-keyed schema item to StandardComponent')
            }
            this._key = data.key
        }
        else {
            this._key = args.key
        }
    }

    get key(): string {
        return this._key
    }

    get schema(): GenericTreeNode<SchemaTag> {
        throw new Error('Cannot call schema on abstract class')
    }

    toJSON(): StandardBaseData {
        return { key: this.key }
    }

    merge(incoming: StandardComponentAbstract): StandardComponentAbstract {
        throw new Error('Cannot call merge on abstract class')
    }
}

export default StandardComponentAbstract
