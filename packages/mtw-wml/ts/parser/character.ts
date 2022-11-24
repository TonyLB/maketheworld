import { BaseConverter, Constructor, ConverterMixinFactory, isTypedParseTagOpen } from "../functionMixins"
import { ParseTagFactory, ParseCharacterTag, ParsePronounsTag, ParseNameTag, ParseOutfitTag, ParseOneCoolThingTag, ParseImageTag, ParseStringTag, ParseCommentTag } from "./baseClasses"
import { validateProperties, validateContents, ExtractProperties } from "./utils"

export const parsePronounsFactory: ParseTagFactory<ParsePronounsTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParsePronounsTag, never>>({
        open,
        endTagToken,
        required: {
            subject: ['literal'],
            object: ['literal'],
            possessive: ['literal'],
            adjective: ['literal'],
            reflexive: ['literal']
        },
        optional: {}
    })
    validateContents<ParseCommentTag>({
        contents,
        legalTags: [],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            tag: 'Pronouns',
            ...validate,
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export const parseOutfitFactory: ParseTagFactory<ParseOutfitTag> = ({ open, contents, endTagToken }) => {
    validateProperties<ExtractProperties<ParseOutfitTag, never>>({
        open,
        endTagToken,
        required: {}
    })
    const parseContents = validateContents<ParseStringTag>({
        contents,
        legalTags: ['String'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            tag: 'Outfit',
            value: parseContents.map(({ value }) => (value)).join(' '),
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export const parseOneCoolThingFactory: ParseTagFactory<ParseOneCoolThingTag> = ({ open, contents, endTagToken }) => {
    validateProperties<ExtractProperties<ParseOneCoolThingTag, never>>({
        open,
        endTagToken,
        required: {}
    })
    const parseContents = validateContents<ParseStringTag>({
        contents,
        legalTags: ['String'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            tag: 'OneCoolThing',
            value: parseContents.map(({ value }) => (value)).join(' '),
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export const parseCharacterFactory: ParseTagFactory<ParseCharacterTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseCharacterTag, never>>({
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
    const parseContents = validateContents<ParseNameTag | ParsePronounsTag | ParseOutfitTag | ParseOneCoolThingTag | ParseImageTag>({
        contents,
        legalTags: ['Name', 'Pronouns', 'Outfit', 'OneCoolThing', 'Image'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Character',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export const ParseCharacterTagMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('Character'),
    convert: ({ open, contents, endTagToken }) => {
        const validate = validateProperties<ExtractProperties<ParseCharacterTag, never>>({
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
        const parseContents = validateContents<ParseNameTag | ParsePronounsTag | ParseOutfitTag | ParseOneCoolThingTag | ParseImageTag>({
            contents,
            legalTags: ['Name', 'Pronouns', 'Outfit', 'OneCoolThing', 'Image'],
            ignoreTags: ['Whitespace', 'Comment']
        })
        return {
            type: 'Tag',
            tag: {
                ...validate,
                tag: 'Character',
                startTagToken: open.startTagToken,
                endTagToken,
                contents: parseContents
            }
        }    
    }
})

export const ParseOneCoolThingMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('OneCoolThing'),
    convert: ({ open, contents, endTagToken }) => {
        validateProperties<ExtractProperties<ParseOneCoolThingTag, never>>({
            open,
            endTagToken,
            required: {}
        })
        const parseContents = validateContents<ParseStringTag>({
            contents,
            legalTags: ['String'],
            ignoreTags: ['Whitespace', 'Comment']
        })
        return {
            type: 'Tag',
            tag: {
                tag: 'OneCoolThing',
                value: parseContents.map(({ value }) => (value)).join(' '),
                startTagToken: open.startTagToken,
                endTagToken,
                contents: parseContents
            }
        }    
    }
})

export const ParseOutfitMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('Outfit'),
    convert: ({ open, contents, endTagToken }) => {
        validateProperties<ExtractProperties<ParseOutfitTag, never>>({
            open,
            endTagToken,
            required: {}
        })
        const parseContents = validateContents<ParseStringTag>({
            contents,
            legalTags: ['String'],
            ignoreTags: ['Whitespace', 'Comment']
        })
        return {
            type: 'Tag',
            tag: {
                tag: 'Outfit',
                value: parseContents.map(({ value }) => (value)).join(' '),
                startTagToken: open.startTagToken,
                endTagToken,
                contents: parseContents
            }
        }    
    }
})

export const ParsePronounsMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('Pronouns'),
    convert: ({ open, contents, endTagToken }) => {
        const validate = validateProperties<ExtractProperties<ParsePronounsTag, never>>({
            open,
            endTagToken,
            required: {
                subject: ['literal'],
                object: ['literal'],
                possessive: ['literal'],
                adjective: ['literal'],
                reflexive: ['literal']
            },
            optional: {}
        })
        validateContents<ParseCommentTag>({
            contents,
            legalTags: [],
            ignoreTags: ['Whitespace', 'Comment']
        })
        return {
            type: 'Tag',
            tag: {
                tag: 'Pronouns',
                ...validate,
                startTagToken: open.startTagToken,
                endTagToken
            }
        }    
    }
})

export const ParseCharacterMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
    ParseCharacterTagMixin(
    ParseOneCoolThingMixin(
    ParseOutfitMixin(
    ParsePronounsMixin(
        Base
    ))))
)

export default parseCharacterFactory