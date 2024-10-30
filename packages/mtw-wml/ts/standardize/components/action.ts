import { isSchemaAction, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardActionData } from "./dataTypes/action"
import { isSchemaTreeNode } from "./utils"

export class StandardAction extends StandardComponentAbstract {
    _src?: string;
    _dependencies?: string[];
    tag = 'Computed' as const
    constructor(args: StandardActionData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            const { data } = args
            if (!isSchemaAction(data)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
            this._src = data.src
        }
        else {
            this._src = args.src
        }
    }

    get src() { return this._src }
    get dependencies() { return this._dependencies }

    override toJSON(): StandardActionData {
        return {
            key: this.key,
            tag: 'Action',
            src: this.src ?? ''
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Action', key: this.key, src: this.src ?? '' },
            children: []
        }
    }

    override merge(incoming: StandardComponentAbstract): StandardAction {
        if (!(incoming instanceof StandardAction)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const args: StandardActionData = {
            key: this.key,
            tag: 'Action',
            src: incoming.src ?? this.src ?? ''
        }
        return new StandardAction(args)
    }
}

export default StandardAction
