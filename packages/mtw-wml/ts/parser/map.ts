import { ParseTagFactory, ParseMapTag, ParseMapLegalContents } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseMapFactory: ParseTagFactory<ParseMapTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseMapTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        }
    })
    const parseContents = validateContents<ParseMapLegalContents>({
        contents,
        legalTags: ['Name', 'Room', 'Exit', 'Image', 'If', 'Else'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Map',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseMapFactory
