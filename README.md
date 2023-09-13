Make The World
==============

Make The World is a platform for creating worlds and telling stories together.  Make The World is cloud-native, residing in AWS and accessible through
any web-browser (okay, *most* web-browsers, ain't nobody got time to keep supporting old version of Internet Explorer).

Make The World is very much a work in progress:  Version 1 provided the minimal features to establish communications between players.
Version 2 elaborates on that with World Markup Language, a syntax for defining shared worlds and their behaviors.

### What Make The World included in V1

- Globally available web-based chat client
- Industry-grade (AWS Cognito) login security to keep your access safe and private
- Characters you can create and customize as you desire
- Rooms you invent, to set the scene and group which characters are chatting with which
- Exits between Rooms to create the imaginary geography

### What is already tested in V2

- Far more scalable architecture, keeping costs low and responsiveness high for anything from
zero users to hunreds.
- Expressive World Markup Language allows creation of content in layers:  Define the town square as
everyone sees it, then add little details for people in the thieve's guild, and other little details
for people on a scavenger-hunt quest.
- Sandboxed programming tools let you write complicated functionality for riddles, quests, or just
a really intricate Rube-Goldberg machine.
- Multi-stage data lake stores active content closer to the players, and archives inactive content to
cheaper storage

### What is coming in V2

- Workshopping new contributions: Let others give feedback on your draft, and refine it based on
their suggestions, on the way to public inclusion
- More robust moderation tools, to deal with potential bad actors (spammers, trolls, etc.)
- In-game Objects you can pick up, drop, use, manipulate, give and receive.
- Asynchronous messaging, to leave folks in-game notes even when they're not present
- Scene requests, to tell people what you'd like to play and what kind of people would help you do it
- Story authoring tools to create automated quests, riddles and events that people can opt into
- Story instancing, so different groups can have their own versions of the same story, and work
through them imdependently

How does Make The World work (tech stack)
=========================================

Okay, technical talk here, feel free to glaze over and move to the next section ... or perk your ears up, if this is your jam.

Make The World is a serverless build on the Amazon Web Services platform.  When someone creates an instance, the Serverless Application
Repository instantiates a CloudFormation stack in their account (independent of any other Make-The-World resources anywhere else in
the world), and CloudFormation then creates all the structures needed to support their game instance.

### CloudFormation resources

CloudFormation is the AWS solution for *Infrastructure as Code*, which means basically "I write some code *describing* what a set of cloud
resources to look like, then CloudFormation *creates* those resources when I ask it to."  Make The World uses two distinct templates, to
create two *Stacks* (CloudFormation's way of grouping a set of resources created together).

#### template.yaml

This describes the infrastructure requirements of the pieces of Make The World that actually make it run.  This file creates the main stack,
which has just a *ton* of stuff.  A small sampling:
- DynamoDB tables for *ephemera* and *messages*
- Several Lambda function (the AWS solution for running code in the cloud) that act as glue to make sure that data is consistent
- A real-time API for connection to the client, so that the system can know quickly when somebody closes their tab (no more of that tedious
problem of people losing their connection but not formally logging out)

### The system in operation

So, suppose you've run the install, and it worked out fine (fingers crossed!)  You noticed that the only server (even virtual) that gets instantiated
by the system also gets *decommissioned* at the end of the install process.  If you (like me) came up in the programming era of the 90s and 00s, you
can knock around the AWS system all you want (I'd recommend starting in the EC2 area) trying to answer the immediate question "Where is my server?  Where
is Make The World *running*?"

It's not there.  Don't panic.  That's not how serverless systems work.  Make The World creates computing resources in response to events.  If nobody is
on your system, then the system is nothing but inert storage and a web-site.  When someone logs in to the web-site ... well then, things get going:  Each
time a user does something that requires changes to the system, AWS apportions a tiny fraction of a virtual server's time, loads the needed code from
a high-speed cache in a miniscule fraction of a second, does what needs to be done and then takes the resources back.

At its best (which we aspire to), serverless architecture means that the compute resources just *work*, the way you can plug a television into the wall
and just get electricity: CPU cycles, hot and cold, on tap from AWS's incalculably robust supply.  Likewise, all of the data resources are stored
in AWS serverless solutions ... they respond to requests, but you don't have to think of them as actually *residing* anywhere.  There is no server
that can get struck by lightning, or upgraded wrong by your service company.  What there is instead is a world-spanning *network* of servers, supporting
a pretty hefty chunk of our information economy ... and we get to peel off penny-sized increments of that power for our own purposes.

Some days I really enjoy living in the future.

How to deploy my own Make The World
===================================

Ready to take the plunge?  Okay, we'll make this as easy for you as possible.  Be ready to spend a few hours on this process.

#### Setting up an AWS account

Make The World operates within AWS, so to install it you're going to need *access* to AWS.  Now AWS is intimidating as *heck* ... it has well over a hundred
menu options.  You only have to deal with a few of them though, and everyone before you has had to do the same thing so it's pretty well documented.
You will need: an email account and a credit card, and the steps below will walk you through making an AWS account and a Github account. If you have those
already, great, use them.

As you go through these steps, you may end up somewhere in the AWS console that you didn't expect.  Here is a set of short-cuts back to the top level of the
places you'll need to be.  If you get lost, you can probably come back here and click to just the area you want to pay attention to.  NOTE:  Do not start clicking here!
This is a resource to *come back to* if you need to ... skip forward to "Create an Account" if you haven't already:

[Billing](https://console.aws.amazon.com/billing/)

[Identity and Access Management](https://console.aws.amazon.com/iam/)

[Cloudformation Resource Management](https://console.aws.amazon.com/cloudformation/)

AWS is a system with a *very large number* of different panels and console, most which you will never, never need to get access to.  But clicking on
a link that looks promising can sometimes get you somewhere you didn't expect to be.  So if you get lost, the links above are your chance to reorient:
Find the section you need to be working on, click its link above, and back up in the instructions to figure out how to get from the landing area of that
console to the place you need to be at your given step.

Ready?  Cool, head over to AWS (first) and work through these steps

##### 1/5: Create an account

First, [create an account](documentation/createAccount.md).  This will require an email account and a credit card. AWS is pay-as-you-go, and a MTW installation
will generally cost a few dollars a month to run, if that. Like, under $5 USD/month unless you have many, many people.  Make sure you are selecting "Free Tier"
wherever possible, and avoid any choices (particularly Support Plan) that would add costs.  You just want to pay for some computer power, not buy all their
digital bric-a-brac.

It can look like you’re all set when you still have two steps left: when you have the choice between Root and IAM (Identity and Access Management}, choose Root,
and click the big orange button at the top right that says “Sign in to the Console”

##### 2/5: Create a Budget

Next thing:  You just gave your credit card information to a system that bills you as you go, and creates resources to bill you for in ways that can be
opaque.  It's very important that you put some common-sense limits on that, first thing, so let's assign a budget to set the maximum that AWS will bill
you in a month ... after which it will just cut you off.  It's unlikely you'll ever get there, but safety first:

[Make an AWS Budget](documentation/budget/budget.md)

At the end of those two steps, you should have one account that you still log in to with its root credentials.  You'll need that, long-term, in order to check
out the Budget, but those credentials can do *anything*.  Using it is like walking around with in an ADMIN account in a MUSH; avoid it unless you need those
powers specifially. You want to log in that way very, very seldom.

##### 3/5: Create an IAM Role

AWS provides a tool called *IAM* (Identity and Access Management) that lets you create a user that is still provisioned to do *almost* anything but is importantly
firewalled away from billing matters.  It's best not to login with higher-level authorization than you need, to avoid problems. Especially money problems.  Do that
next (the top part ... you don't need the second bit where they show you an alternate path to do the same thing):

[Make your first IAM user and Administrator Group](documentation/iamRole.md)

You have an AWS account now, so you can start the install process in earnest.  

##### 4/5: Deploy the system

Now that you have an AWS account you can start a Make The World instance in that account:

[Deploy Make The World](documentation/deploy/deploy.md)

#### 5/5: Build inside the system

Deploying the world should have provided you with a web-address for your server (if not, click in the "Published Applications" section of Serverless Application
Repository, select your MTW app, and it will be in the properties there).  Go there. You will be able to log in as a new user. Then you can go through the guest
tutorial, get access to the build tools, and get to work!

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


## License Summary

This code is made available under a modified MIT license. See the LICENSE file.
