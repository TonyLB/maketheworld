import { ParseTagFactory, ParseLinkTag } from "./baseClasses"
import { validateProperties, ExtractProperties } from "./utils"

export const parseLinkFactory: ParseTagFactory<ParseLinkTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseLinkTag, never>>({
        open,
        endTagToken,
        required: {
            to: ['key']
        },
        optional: {
        }
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Link',
            startTagToken: open.startTagToken,
            endTagToken,
            contents
        }
    }    
}

export default parseLinkFactory
