### Manual deployment for development

If you want to tweak the software behind Make The World, make it your own, maybe do better than us ... have at!  Sounds great.  You'll want to clone this
respository locally (whatever that looks like in your development environment), and then get a development instance up and running to play around with.

Install the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) and use it to package,
deploy, and describe your application.  These are the commands you'll need to use:

To generate the build artifacts needed for deployment, run the following steps (do each once when you start out, in this order):

1. **Build all Lambda functions**: In each of the 17 Lambda directories, run `npm run build:dev` to generate bundled lambda code with sourcemaps. All lambdas use ESBuild to bundle directly from TypeScript source, including references to the shared packages in `packages/`.

   Lambda directories to build:
   - `lambda/assets/`
   - `lambda/authentication/`
   - `lambda/availableCharacters/`
   - `lambda/chaos/`
   - `lambda/cognitoEvent/`
   - `lambda/connections/`
   - `lambda/dbStream/`
   - `lambda/deliverMessageSync/`
   - `lambda/diagnostics/`
   - `lambda/ephemera/`
   - `lambda/feedback/`
   - `lambda/imageProcessor/`
   - `lambda/initialize/`
   - `lambda/llm/`
   - `lambda/subscriptions/`
   - `lambda/updateEphemera/`
   - `lambda/wml/`

2. **Build the frontend client**: In the `charcoal-client` directory, run `npm run build` to create the production build of the React client. This build becomes a Lambda Layer used by the `initialize` function to deploy the client to S3.

**Note**: You do NOT need to build the shared packages in `packages/` separately. ESBuild bundles everything directly from TypeScript source when building each lambda.

Now deploy the running application stack.  Because of the nature of SAM, that's going to involve making yourself an S3 bucket to store code and
templates (so CloudFormation can get to them easily).  Make that S3 bucket in the console, then, in the top level of your cloned code-base, use
the following commands:

```
sam build

sam deploy \
    --template-file packaged.yaml \
    --stack-name <your desired stack name> \
    --s3-bucket <your bucket name here> \
    --parameter-overrides TablePrefix=<your table prefix here>
```

**Note**: The `samconfig.toml` file already configures the necessary IAM capabilities, so you don't need to specify `--capabilities` on the command line. The `TablePrefix` parameter is required and will be used as the prefix for all DynamoDB tables and S3 buckets (e.g., `mtw` creates `mtw_assets`, `mtw_ephemera`, etc.).

After you deploy, the `{TablePrefix}-client` bucket is only refreshed when the **initialize** Lambda runs (it uploads the built client from its layer and writes `config.json`, including Cognito, WebSocket, and anonymous API URIs). Send an EventBridge event on your stack event bus with `source` `mtw.diagnostics` and `detail-type` `Initialize` so that Lambda runs and updates the bucket; then CloudFront will serve a client that can load configuration without manual edits to `config.json`.

#### Deploying the local front end

Finally, you'll have to dig down into the *charcoal-client* directory, and read its README.md as well.  There are some
steps that need to be taken there, in order to inform the local client about the cloudformation resources you have created, before
it can be started against the back-end.

### Removing all MakeTheWorld resources

You've tinkered around, and decided this isn't something you want to keep maintaining long-term?  No problem.  It's pretty easy to remove from
the AWS console.

IMPORTANT NOTE:  This process will delete all of your MTW cloud resources.  If you intend to keep the content of your instance, you need to have
copied files from your `mtw-assets` bucket locally first.

Go to CloudFormaton:  There is a stack there that you instantiated.  Click to select the stack, and then delete it. That will remove all your
development resources.

That's it:  Make The World should be removed completely from your AWS account.