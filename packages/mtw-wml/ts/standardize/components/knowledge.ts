import { excludeUndefined } from "../../lib/lists"
import { isSchemaKnowledge, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { isStandardKnowledge, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"

export class StandardKnowledge extends StandardComponentWithNameAndDesc implements ComponentInterface {
    _match?: StandardKnowledge;
    tag = 'Knowledge' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardKnowledge(match)
        }
        if (isSchemaTreeNode(payload)) {
            if (!isSchemaKnowledge(payload.data)) {
                throw new Error('Type mismatch in StandardKnowledge constructor')
            }
        }
        else {
            if (!isStandardKnowledge(payload)) {
                throw new Error('Type mismatch in StandardKnowledge constructor')
            }
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    override toJSON(): StandardKnowledgeData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardKnowledge, StandardKnowledgeData>(this, (value) => ({
            key: value.key,
            tag: 'Knowledge',
            name: value.name,
            description: value.description
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return  wrapSchema(this, (value: StandardKnowledge) => ({
            data: { tag: 'Knowledge', key: value.key },
            children: [value.name, value.description].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1)
        }))
    }

    override clone(): this {
        return new StandardKnowledge(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardKnowledge)) {
            throw new Error('Type mismatch on StandardComponent merge')
        }
        return wrapMerge<StandardKnowledge>(this, incoming, StandardKnowledge, (base, incoming) => {
            const superMerge = super.merge.bind(base)(incoming as this)
            if (!superMerge) {
                throw new Error('Merge failure in StandardRoom')
            }
            const args: StandardKnowledgeData = {
                ...superMerge.toJSON(),
                tag: 'Knowledge',
            }
            return new StandardKnowledge(args)
        }) as this | undefined
    }
}

export default StandardKnowledge
