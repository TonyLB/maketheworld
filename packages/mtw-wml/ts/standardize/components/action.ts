import { isSchemaAction, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { StandardActionData } from "./dataTypes/action"
import { componentClassFactory, ComponentConstructorMethods } from "./component"

export class StandardActionPayload implements ComponentConstructorMethods<StandardActionData> {
    _src?: string;
    _dependencies?: string[];
    tag = 'Action' as const;

    fromJSON(props: StandardActionData) {
        this._src = props.src
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaAction)(node)) {
            this._src = node.data.src
            return
        }
        throw new Error('Schema mismatch in StandardAction constructor')
    }

    get src() { return this._src ?? '' }
    get dependencies() { return this._dependencies }

    toJSON(): Omit<StandardActionData, 'key' | 'universalKey'> {
        return {
            tag: 'Action',
            src: this.src
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Action', key, src: this.src },
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardActionPayload()
        returnValue._src = incoming.src ?? this.src
        return returnValue as this
    }
}

export class StandardAction extends componentClassFactory(StandardActionPayload, 'StandardAction') {
    get src() { return this._payload.src }
    get dependencies() { return this._payload.dependencies }
}

export default StandardAction
