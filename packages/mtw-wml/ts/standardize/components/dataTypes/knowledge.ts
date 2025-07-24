import { StandardReferenceData } from "./reference";
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { StandardRemoveData } from ".";

export type StandardKnowledgeData = {
    tag: 'Knowledge';
    examples?: (StandardReferenceData | StandardRemoveData)[];
} & StandardBaseData

export const isStandardKnowledge = (arg: any): arg is StandardKnowledgeData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Knowledge'),
        checkTypes(arg, {}, { key: 'string', universalKey: 'string' })
    )
}