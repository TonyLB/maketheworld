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

First, [create an account](createAccount.md).  This will require an email account and a credit card. AWS is pay-as-you-go, and a MTW installation
will generally cost a few dollars a month to run, if that. Like, under $5 USD/month unless you have many, many people.  Make sure you are selecting "Free Tier"
wherever possible, and avoid any choices (particularly Support Plan) that would add costs.  You just want to pay for some computer power, not buy all their
digital bric-a-brac.

It can look like you’re all set when you still have two steps left: when you have the choice between Root and IAM (Identity and Access Management}, choose Root,
and click the big orange button at the top right that says “Sign in to the Console”

##### 2/5: Create a Budget

Next thing:  You just gave your credit card information to a system that bills you as you go, and creates resources to bill you for in ways that can be
opaque.  It's very important that you put some common-sense limits on that, first thing, so let's assign a budget to set the maximum that AWS will bill
you in a month ... after which it will just cut you off.  It's unlikely you'll ever get there, but safety first:

[Make an AWS Budget](budget/budget.md)

At the end of those two steps, you should have one account that you still log in to with its root credentials.  You'll need that, long-term, in order to check
out the Budget, but those credentials can do *anything*.  Using it is like walking around with in an ADMIN account in a MUSH; avoid it unless you need those
powers specifially. You want to log in that way very, very seldom.

##### 3/5: Create an IAM Role

AWS provides a tool called *IAM* (Identity and Access Management) that lets you create a user that is still provisioned to do *almost* anything but is importantly
firewalled away from billing matters.  It's best not to login with higher-level authorization than you need, to avoid problems. Especially money problems.  Do that
next (the top part ... you don't need the second bit where they show you an alternate path to do the same thing):

[Make your first IAM user and Administrator Group](iamRole.md)

You have an AWS account now, so you can start the install process in earnest.  

##### 4/5: Deploy the system

Now that you have an AWS account you can start a Make The World instance in that account:

[Deploy Make The World](deploy/deploy.md)

#### 5/5: Build inside the system

Deploying the world should have provided you with a web-address for your server (if not, click in the "Published Applications" section of Serverless Application
Repository, select your MTW app, and it will be in the properties there).  Go there. You will be able to log in as a new user. Then you can go through the guest
tutorial, get access to the build tools, and get to work!