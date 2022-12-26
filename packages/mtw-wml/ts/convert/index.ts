import { ParseCommentTag, ParseStackTagEntry } from "../parser/baseClasses";
import { SchemaStringTag, SchemaTag } from "../schema/baseClasses";
import ParseAssetsMixin from "./assets";
import ParseCharacterMixin from "./character";
import ParseComponentsMixin from "./components";
import ParseConditionsMixin from "./conditions";
import { BaseConverter, Constructor, SchemaToWMLOptions } from "./functionMixins";
import ParseImportMixin from "./import";
import ParseMiscellaneousMixin from "./miscellaneous";
import ParseStateMixin from "./state";
import ParseTaggedMessageMixin from "./taggedMessage";

export const FallbackMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class FallbackMixin extends Base {
        override parseConvert(value: any): ParseStackTagEntry<ParseCommentTag> {
            return {
                type: 'Tag',
                tag: {
                    tag: 'Comment',
                    startTagToken: value?.props?.open?.startTagToken,
                    endTagToken: value?.props?.endTagToken
                }
            } as ParseStackTagEntry<ParseCommentTag>
        }

        override schemaConvert(value: any, siblings: any, contents: any): SchemaStringTag {
            return {
                tag: 'String',
                value: '',
                parse: value
            }
        }

    }
}

export class WMLConverter extends
    ParseAssetsMixin(
    ParseCharacterMixin(
    ParseConditionsMixin(
    ParseMiscellaneousMixin(
    ParseImportMixin(
    ParseStateMixin(
    ParseComponentsMixin(
    ParseTaggedMessageMixin(
    FallbackMixin(
        BaseConverter
    ))))))))) {}

export default WMLConverter
