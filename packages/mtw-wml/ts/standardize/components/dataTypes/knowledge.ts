import { ReferenceListData } from "./reference";
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardKnowledgeData = {
    tag: 'Knowledge';
    shortName?: StandardEditableData<string>;
    examples?: ReferenceListData;
} & StandardBaseData

export const isStandardKnowledge = (arg: any): arg is StandardKnowledgeData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Knowledge'),
        checkTypes(arg, {}, { 
            key: 'string', 
            universalKey: 'string',
            shortName: 'literal'
        })
    )
}