### Manual deployment for development

If you want to tweak the software behind Make The World, make it your own, maybe do better than us ... have at!  Sounds great.  You'll want to clone this
respository locally (whatever that looks like in your development environment), and then get a development instance up and running to play around with.

Install the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) and use it to package,
deploy, and describe your application.  These are the commands you'll need to use:

Because of a problem with the SAM CLI and symlinks ([see here](./README.symlinks.md)), you will need to take the following steps to
generate your code (do each of these steps once when you start out, in this order):
    - At the top level directory: `npm run build` to create bundled distributions of all the shared packages
    - In each of the Lambda directories **except** cognitoEvent and initialize: `npm run build:dev` to generate a bundled lambda (including
    the bundles for the packages) that SAM can use to deploy.
    - In the `charcoal-client` directory, run `npm run build` to create the bundled version of the web-client that your Cloudformation deploy (below)
    will use to instantiate your site

Now deploy the running application stack.  Because of the nature of SAM, that's going to involve making yourself an S3 bucket to store code and
templates (so CloudFormation can get to them easily).  Make that S3 bucket in the console, then, in the top level of your cloned code-base, use
the following commands:

```
sam build

sam deploy \
    --template-file packaged.yaml \
    --stack-name (your desired stack name) \
    --s3-bucket <Your bucket name here> \
    --capabilities CAPABILITY_IAM
```

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