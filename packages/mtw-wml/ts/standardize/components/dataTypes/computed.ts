import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardComputedData = {
    tag: 'Computed';
    src: string;
    dependencies?: string[];
} & StandardBaseData

export const isStandardComputed = (arg: any): arg is StandardComputedData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Computed'),
        checkTypes(
            arg,
            {
                key: 'string',
                src: 'string'
            },
            {}
        ),
        (((!Boolean('dependencies' in arg)) || typeof arg.dependencies === 'undefined' || (Array.isArray(arg.dependencies) && arg.dependencies.every((dependency: any) => (typeof dependency === 'string')))))
    )
}