import { SerializeNDJSONMixin } from "../baseClasses"
import { ComponentInterface } from "./abstract"
import { StandardComponentData } from "./dataTypes"

interface NDJSONWrappable extends ComponentInterface {
    toNDJSON(args: { from?: { assetId: string; key: string }, exportAs?: string }): StandardComponentData & SerializeNDJSONMixin
}

export const ndjsonWrap = <TBase extends new (...args: any[]) => ComponentInterface>(Base: TBase) => {
    return class NDJSONWrapped extends Base implements NDJSONWrappable {
        toNDJSON(args: { from?: { assetId: string; key: string; }; exportAs?: string; }): StandardComponentData & SerializeNDJSONMixin {
            return {
                ...(this.toJSON() as StandardComponentData),
                exportAs: args.exportAs,
                from: args.from
            }
        }

        override clone(): this {
            return new NDJSONWrapped(this.toJSON()) as this
        }

        override merge(incoming: this): this | undefined {
            const mergedOutput = super.merge(incoming)
            if (!mergedOutput) {
                return undefined
            }
            return new NDJSONWrapped(mergedOutput) as this
        }
    }
}
