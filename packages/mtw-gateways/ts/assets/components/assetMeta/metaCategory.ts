import { splitType } from '@tonylb/mtw-utilities/ts/types';
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema';

export const metaDataCategoryForEphemeraId = (EphemeraId: ComponentUUID): string => {
    const type = splitType(EphemeraId)[0]
    return `Meta::${type[0]}${type.slice(1).toLocaleLowerCase()}`
}
