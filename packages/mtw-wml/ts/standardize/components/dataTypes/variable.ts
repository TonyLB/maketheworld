import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardVariableData = {
    tag: 'Variable';
    default: string;
} & StandardBaseData

export const isStandardVariable = (arg: any): arg is StandardVariableData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Variable'),
        checkTypes(arg, {
            key: 'string'
        },
        {
            default: 'string'
        })
    )
}