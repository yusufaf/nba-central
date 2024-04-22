import { Role } from "aws-cdk-lib/aws-iam";

const roles: Map<string, Role> = new Map();

export const addRole = (roleName: string, role: Role, update: boolean = false) => {
    if (!update && roles.has(roleName)) {
        throw "Role already in the lookup"
    }
    roles.set(roleName, role);
}

export const getRole = (roleName: string): Role => {
    if (!roles.has(roleName)) {
        throw "Role not in the lookup"
    }
    return roles.get(roleName)!;
}