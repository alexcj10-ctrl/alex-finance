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

export type PlayerSignupInput = {
  firstName: string;
  lastName: string;
};

export type PlayerCreatedCredentials = {
  displayName: string;
  playerCode: string;
  pin: string;
};

export type AuthState =
  | { status: 'loading' }
  | { status: 'password-setup' }
  | {
      status: 'player-created';
      credentials: PlayerCreatedCredentials;
      connecting: boolean;
      identity?: AuthIdentity;
      message?: string;
    }
  | { status: 'anonymous'; message?: string }
  | { status: 'authenticated'; identity: AuthIdentity }
  | { status: 'configuration-error'; message: string };
