import { App, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ExtendedStackProps extends StackProps {
    appName?: string;
    deploymentType?: string;
    // Production-only wiring (Route 53 + cross-region ACM certs). Undefined
    // in every non-production deploymentType — consumers must gate on
    // deploymentType === "production" before relying on these being set.
    hostedZoneId?: string;
    hostedZoneName?: string;
    webCertificateArn?: string;
    authCertificateArn?: string;
}

export interface StackConstructsProps {
    scope: App;
    id: string;
    props: ExtendedStackProps;
    construct: Construct
}

export type LambdaProps = {
    construct: Construct
    props: ExtendedStackProps,
}