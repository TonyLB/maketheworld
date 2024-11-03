import { SchemaTag } from "../../schema/baseClasses";
import { GenericTreeNode } from "../../tree/baseClasses";
import { StandardComponentData } from "../baseClasses";
import { StandardBaseData } from "./dataTypes/abstract"
import { unwrapConstructorArgs } from "./editable";
import { isSchemaTreeNode } from "./utils";

export class StandardComponentAbstract {
    _key: string;
    _remove: boolean;
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove } = unwrapConstructorArgs(args)
        this._remove = remove
        if (isSchemaTreeNode(payload)) {
            const { data } = payload
            if (!(data && 'key' in data && data.key)) {
                throw new Error('Cannot convert non-keyed schema item to StandardComponent')
            }
            this._key = data.key
        }
        else {
            this._key = payload.key
        }

    }

    get key(): string {
        return this._key
    }

    get schema(): GenericTreeNode<SchemaTag> {
        throw new Error('Cannot call schema on abstract class')
    }

    get isRemove() { return this._remove }
    get isReplace() { return false }
    get match(): StandardComponentAbstract | undefined { return undefined }

    toJSON(): StandardBaseData {
        return { key: this.key }
    }

    merge(incoming: StandardComponentAbstract): StandardComponentAbstract {
        throw new Error('Cannot call merge on abstract class')
    }
}

export default StandardComponentAbstract
