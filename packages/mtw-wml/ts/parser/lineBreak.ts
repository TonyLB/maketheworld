import { ParseTagFactory, ParseLineBreakTag } from "./baseClasses"
import { validateProperties, ExtractProperties } from "./utils"

export const parseLineBreakFactory: ParseTagFactory<ParseLineBreakTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseLineBreakTag, never>>({
        open,
        endTagToken,
        required: {},
        optional: {}
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'br',
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export default parseLineBreakFactory
