import { isSchemaAction, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { isStandardAction, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardActionData } from "./dataTypes/action"
import { unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardAction extends StandardComponentAbstract {
    _src?: string;
    _dependencies?: string[];
    _match?: StandardAction;
    tag = 'Action' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardAction(match)
        }
        if (isSchemaTreeNode(payload)) {
            const { data } = payload
            if (!isSchemaAction(data)) {
                throw new Error('Type mismatch in StandardAction constructor')
            }
            this._src = data.src
        }
        else {
            if (!isStandardAction(payload)) {
                throw new Error('Type mismatch in StandardAction constructor')
            }
            this._src = payload.src
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    get src() { return this._src }
    get dependencies() { return this._dependencies }

    override toJSON(): StandardActionData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardAction, StandardActionData>(this, (value) => ({
            key: value.key,
            tag: 'Action',
            src: value.src ?? ''
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardAction) => ({
            data: { tag: 'Action', key: value.key, src: value.src ?? '' },
            children: []
        }))
    }

    override merge(incoming: StandardComponentAbstract): StandardAction | undefined {
        if (!(incoming instanceof StandardAction)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        return wrapMerge<StandardAction>(this, incoming, StandardAction, (base, incoming) => {
            const args: StandardActionData = {
                key: base.key,
                tag: 'Action',
                src: incoming.src ?? base.src ?? ''
            }
            return new StandardAction(args)
        })
    }
}

export default StandardAction
