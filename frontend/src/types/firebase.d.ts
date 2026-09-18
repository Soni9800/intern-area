declare module "firebase/app" {
  export function initializeApp(config: Record<string, unknown>): unknown;
}

declare module "firebase/auth" {
  export type User = {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    phoneNumber?: string | null;
  };

  export interface Auth {
    currentUser: User | null;
    onAuthStateChanged(callback: (user: User | null) => void): void;
  }

  export class GoogleAuthProvider {
    setCustomParameters(params: Record<string, string>): void;
    addScope(scope: string): void;
  }

  export function getAuth(app: unknown): Auth;
  export function signInWithPopup(auth: Auth, provider: GoogleAuthProvider): Promise<{ user: User }>;
  export function signOut(auth: Auth): Promise<void>;
}
