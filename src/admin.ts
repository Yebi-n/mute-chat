export type AdminPermission =
  | 'room.delete:any'
  | 'room.moderate:any'
  | 'member.suspend:any'
  | 'report.review:any';

export type SystemAdmin = {
  id: string;
  displayName: string;
  role: 'super_admin';
  permissions: readonly AdminPermission[];
};

const SUPER_ADMIN_PERMISSIONS = [
  'room.delete:any',
  'room.moderate:any',
  'member.suspend:any',
  'report.review:any',
] as const satisfies readonly AdminPermission[];

// Development seeds only. Production authorization uses server-issued claims.
export const SYSTEM_ADMINS: readonly SystemAdmin[] = [
  { id: 'admin-alpha', displayName: 'Mute Admin Alpha', role: 'super_admin', permissions: SUPER_ADMIN_PERMISSIONS },
  { id: 'admin-bravo', displayName: 'Mute Admin Bravo', role: 'super_admin', permissions: SUPER_ADMIN_PERMISSIONS },
  { id: 'admin-charlie', displayName: 'Mute Admin Charlie', role: 'super_admin', permissions: SUPER_ADMIN_PERMISSIONS },
];

export const canDeleteRoom = (admin: SystemAdmin | undefined) =>
  admin?.permissions.includes('room.delete:any') ?? false;
