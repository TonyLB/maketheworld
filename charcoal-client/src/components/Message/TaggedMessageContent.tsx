import React, { FunctionComponent } from "react";
import { TaggedMessageContent as TaggedMessageContentType } from "../../slices/messages/baseClasses"
import DescriptionLink from './DescriptionLink'

interface TaggedMessageContentProps {
    list: TaggedMessageContentType[];
}

const TaggedMessageContent: FunctionComponent<TaggedMessageContentProps> = ({ list }) => {
    return <React.Fragment>
        {
            list.map((item, index) => {
                switch(item.tag) {
                    case 'Link':
                        return <DescriptionLink link={item} key={index} />
                    case 'String':
                        return item.value
                }
            })
        }
    </React.Fragment>
}

export default TaggedMessageContent
