import {
    confirmRequiredProps,
    wmlProcessUpNonRecursive,
    validate,
    liftLiteralProps,
    liftExpressionProps,
    liftBooleanProps,
    liftLiteralTags,
    liftUntagged,
    liftUseTags,
    liftImportTags,
    confirmExpressionProps,
    confirmLiteralProps
} from './processUp/index.js'

const fileNameValidator = ({ fileName = '' }) => (fileName?.match?.(/^[\w\d-_]+$/) ? [] : [`FileName property of Asset must be composed exclusively of letters, numbers, '-' and '_'`])

const processTagProps = (tag, props) => ({
    tag: tag.sourceString,
    props: props.children
        .map((prop) => prop.schema())
        .reduce((previous, { argument, expression, literal }) => ({
            ...previous,
            [argument]: {
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
    spaceCompressor(node) {
        return ' '
    },
    _iter(...nodes) {
        return nodes.map((node) => (node.schema())).join('')
    },
    tagArgValueQuoted(value, _) {
        return value.sourceString
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
            validate(confirmLiteralProps(['key'])),
            validate(confirmExpressionProps(['default'])),
            liftExpressionProps(['default']),
            liftLiteralProps(['key']),
            liftExpressionProps(['default'])
        ])(node.schema())
    },
    RoomExpression(node) {
        return wmlProcessUpNonRecursive([
            // desourceTag,
            validate(confirmRequiredProps(['key'])),
            validate(confirmLiteralProps(['key'])),
            validate(({ display = 'replace' }) => (['replace', 'after', 'before'].includes(display) ? [] : [`"${display}" is not a valid value for property 'display' in Room"`])),
            liftLiteralProps(['key', 'display']),
            liftBooleanProps(['global']),
            liftLiteralTags({ Name: 'name' }),
            liftUntagged('render'),
        ])(node.schema())
    },
    ExitExpression(node) {
        return wmlProcessUpNonRecursive([
            // desourceTag,
            validate(confirmLiteralProps(['key', 'to', 'from'])),
            liftLiteralProps(['key', 'to', 'from']),
            liftUntagged('name')
        ])(node.schema())
    },
    LayerExpression(node) {
        return wmlProcessUpNonRecursive([
                // desourceTag,
                validate(confirmLiteralProps(['key'])),
                liftLiteralProps(['key'])
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
            validate(confirmLiteralProps(['key', 'as'])),
            liftLiteralProps(['key', 'as'])
        ])(node.schema())
    },
    ImportExpression(node) {
        return wmlProcessUpNonRecursive([
            validate(confirmRequiredProps(['from'])),
            validate(confirmLiteralProps(['from'])),
            liftLiteralProps(['from']),
            liftUseTags
        ])(node.schema())
    },
    AssetExpression(node) {
        return wmlProcessUpNonRecursive([
                // desourceTag,
                validate(confirmRequiredProps(['key', 'fileName'])),
                validate(confirmLiteralProps(['key', 'fileName', 'zone', 'subFolder', "player"])),
                liftLiteralProps(['key', 'fileName', 'player', 'zone']),
                validate(fileNameValidator),
                liftLiteralTags({ Name: 'name' }),
                liftImportTags,
                liftUntagged('description')
            ])(node.schema())
    },
    CharacterExpression(node) {
        const returnVal = wmlProcessUpNonRecursive([
            // desourceTag,
            validate(confirmRequiredProps(['key', 'player', 'fileName'])),
            validate(confirmLiteralProps(['key', 'player', 'fileName'])),
            liftLiteralProps(['key', 'player', 'fileName']),
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
