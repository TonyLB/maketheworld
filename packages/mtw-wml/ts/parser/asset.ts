import { ParseTagFactory, ParseAssetTag } from "./baseClasses"
import { validateProperties, isValidateError, ExtractProperties } from "./utils"

export const parseAssetFactory: ParseTagFactory<ParseAssetTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseAssetTag, never>>({
        open,
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
    if (isValidateError(validate)) {
        return {
            type: 'Tag',
            tag: validate
        }
    }
    else {
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
}

export default parseAssetFactory