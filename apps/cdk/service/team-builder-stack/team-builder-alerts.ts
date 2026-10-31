import { Duration } from "aws-cdk-lib";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { LambdaAlerts } from "../../models/stack";

export interface TeamBuilderAlertsProps {
    appName: string;
    deploymentType: string;
    email: string;
}

/**
 * Where scheduled Lambdas report failure: their error alarms email the owner
 * through one topic per stage, and an event that fails every async retry is
 * kept in a queue for 14 days rather than emailed (a cron failing every 15
 * minutes would otherwise send dozens of raw-JSON emails a day).
 *
 * The email subscription stays pending until its confirmation link is
 * clicked, once per stage after the first deploy.
 */
export class TeamBuilderAlerts extends Construct implements LambdaAlerts {
    readonly topic: Topic;
    readonly failedEvents: Queue;

    constructor(scope: Construct, id: string, { appName, deploymentType, email }: TeamBuilderAlertsProps) {
        super(scope, id);

        this.topic = new Topic(this, "AlertsTopic", {
            topicName: `${appName}-${deploymentType}-alerts`,
            displayName: `NBA Central ${deploymentType} alerts`,
        });
        this.topic.addSubscription(new EmailSubscription(email));

        this.failedEvents = new Queue(this, "FailedEvents", {
            queueName: `${appName}-${deploymentType}-failed-events`,
            retentionPeriod: Duration.days(14),
        });
    }
}
