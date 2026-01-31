import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardImageData = {
    tag: 'Image';
    shortName?: StandardEditableData<string>;
} & StandardBaseData

export const isStandardImageData = (arg: any): arg is StandardImageData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Image'),
        checkTypes(
            arg,
            { key: 'key' },
            { shortName: 'literal' }
        )
    )
}