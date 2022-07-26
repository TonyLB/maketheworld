import { ParseTagFactory, ParseFeatureTag } from "./baseClasses"
import { validateProperties, isValidateError, ExtractProperties } from "./utils"

export const parseFeatureFactory: ParseTagFactory<ParseFeatureTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseFeatureTag>>({
        open,
        required: {
            key: ['key']
        },
        optional: {
            global: ['boolean']
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
                tag: 'Feature',
                startTagToken: open.startTagToken,
                endTagToken,
                contents
            }
        }    
    }
}

export default parseFeatureFactory
