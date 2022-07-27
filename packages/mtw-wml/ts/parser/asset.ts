import { ParseTagFactory, ParseAssetTag } from "./baseClasses"
import { validateProperties, ExtractProperties } from "./utils"

export const parseAssetFactory: ParseTagFactory<ParseAssetTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseAssetTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            fileName: ['literal'],
            zone: ['literal'],
            subFolder: ['literal'],
            player: ['literal']
        }
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Asset',
            startTagToken: open.startTagToken,
            endTagToken,
            contents
        }
    }    
}

export default parseAssetFactory