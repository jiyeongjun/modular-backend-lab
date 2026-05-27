export type IssueAuthTokenInput = Readonly<{
  sessionId: string;
  customerId: string;
  credentialId: string;
  issuedAt: Date;
  expiresAt: Date;
}>;

export type IssuedAuthToken = Readonly<{
  token: string;
  tokenHash: string;
}>;

export type AuthTokenService = {
  issue(input: IssueAuthTokenInput): Promise<IssuedAuthToken>;
  hash(token: string): Promise<string>;
};
