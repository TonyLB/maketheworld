import { SchemaTaggedMessageLegalContents, SchemaLinkTag, SchemaStringTag, SchemaTaggedMessageIncomingContents, isSchemaWhitespace, isSchemaLineBreak, isSchemaLink, isSchemaString, isSchemaSpacer, isSchemaConditionTagDescriptionContext, isSchemaCondition, SchemaConditionTag, isSchemaBookmark, SchemaBookmarkTag, SchemaConditionTagDescriptionContext, isSchemaAfter, isSchemaBefore, isSchemaReplace, SchemaAfterTag, SchemaBeforeTag, SchemaReplaceTag, isSchemaTaggedMessageLegalContents } from "../simpleSchema/baseClasses";

//
// Fold whitespace into TaggedMessage legal contents by appending or prepending it to String values
//
export const translateTaggedMessageContents = (contents: SchemaTaggedMessageIncomingContents[]): SchemaTaggedMessageLegalContents[] => {
    let returnValue: SchemaTaggedMessageLegalContents[] = []
    let currentToken: SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaConditionTagDescriptionContext | SchemaAfterTag | SchemaBeforeTag | SchemaReplaceTag | undefined
    contents.forEach((item) => {
        if (isSchemaWhitespace(item)) {
            if (currentToken) {
                if (isSchemaString(currentToken)) {
                    currentToken = {
                        ...currentToken,
                        value: `${currentToken.value.trimEnd()} `
                    }
                }
                else {
                    returnValue.push(currentToken)
                    currentToken = {
                        tag: 'String',
                        value: ' '
                    }
                }
            }
        }
        if (isSchemaLineBreak(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
                currentToken = undefined
            }
            returnValue.push(item)
        }
        if (isSchemaSpacer(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
                currentToken = undefined
            }
            returnValue.push(item)
        }
        if (isSchemaString(item)) {
            if (currentToken) {
                if (isSchemaString(currentToken)) {
                    currentToken = {
                        ...currentToken,
                        value: `${currentToken.value}${item.value}`
                    }
                }
                else {
                    returnValue.push(currentToken)
                    currentToken = { ...item }
                }
            }
            else {
                currentToken = { ...item }
            }
        }
        if (isSchemaCondition(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
            }
            currentToken = {
                ...item,
                contents: translateTaggedMessageContents(item.contents.filter(isSchemaTaggedMessageLegalContents))
            } as SchemaConditionTagDescriptionContext
        }
        if (isSchemaAfter(item) || isSchemaBefore(item) || isSchemaReplace(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
            }
            currentToken = {
                ...item,
                contents: translateTaggedMessageContents(item.contents.filter(isSchemaTaggedMessageLegalContents)) as SchemaTaggedMessageLegalContents[]
            }
        }
        if (isSchemaLink(item) || isSchemaBookmark(item)) {
            if (currentToken) {
                returnValue.push(currentToken)
            }
            currentToken = { ...item }
        }
    })
    if (currentToken) {
        if (currentToken.tag === 'String') {
            if (currentToken.value.trimEnd()) {
                returnValue.push({
                    ...currentToken,
                    value: currentToken.value.trimEnd()
                })
            }
        }
        else if (isSchemaCondition(currentToken)) {
            returnValue.push({
                ...currentToken,
                contents: translateTaggedMessageContents(currentToken.contents.filter(isSchemaTaggedMessageLegalContents))
            }  as SchemaConditionTagDescriptionContext)
        }
        else {
            returnValue.push(currentToken)
        }
    }
    return returnValue
}
