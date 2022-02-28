import {
    confirmRequiredProps,
    wmlProcessUpNonRecursive,
    validate,
    liftKeyProps,
    liftLiteralProps,
    liftExpressionProps,
    liftBooleanProps,
    liftLiteralTags,
    liftUntagged,
    liftContents,
    liftUseTags,
    liftDependencyTags,
    liftPronounTags,
    confirmKeyProps,
    confirmExpressionProps,
    confirmLiteralProps,
    discardContents
} from './processUp/index.js'

const fileNameValidator = ({ fileName = '' }) => (fileName?.match?.(/^[\w\d-_]+$/) ? [] : [`FileName property of Asset must be composed exclusively of letters, numbers, '-' and '_'`])

const processTagProps = (tag, props) => ({
    tag: tag.sourceString,
    props: props.children
        .map((prop) => prop.schema())
        .reduce((previous, { argument, key, expression, literal }) => ({
            ...previous,
            [argument]: {
                key,
                expression,
                literal
            }
        }), {})
})

export const schema = {
    //
    // TODO: Parse out string-internal white-space as needed
    //
    JSExpression(node) {
        return this.sourceString
    },
    stringText(node) {
        return this.sourceString
    },
    legalKey(node) {
        return this.sourceString
    },
    spaceCompressor(node) {
        return ' '
    },
    _iter(...nodes) {
        return nodes.map((node) => (node.schema())).join('')
    },
    tagArgValueQuoted(value, _) {
        return value.sourceString
    },
    TagArgumentKey(argument, openBracket, key, closeBracket) {
        return {
            argument: argument.sourceString,
            key: key.schema()
        }
    },
    TagArgumentBracketed(argument, openBracket, expression, closeBracket) {
        return {
            argument: argument.sourceString,
            expression: expression.schema()
        }
    },
    tagArgumentQuoted(argument, openQuote, literal) {
        return {
            argument: argument.sourceString,
            literal: literal.schema()
        }
    },
    tagBooleanArgument(argument, lookAhead) {
        return {
            argument: argument.sourceString,
            literal: true
        }
    },
    TagOpen(open, tag, props, close) {
        return processTagProps(tag, props)
    },
    TagSelfClosing(open, tag, props, close) {
        return {
            ...processTagProps(tag, props),
            contents: []
        }
    },
    TagExpression(open, contents, close) {
        return {
            ...open.schema(),
            contents: contents.children.map(item => item.schema())
        }
    },
    VariableExpression(node) {
        return wmlProcessUpNonRecursive([
            validate(confirmRequiredProps(['key'])),
            validate(confirmKeyProps(['key'])),
            validate(confirmExpressionProps(['default'])),
            liftExpressionProps(['default']),
            liftKeyProps(['key']),
            discardContents,
        ])(node.schema())
    },
    ComputedExpression(node) {
        return wmlProcessUpNonRecursive([
            validate(confirmRequiredProps(['key'])),
            validate(confirmKeyProps(['key'])),
            validate(confirmExpressionProps(['src'])),
            liftExpressionProps(['src']),
            liftKeyProps(['key']),
            liftDependencyTags,
            discardContents,
        ])(node.schema())
    },
    ActionExpression(node) {
        return wmlProcessUpNonRecursive([
            validate(confirmRequiredProps(['key'])),
            validate(confirmKeyProps(['key'])),
            validate(confirmExpressionProps(['src'])),
            liftExpressionProps(['src']),
            liftKeyProps(['key']),
            discardContents,
        ])(node.schema())
    },
    FeatureExpression(node) {
        return wmlProcessUpNonRecursive([
            // desourceTag,
            validate(confirmRequiredProps(['key'])),
            validate(confirmKeyProps(['key'])),
            validate(({ display = 'replace' }) => (['replace', 'after', 'before'].includes(display) ? [] : [`"${display}" is not a valid value for property 'display' in Room"`])),
            liftKeyProps(['key']),
            liftLiteralProps(['display']),
            liftBooleanProps(['global']),
            liftLiteralTags({ Name: 'name' }),
            liftContents('render'),
        ])(node.schema())
    },
    RoomExpression(node) {
        return wmlProcessUpNonRecursive([
            // desourceTag,
            validate(confirmRequiredProps(['key'])),
            validate(confirmKeyProps(['key'])),
            validate(({ display = 'replace' }) => (['replace', 'after', 'before'].includes(display) ? [] : [`"${display}" is not a valid value for property 'display' in Room"`])),
            liftKeyProps(['key']),
            liftLiteralProps(['display']),
            liftBooleanProps(['global']),
            liftLiteralTags({ Name: 'name' }),
            liftContents('render', { exclude: ['Exit'] }),
        ])(node.schema())
    },
    ExitExpression(node) {
        return wmlProcessUpNonRecursive([
            // desourceTag,
            validate(confirmKeyProps(['key', 'to', 'from'])),
            liftKeyProps(['key', 'to', 'from']),
            liftUntagged('name', { allString: true })
        ])(node.schema())
    },
    LinkExpression(node) {
        return wmlProcessUpNonRecursive([
            // desourceTag,
            validate(confirmKeyProps(['key', 'to'])),
            liftKeyProps(['key', 'to']),
            liftUntagged('text', { allString: true })
        ])(node.schema())
    },
    LayerExpression(node) {
        return wmlProcessUpNonRecursive([
                // desourceTag,
                validate(confirmKeyProps(['key'])),
                liftKeyProps(['key'])
            ])(node.schema())
    },
    ConditionExpression(node) {
        return wmlProcessUpNonRecursive([
                // desourceTag,
                validate(confirmRequiredProps(['if'])),
                validate(confirmExpressionProps(['if'])),
                liftExpressionProps(['if']),
                liftDependencyTags
            ])(node.schema())
    },
    UseExpression(node) {
        return wmlProcessUpNonRecursive([
            validate(confirmRequiredProps(['key'])),
            validate(confirmKeyProps(['key', 'as'])),
            liftKeyProps(['key', 'as'])
        ])(node.schema())
    },
    ImportExpression(node) {
        return wmlProcessUpNonRecursive([
            validate(confirmRequiredProps(['from'])),
            validate(confirmKeyProps(['from'])),
            liftKeyProps(['from']),
            liftUseTags
        ])(node.schema())
    },
    DependencyExpression(node) {
        return wmlProcessUpNonRecursive([
            validate(confirmRequiredProps(['on'])),
            validate(confirmKeyProps(['on'])),
            liftKeyProps(['on'])
        ])(node.schema())
    },
    AssetExpression(node) {
        return wmlProcessUpNonRecursive([
                // desourceTag,
                validate(confirmRequiredProps(['key', 'fileName'])),
                validate(confirmKeyProps(['key'])),
                validate(confirmLiteralProps(['fileName', 'zone', 'subFolder', "player"])),
                liftKeyProps(['key']),
                liftLiteralProps(['fileName', 'player', 'zone']),
                validate(fileNameValidator),
                liftLiteralTags({ Name: 'name' }),
                liftUntagged('description', { allString: true })
            ])(node.schema())
    },
    StoryExpression(node) {
        return {
            ...wmlProcessUpNonRecursive([
                // desourceTag,
                validate(confirmRequiredProps(['key', 'fileName'])),
                validate(confirmKeyProps(['key'])),
                validate(confirmLiteralProps(['fileName', 'zone', 'subFolder', "player"])),
                liftKeyProps(['key']),
                liftLiteralProps(['fileName', 'player', 'zone']),
                liftBooleanProps(['instance']),
                validate(fileNameValidator),
                liftLiteralTags({ Name: 'name' }),
                liftUntagged('description', { allString: true })
            ])(node.schema()),
            tag: 'Asset',
            Story: true
        }
    },
    PronounsExpression(node) {
        const returnVal = wmlProcessUpNonRecursive([
            // desourceTag,
            validate(confirmLiteralProps(['subject', 'object', 'possessive', 'adjective', 'reflexive'])),
            liftLiteralProps(['subject', 'object', 'possessive', 'adjective', 'reflexive']),
        ])(node.schema())
        return returnVal
    },
    CharacterExpression(node) {
        const returnVal = wmlProcessUpNonRecursive([
            // desourceTag,
            validate(confirmRequiredProps(['key', 'player', 'fileName'])),
            validate(confirmKeyProps(['key'])),
            validate(confirmLiteralProps(['player', 'fileName'])),
            liftKeyProps(['key']),
            liftLiteralProps(['player', 'fileName']),
            validate(fileNameValidator),
            liftPronounTags,
            liftLiteralTags({
                Name: 'Name',
                FirstImpression: 'FirstImpression',
                OneCoolThing: 'OneCoolThing',
                Outfit: 'Outfit'
            })
        ])(node.schema())
        return returnVal
    }
}
