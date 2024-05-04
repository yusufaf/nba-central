import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ExtendedStackProps } from "../../models/stack";
import { TeamBuilder } from "./team-builder";

export class TeamBuilderStack extends Stack {
    constructor(scope: Construct, id: string, props: ExtendedStackProps) {
        super(scope, id, props);

        const { appName, deploymentType } = props;

        new TeamBuilder(this, `${appName}-${deploymentType}`, props);
    }
}
