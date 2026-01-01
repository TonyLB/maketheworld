import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardImageData = {
    tag: 'Image';
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
            {}
        )
    )
}