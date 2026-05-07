# Cognito event lambda

## Purpose

This lambda handles Cognito User Pool triggers and publishes signup events into the event mesh.

## Trigger boundaries

- **PreSignUp (`PreSignUp_SignUp`)**: handled directly in [`app.ts`](./app.ts) by mutating `event.response.autoConfirmUser = true` and returning the Cognito event.
- **PostConfirmation (`PostConfirmation_ConfirmSignUp`)**: normalized through local ingress/DataSource flow and published as `mtw.cognito` / `New Player` with payload `{ player }`.

**Heal entry is publish-only.** PostConfirmation does not start the heal Step Function or invoke any other lambda directly. Downstream player heal happens in `AssetsFunction` via the `mtw.cognito` EventBridge subscription (idempotent, see [`../assets/AGENT.event.md`](../assets/AGENT.event.md)). `CognitoHandlerFunction` is the **only** lambda attached to User Pool triggers in the SAM template; verify any non-SAM (console-attached) triggers are absent before deploys per the **Phase 5** check in the player heal authority task plan.

## PostConfirmation publish flow

1. [`app.ts`](./app.ts) clears message bus state, routes ingress, then flushes.
2. [`ingress.ts`](./ingress.ts) maps Cognito PostConfirmation trigger payload to synthetic `api.cognito` envelope.
3. [`dataSource/index.ts`](./dataSource/index.ts) consumes `api.cognito` envelopes and calls `streamEvent(...)`.
4. `streamEvent` publishes to EventBridge via `CognitoEventSerializer` using source `mtw.cognito` and detail-type `New Player`.

## Configuration

- `EVENT_BUS_NAME`: EventBridge bus target for `streamEvent`.
- `FEEDBACK_TOPIC`: present for DataSource configuration parity (non-replayable source).

## Verification

- `npm --prefix "lambda/cognitoEvent" run test`
