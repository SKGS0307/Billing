declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      name: string;
      mustChangePassword: boolean;
      roles: string[];
      permissions: string[];
      sessionId: string;
    }

    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
