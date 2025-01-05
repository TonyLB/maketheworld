import React, { FunctionComponent } from "react";
import DescriptionLink from './DescriptionLink'
import { EphemeraActionId, EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from "@tonylb/mtw-interfaces/dist/baseClasses";
import { RenderTree, RenderTreeNode } from "@tonylb/mtw-wml/dist/standardize/render/baseClasses"
import { isSchemaLineBreak, isSchemaLink, isSchemaString, SchemaLinkTag } from "@tonylb/mtw-base/dist/schema/renderTree";

interface RenderTreeContentProps {
    list: RenderTree;
    onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraActionId | EphemeraCharacterId) => void;
}

const RenderTreeContent: FunctionComponent<RenderTreeContentProps> = ({ list, onClickLink }) => {
    const messages = list.map((item, index) => {
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
            return <span key={`lineBreak-${index}`} style={{ display: 'block', marginBottom: '0.5em' }} />
        }

        return null
    })
    return <React.Fragment>
        { messages }
    </React.Fragment>
}

export default RenderTreeContent
