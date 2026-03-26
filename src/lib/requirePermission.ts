import type { IUser } from "@/models/User";
import { getPlatformSettings } from "@/lib/platform-settings-service";
import { getRolePermissions } from "@/lib/role-permissions";
import type { AppRole } from "@/lib/app-role-scope-matrix";
import type { PermissionKey } from "@/constants/permissions";

type RolePermissionOverrides = Partial<Record<AppRole, PermissionKey[]>>;

export const resolveUserPermissions = async (user: IUser): Promise<Set<string>> => {
  const settings = await getPlatformSettings();
  const roleOverrides = (settings.rolePermissions || {}) as RolePermissionOverrides;
  const rolePerms = getRolePermissions(String(user.role || ""), roleOverrides);
  const ownPerms = Array.isArray((user as IUser).permissions) ? (user.permissions as string[]) : [];
  return new Set<string>([...rolePerms, ...ownPerms]);
};

export const requirePermission = async (
  user: IUser,
  permission: PermissionKey | string
): Promise<boolean> => {
  const perms = await resolveUserPermissions(user);
  return perms.has(String(permission));
};

