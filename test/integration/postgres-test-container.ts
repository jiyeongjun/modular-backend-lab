import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

export async function startPostgresTestContainer(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer("postgres:16.9-alpine")
    .withDatabase("modular_backend_lab_test")
    .withUsername("app")
    .withPassword("app")
    .start();
}
