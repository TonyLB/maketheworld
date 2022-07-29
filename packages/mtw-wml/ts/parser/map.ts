import { ParseTagFactory, ParseMapTag, ParseExitTag, ParseRoomTag, ParseNameTag, ParseImageTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseMapFactory: ParseTagFactory<ParseMapTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseMapTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        }
    })
    const parseContents = validateContents<ParseExitTag | ParseRoomTag | ParseNameTag | ParseImageTag>({
        contents,
        legalTags: ['Name', 'Room', 'Exit', 'Image'],
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
