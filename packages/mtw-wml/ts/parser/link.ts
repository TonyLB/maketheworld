import { ParseTagFactory, ParseLinkTag, ParseLinkLegalContents } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

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
    const parseContents = validateContents<ParseLinkLegalContents>({
        contents,
        legalTags: ['Whitespace', 'String'],
        ignoreTags: ['Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Link',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseLinkFactory
