import { SchemaDescriptionTag, SchemaDescriptionLegalContents, SchemaLinkTag, SchemaStringTag, SchemaDescriptionIncomingContents, isSchemaWhitespace, isSchemaLineBreak, isSchemaLink, isSchemaString } from "./baseClasses";
import { ParseDescriptionTag } from "../parser/baseClasses";

//
// Utility function to assign spaceBefore and spaceAfter depending upon the whitespace passed in from token parse
//
const adjustedDescriptionContents = (contents: SchemaDescriptionIncomingContents[], spaceBefore: boolean = false, spaceAfter: boolean = false): SchemaDescriptionLegalContents[] => {
    let returnValue: SchemaDescriptionLegalContents[] = []
    let currentToken: SchemaStringTag | SchemaLinkTag | undefined
    let currentSpaceBefore: boolean = spaceBefore
    let pastFirstToken: boolean = false
    contents.forEach((item) => {
        if (isSchemaWhitespace(item)) {
            if (currentToken) {
                returnValue.push({
                    ...currentToken,
                    spaceAfter: true
                })
                currentToken = undefined
            }
            if (pastFirstToken) {
                currentSpaceBefore = true
            }
        }
        if (isSchemaLineBreak(item)) {
            if (currentToken) {
                returnValue.push({
                    ...currentToken,
                    spaceAfter: true
                })
                currentToken = undefined
            }
            returnValue.push(item)
            currentSpaceBefore = true
            pastFirstToken = true
        }
        if (isSchemaLink(item) || isSchemaString(item)) {
            if (currentToken) {
                returnValue.push({
                    ...currentToken,
                    spaceAfter: false
                })
                currentSpaceBefore = false
                currentToken = {
                    ...item,
                    spaceBefore: false
                }
            }
            else {
                currentToken = {
                    ...item,
                    spaceBefore: currentSpaceBefore
                }
                currentSpaceBefore = false
            }
            pastFirstToken = true
        }
    })
    if (currentToken) {
        returnValue.push({
            ...currentToken,
            spaceAfter
        })
    }
    return returnValue
}

export const schemaFromDescription = (item: ParseDescriptionTag, contents: SchemaDescriptionIncomingContents[]): SchemaDescriptionTag => {
    return {
        tag: 'Description',
        spaceBefore: item.spaceBefore,
        spaceAfter: item.spaceAfter,
        display: item.display,
        contents: adjustedDescriptionContents(contents, item.spaceBefore, item.spaceAfter)
    }
}

export default schemaFromDescription
