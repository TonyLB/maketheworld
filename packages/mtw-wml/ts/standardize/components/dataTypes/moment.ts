import { SchemaTag } from "../../../schema/baseClasses"
import { GenericTree } from "../../../tree/baseClasses"
import { StandardBaseData } from "./abstract"

export type StandardMomentData = {
    tag: 'Moment';
    messages: GenericTree<SchemaTag>;
} & StandardBaseData
