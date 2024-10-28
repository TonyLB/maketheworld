import { excludeUndefined } from "../../lib/lists"
import { isSchemaKnowledge, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"

export class StandardKnowledge extends StandardComponentWithNameAndDesc {
    tag = 'Knowledge' as const
    constructor(args: StandardKnowledgeData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            if (!isSchemaKnowledge(args.data)) {
                throw new Error('Type mismatch in StandardKnowledge constructor')
            }
        }
    }

    override toJSON(): StandardKnowledgeData {
        return {
            key: this.key,
            tag: 'Knowledge',
            name: this.name,
            description: this.description
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Knowledge', key: this.key },
            children: [this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1)
        }
    }

    override merge(incoming: StandardComponentAbstract): StandardKnowledge {
        if (!(incoming instanceof StandardKnowledge)) {
            throw new Error('Type mismatch on StandardComponent merge')
        }
        const superMerge = super.merge(incoming)
        const args: StandardKnowledgeData = {
            ...superMerge.toJSON(),
            tag: 'Knowledge',
        }
        return new StandardKnowledge(args)
    }
}

export default StandardKnowledge
