export type CoordinationClientSuccessMessage = {
    messageType: 'Success';
    RequestId?: string;
}

export type CoordinationClientErrorMessage = {
    messageType: 'Error';
    RequestId?: string;
    error?: string;
}

export type CoordinationClientMessage = CoordinationClientSuccessMessage |
    CoordinationClientErrorMessage
