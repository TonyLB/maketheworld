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
    liftImportTags,
    confirmKeyProps,
    confirmExpressionProps,
    confirmLiteralProps
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
        return processTagProps(tag, props)
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
            liftUntagged('src', { allString: true })
        ])(node.schema())
    },
    ActionExpression(node) {
        return wmlProcessUpNonRecursive([
            validate(confirmRequiredProps(['key'])),
            validate(confirmKeyProps(['key'])),
            validate(confirmExpressionProps(['src'])),
            liftExpressionProps(['src']),
            liftKeyProps(['key']),
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
            liftContents('render'),
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
                liftExpressionProps(['if'])
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
                liftImportTags,
                liftUntagged('description', { allString: true })
            ])(node.schema())
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
            liftLiteralTags({
                Name: 'Name',
                Pronouns: 'Pronouns',
                FirstImpression: 'FirstImpression',
                OneCoolThing: 'OneCoolThing',
                Outfit: 'Outfit'
            })
        ])(node.schema())
        return returnVal
    }
}
