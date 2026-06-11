import { UserPublic } from './models';

export interface AuthResponse {
  token: string;
  user: UserPublic;
}

export interface AuthResponseWithRefresh extends AuthResponse {
  refreshToken: string;
}

export interface DecodedToken {
  userId: string;
  role: 'admin' | 'worker';
  iat: number;
  exp: number;
}
