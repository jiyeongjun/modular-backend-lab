export type TransactionRunner<TRepos> = {
  withTransaction<T>(work: (repos: TRepos) => Promise<T>): Promise<T>;
};
