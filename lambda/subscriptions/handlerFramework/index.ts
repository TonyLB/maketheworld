import { SubscriptionClientMessage } from "@tonylb/mtw-interfaces/ts/subscriptions";
import { makeCoreExternalFormatGuardFromHeaderGuard } from "@tonylb/mtw-lambda-patterns/ts/dataSource";
import type { CoreExternalFormat, CoreExternalFormatHeader } from "@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform";
import { SubscriptionHandler, SubscriptionLibrary } from "./baseClasses";

type LibraryEntry = {
    dataSourceKey: string;
    type?: string;
    detailExtract?: (event: Record<string, any>) => string;
    transform?: (event: Record<string, any>) => SubscriptionClientMessage;
    coreFormatGuard?: (event: CoreExternalFormat) => boolean;
}

export const subscriptionLibraryConstructor = (entries: LibraryEntry[]): SubscriptionLibrary => {
    return new SubscriptionLibrary({
        library: entries.map((entry) => (new SubscriptionHandler(entry)))
    })
}

type WMLContentUpdateHeader = CoreExternalFormatHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' };
const isWMLContentUpdateHeader = (header: CoreExternalFormatHeader): header is WMLContentUpdateHeader =>
    header.dataSourceKey === 'mtw.wml' && header.type === 'Content Update'

export const subscriptionLibrary = subscriptionLibraryConstructor([
    {
        dataSourceKey: 'mtw.wml',
        type: 'Merge Conflict',
    },
    {
        dataSourceKey: 'mtw.wml',
        type: 'Content Update',
        coreFormatGuard: makeCoreExternalFormatGuardFromHeaderGuard(isWMLContentUpdateHeader),
    },
    {
        dataSourceKey: 'mtw.assets.contentHeaders',
        type: 'Headers Updated',
    },
    {
        dataSourceKey: 'mtw.assets.library',
        type: 'Asset Added',
    },
    {
        dataSourceKey: 'mtw.assets.library',
        type: 'Asset Removed'
    },
    {
        dataSourceKey: 'mtw.assets.players'
    },
    {
        dataSourceKey: 'mtw.ephemera.thinking.scheduling',
        type: 'Job Completed',
    }
])
