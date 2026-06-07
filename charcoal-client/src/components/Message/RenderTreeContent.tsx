import React, { FunctionComponent } from "react";
import DescriptionLink from './DescriptionLink'
import { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from "@tonylb/mtw-interfaces/ts/baseClasses";
import { isSchemaLineBreak, isSchemaLink, isSchemaString, SchemaLinkTag } from "@tonylb/mtw-base/ts/schema/renderTree";
import { RenderTree, RenderTreeNode } from "@tonylb/mtw-base/ts/renderTree";
import { collapseDisplayWhitespace } from "./collapseDisplayWhitespace";

interface RenderTreeContentProps {
    list: RenderTree;
    onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraCharacterId) => void;
}

const RenderTreeContent: FunctionComponent<RenderTreeContentProps> = ({ list, onClickLink }) => {
    const displayList = collapseDisplayWhitespace(list)
    const messages = displayList.map((item, index) => {
        if (typeof item === 'string') {
            return item
        }
        if (isSchemaString(item.data)) {
            return item.data.value
        }
        if (isSchemaLink(item.data)) {
            return <DescriptionLink link={item as RenderTreeNode & { data: SchemaLinkTag }} key={index} onClickLink={onClickLink} />
        }
        if (isSchemaLineBreak(item.data)) {
            return <span key={`lineBreak-${index}`} data-testid="render-line-break" style={{ display: 'block', marginBottom: '0.5em' }} />
        }

        return null
    })
    return <React.Fragment>
        { messages }
    </React.Fragment>
}

export default RenderTreeContent
