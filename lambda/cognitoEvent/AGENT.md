# Cognito event lambda

## Purpose

This lambda handles Cognito User Pool triggers and publishes signup events into the event mesh.

## Trigger boundaries

- **PreSignUp (`PreSignUp_SignUp`)**: handled directly in [`app.ts`](./app.ts) by mutating `event.response.autoConfirmUser = true` and returning the Cognito event.
- **PostConfirmation (`PostConfirmation_ConfirmSignUp`)**: normalized through local ingress/DataSource flow and published as `mtw.cognito` / `New Player` with payload `{ player }`.
- **Admin signup fallback (`connections` `/signUp`)**: [`lambda/connections/createUser/index.ts`](../connections/createUser/index.ts) explicitly publishes the same `mtw.cognito` / `New Player` event after successful `AdminCreateUser` + `AdminSetUserPassword`, so player heal does not depend on Cognito PostConfirmation contract for admin-created users.

**Heal entry is publish-only.** Signup publish paths do not start the heal Step Function or invoke any other lambda directly. Downstream player heal happens in `AssetsFunction` via the `mtw.cognito` EventBridge subscription (idempotent, see [`../assets/AGENT.event.md`](../assets/AGENT.event.md)). `CognitoHandlerFunction` is the only lambda attached to User Pool triggers in the SAM template, and the `connections` admin-signup flow provides an explicit parity publish for admin-created users.

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
