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
        transform: (event) => ({
            messageType: 'StreamEvent',
            eventType: event.header.type,
            dataSourceKey: 'mtw.wml',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            RequestIds: event.header?.RequestIds ?? [],
            update: {
                type: 'Merge Conflict',
                error: event.update.error
            }
        })
    },
    {
        dataSourceKey: 'mtw.wml',
        type: 'Content Update',
        coreFormatGuard: makeCoreExternalFormatGuardFromHeaderGuard(isWMLContentUpdateHeader),
        transform: (event) => ({
            messageType: 'StreamEvent',
            eventType: event.header.type,
            dataSourceKey: 'mtw.wml',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            RequestIds: event.header?.RequestIds ?? [],
            update: {
                type: 'Content Update',
                wml: event.update.wml
            }
        })
    },
    {
        dataSourceKey: 'mtw.assets.contentHeaders',
        type: 'Headers Updated',
        transform: (event) => ({
            messageType: 'StreamEvent',
            eventType: event.header.type,
            dataSourceKey: 'mtw.assets.contentHeaders',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            update: {
                type: 'Headers Updated',
                assetId: event.assetId,
                zone: event.zone,
                RequestId: event.RequestId,
                wml: event.schema
            }
        })
    },
    {
        dataSourceKey: 'mtw.assets.library',
        type: 'Asset Added',
        transform: (event) => ({
            messageType: 'StreamEvent',
            eventType: event.header.type,
            dataSourceKey: 'mtw.assets.library',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            update: {
                type: 'Asset Added',
                assetId: event.assetId,
                RequestId: event.RequestId
            }
        })
    },
    {
        dataSourceKey: 'mtw.assets.library',
        type: 'Asset Removed',
        transform: (event) => ({
            messageType: 'StreamEvent',
            eventType: event.header.type,
            dataSourceKey: 'mtw.assets.library',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            update: {
                type: 'Asset Removed',
                assetId: event.assetId,
                RequestId: event.RequestId
            }
        })
    },
    {
        dataSourceKey: 'mtw.assets.players',
        transform: (event) => ({
            messageType: 'StreamEvent',
            eventType: event.header.type,
            dataSourceKey: 'mtw.assets.players',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            update: {
                ...event.update,
                ...(event.RequestId ? { RequestId: event.RequestId } : {})
            }
        })
    }
])
