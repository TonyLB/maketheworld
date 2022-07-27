import { ParseTagFactory, ParseFeatureTag } from "./baseClasses"
import { validateProperties, ExtractProperties } from "./utils"

export const parseFeatureFactory: ParseTagFactory<ParseFeatureTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseFeatureTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            global: ['boolean']
        }
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Feature',
            startTagToken: open.startTagToken,
            endTagToken,
            contents
        }
    }    
}

export default parseFeatureFactory
