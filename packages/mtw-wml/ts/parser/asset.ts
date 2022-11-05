import { ParseTagFactory, ParseAssetTag, ParseStoryTag, ParseAssetLegalContents } from "./baseClasses"
import { validateProperties, validateContents, ExtractProperties } from "./utils"

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
    const parseContents = validateContents<ParseAssetLegalContents>({
        contents,
        legalTags: ['Action', 'Computed', 'If', 'Else', 'ElseIf', 'Exit', 'Feature', 'Import', 'Room', 'Variable', 'Map'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Asset',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export const parseStoryFactory: ParseTagFactory<ParseStoryTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseStoryTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            fileName: ['literal'],
            zone: ['literal'],
            subFolder: ['literal'],
            player: ['literal'],
            instance: ['boolean']
        }
    })
    const parseContents = validateContents<ParseAssetLegalContents>({
        contents,
        legalTags: ['Action', 'Computed', 'If', 'Exit', 'Feature', 'Import', 'Room', 'Variable', 'Map'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Story',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseAssetFactory