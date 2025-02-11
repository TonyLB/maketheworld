import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { checkAll } from "../../../components/dataTypes/typeguards"

export type StandardGrantData = {
    tag: 'Grant';
    player: string;
    actions: string[];
}

export const isStandardGrant = (arg: any): arg is StandardGrantData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Grant'),
        checkTypes({ required: { tag: CheckTypes.STRING, player: CheckTypes.STRING }, values: { tag: 'Grant' } })(arg),
        Array.isArray(arg.actions) && arg.actions.every((action: any) => typeof action === 'string')
    )
}
