import React, { FunctionComponent } from "react";
import { TaggedMessageContent as TaggedMessageContentType } from "@tonylb/mtw-interfaces/dist/messages"
import DescriptionLink from './DescriptionLink'

interface TaggedMessageContentProps {
    list: TaggedMessageContentType[];
}

const TaggedMessageContent: FunctionComponent<TaggedMessageContentProps> = ({ list }) => {
    const messages = list.map((item, index) => {
        switch(item.tag) {
            case 'Link':
                return <DescriptionLink link={item} key={index} />
            case 'String':
                return item.value
            case 'LineBreak':
                return <span style={{ display: 'block', marginBottom: '0.5em' }} />
            default:
                return null
        }
    })
    return <React.Fragment>
        { messages }
    </React.Fragment>
}

export default TaggedMessageContent
