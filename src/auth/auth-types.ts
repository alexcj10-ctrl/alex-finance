import type { AppRole } from '../types/database';

export type AuthIdentity = {
  userId: string;
  displayName: string;
  role: AppRole;
  teamId: string;
  teamName: string;
  season: string;
};

export type LoginCredentials = {
  identifier: string;
  password: string;
};

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; message?: string }
  | { status: 'authenticated'; identity: AuthIdentity }
  | { status: 'configuration-error'; message: string };
