import React, { FunctionComponent } from "react";
import { TaggedMessageContent as TaggedMessageContentType } from "@tonylb/mtw-interfaces/dist/messages"
import DescriptionLink from './DescriptionLink'
import { EphemeraActionId, EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from "@tonylb/mtw-interfaces/dist/baseClasses";

interface TaggedMessageContentProps {
    list: TaggedMessageContentType[];
    onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraActionId | EphemeraCharacterId) => void;
}

const TaggedMessageContent: FunctionComponent<TaggedMessageContentProps> = ({ list, onClickLink }) => {
    const messages = list.map((item, index) => {
        switch(item.tag) {
            case 'Link':
                return <DescriptionLink link={item} key={index} onClickLink={onClickLink} />
            case 'String':
                return item.value
            case 'LineBreak':
                return <span key={`lineBreak-${index}`} style={{ display: 'block', marginBottom: '0.5em' }} />
            default:
                return null
        }
    })
    return <React.Fragment>
        { messages }
    </React.Fragment>
}

export default TaggedMessageContent
