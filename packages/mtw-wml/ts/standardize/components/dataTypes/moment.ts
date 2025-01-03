import { SchemaTag } from "../../../schema/baseClasses"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardMomentData = {
    tag: 'Moment';
    messages: GenericTree<SchemaTag>;
} & StandardBaseData

export const isStandardMoment = (arg: any): arg is StandardMomentData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Moment'),
        checkTypes(arg, {
            key: 'string',
            messages: 'tree'
        },
        {})
    )
}
