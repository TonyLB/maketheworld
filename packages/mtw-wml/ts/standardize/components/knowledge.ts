import { excludeUndefined } from "../../lib/lists"
import { isSchemaKnowledge, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { isStandardKnowledge, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { unwrapConstructorArgs, wrapJSON, wrapSchema } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"

export class StandardKnowledge extends StandardComponentWithNameAndDesc {
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

    override merge(incoming: StandardComponentAbstract): StandardKnowledge {
        if (!(incoming instanceof StandardKnowledge)) {
            throw new Error('Type mismatch on StandardComponent merge')
        }
        const superMerge = super.merge(incoming)
        if (!superMerge) {
            throw new Error('Merge failure in StandardKnowledge')
        }
        const args: StandardKnowledgeData = {
            ...superMerge.toJSON(),
            tag: 'Knowledge',
        }
        return new StandardKnowledge(args)
    }
}

export default StandardKnowledge
