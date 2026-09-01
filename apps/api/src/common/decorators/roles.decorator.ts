import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/** Roles allowed to access a route. Checked against req.membershipRole,
 * which is attached by WorkspaceMemberGuard/BoardMemberGuard — those guards
 * must run before RolesGuard. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
