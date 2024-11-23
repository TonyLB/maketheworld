import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardActionData = {
    tag: 'Action';
    src: string;
} & StandardBaseData

export const isStandardAction = (arg: any): arg is StandardActionData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Action'),
        checkTypes(arg, {
            key: 'string',
            src: 'string'
        },
        {})
    )
}