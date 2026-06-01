# modular-backend-lab

정책, 예외 케이스, 외부 연동이 여러 비즈니스 도메인에 누적되는 백엔드를 위한 모듈러 TypeScript
아키텍처 예제입니다. 각 비즈니스 흐름은 독립 모듈로 분리하고, 상태 변경이 중요한 영역은 이벤트
원장과 projection으로 기록합니다.

[English README](./README.en.md)

## 아키텍처 요약

중심 원칙은 명확합니다. 비즈니스 상태와 규칙은 domain/application core에 두고, HTTP, DB, queue, scheduler, telemetry는 바깥 adapter로 둡니다.

```txt
HTTP / Workers / Scheduler
        |
Application usecases
        |
Domain logic + ports
        |
Infrastructure adapters
```

- Hono = HTTP delivery adapter
- Auth = customerId에 붙는 credential/session module
- Authorization = actor role grant와 permission decision module
- Audit-log = actor/action/resource/result를 남기는 immutable audit record module
- Address-book = customerId에 붙는 reusable address module
- Support-ticket = 고객 문의 접수, 배정, 해결, 종료 workflow module
- Kysely = persistence adapter
- Scheduler/Worker = delivery/runtime adapter
- BullMQ/SQS = queue adapter
- Valkey = local Redis-compatible infrastructure
- OpenTelemetry = telemetry instrumentation boundary
- Grafana stack = local observability runtime
- Domain/Application = portable core
- Domain events = append-only business ledger
- Current state tables = read model projections
- Outbox events = integration publishing queue
- TypeScript compiler = first-line architecture guard

## 설계 기준

이 레포는 프레임워크 사용법보다 요구사항이 늘어날 때 변경 지점이 어디인지 드러나는 구조에 초점을
둡니다. 도메인 규칙, usecase orchestration(여러 도메인 흐름을 조합하는 계층), persistence(DB 저장),
delivery(HTTP/job/worker 진입점), external integration(PG, ERP, WMS 같은 외부 시스템 연결)을
분리합니다. 상태 변경은 이벤트 원장(append-only 기록), projection(조회용 현재 상태), outbox(외부
발행 큐), quality gate(반복 검증)로 운영합니다.

### 경계와 타입

- TypeScript strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`로 타입 피드백을
  먼저 받습니다.
- Zod는 HTTP/env/external payload 같은 boundary validation에만 사용합니다.
- 예상 가능한 비즈니스 실패는 exception이 아니라 `Result`로 반환합니다.
- dependency-cruiser와 `scripts/convention-scan.ts`가 framework/infra leakage, unsafe casts,
  strictness 약화를 검사합니다.

### TypeScript 안의 함수형 스타일

Domain 계층은 객체 상속 구조보다 순수 함수, 불변 상태 전이, discriminated union, exhaustive check,
`Result` 반환을 기본 스타일로 둡니다. 큰 batch나 상태 동기화처럼 처리 대상이 커질 수 있는 흐름은
필요할 때 `AsyncIterable`로 표현합니다. 별도 함수형 라이브러리를 도입하기보다 표준 TypeScript로
경계와 상태를 명시합니다.

### 상태 변경과 원장

- Domain 함수는 입력을 받아 새 상태와 domain event를 반환하고, IO는 수행하지 않습니다.
- 상태 변경은 `domain_events` append, current projection update, outbox write를 explicit
  UnitOfWork transaction 안에서 함께 처리합니다.
- 현재 상태 테이블은 조회와 idempotency를 위한 projection이며, `outbox_events`는 외부 발행을 위한
  queue입니다.
- `customer`, `auth`, `authorization`, `audit-log`, `address-book`, `order`, `payment`,
  `inventory`, `fulfillment`, `refund`, `settlement`, `promotion`, `returns`, `notification`,
  `support-ticket` 모듈은 append-only domain event stream을 기준으로 상태 변경 근거를 남깁니다.

### 성능을 의식한 경계

- Hono를 얇은 HTTP adapter로 두어 request handling과 coupling을 작게 유지합니다.
- Kysely를 사용해 heavy ORM abstraction 없이 명시적인 SQL 경계를 유지합니다.
- 큰 batch workload는 `AsyncIterable`로 streaming 처리하고, concurrency는 명시적으로 제한합니다.
- Outbox publisher는 외부 publish를 긴 DB transaction 안에서 수행하지 않도록 분리되어 있습니다.
- Prometheus/OpenTelemetry 구성을 포함해 latency, request count, runtime signal을 관찰할 수 있게
  했습니다.

### 디버깅 용이성

- 요청 검증, usecase orchestration, domain state transition, persistence adapter가 분리되어 문제
  위치를 HTTP 입력, 비즈니스 규칙, 저장소, 외부 연동 중 어디인지 좁히기 쉽습니다.
- 예상 가능한 실패는 `Result`와 discriminated union으로 반환되어 route response mapping과 테스트에서
  실패 종류를 명시적으로 확인할 수 있습니다.
- `domain_events`, projection, `outbox_events`가 분리되어 어떤 상태 변경이 발생했는지, 현재 조회
  상태가 무엇인지, 외부 발행이 어디까지 진행됐는지를 따로 추적할 수 있습니다.
- request id, structured logging, metrics, traces는 adapter/runtime 경계에 있어 운영 신호를 남기면서
  domain logic을 오염시키지 않습니다.

### 지속 가능성

- Domain, application, ports, infra, HTTP, jobs, workers를 분리해 모듈이 늘어나도 변경 범위를 좁게
  유지합니다.
- 모듈은 domain/application/ports를 중심으로 구성되어 HTTP, DB, queue adapter가 달라져도 core 재사용
  가능성을 유지합니다.
- `AGENTS.md`, `docs/`, `ai/skills/`가 사람과 AI가 따를 유지보수 규칙을 문서화합니다.
- Biome, dependency-cruiser, convention scanner, CI quality gate가 반복 가능한 검증 경로를 제공합니다.
- 의존성은 exact version과 lockfile로 고정하고, Node Active LTS 정책을 문서화했습니다.
- 테스트는 파일 수가 아니라 위험도와 관찰 가능한 동작 기준으로 추가합니다.

## 경계의 역할

Hono는 HTTP 요청/응답만 다루는 delivery adapter입니다. Hono Context는 application/domain
코드로 들어가지 않습니다.

Kysely는 typed SQL을 제공하지만 persistence adapter에만 머뭅니다. DB row는 domain model로 직접
쓰지 않고 mapper를 통해 명시적으로 변환합니다.

Queue backend는 port 뒤에 격리됩니다. Core processor는 BullMQ, SQS, Redis, Valkey를 직접 알지
않습니다.

OpenTelemetry와 Grafana stack은 runtime instrumentation 경계입니다. 순수 domain logic은 logging,
metrics, traces를 직접 수행하지 않습니다.

## Event Sourcing과 projection

고객 lifecycle, 인증 세션, 권한 부여, 감사 기록, 주소록, 주문, 결제, 재고, 배송, 환불, 정산, 쿠폰,
반품, 고객 문의처럼 식별자, 돈, 재고, 운영 근거와 연결되는 흐름은 append-only `domain_events`를
상태 변경의 원장으로 둡니다. `customers`, `auth_email_credentials`, `auth_sessions`,
`authorization_role_grants`, `audit_log_records`, `address_book_addresses`, `orders`, `payments`,
`inventory_items`, `fulfillments`, `refunds`, `settlements`, `coupons`, `coupon_redemptions`,
`return_requests`, `support_tickets` 같은 현재 상태 테이블은 API 응답, idempotency lookup, batch
scan을 위한 projection입니다.

`outbox_events`는 event store가 아닙니다. `domain_events`는 aggregate 상태와 감사/회계 근거를 위한
원장이고, `outbox_events`는 외부 시스템 발행 실패와 재시도를 다루는 integration queue입니다. 상태
전이 usecase는 짧은 transaction 안에서 domain event append, projection update, outbox write를 함께
처리합니다.

ERP나 회계 기능은 이 레포 안에 직접 넣지 않습니다. `settlement`는 결제, 환불, 배송 완료 이벤트를
모아 주문별 정산 준비 상태를 만드는 범용 모듈입니다. 회계 전표, 세금, 수수료, 지급, ERP 동기화처럼
회사마다 달라지는 규칙은 이 이벤트와 projection을 읽는 별도 adapter나 downstream system에서
다루는 편이 낫습니다.

## 요구사항이 확장되는 방식

비즈니스 백엔드는 보통 하나의 큰 기능보다 작은 정책, 예외 케이스, 외부 연동이 계속 추가되면서
복잡해집니다. 이 구조는 그런 변화가 들어왔을 때 기존 흐름을 넓게 흔들지 않고, 적절한 모듈과
계층에 변경을 배치하는 것을 목표로 합니다.

- 정책이 바뀌면 domain event와 상태 전이를 확장합니다. 예를 들어 반품 요청, RMA 발급, 입고, 검수는
  `returns`가 소유하고, 부분 환불이나 재입고 같은 후속 흐름은 해당 이벤트를 기준으로 연결합니다.
- 할인 정책이 늘어나면 `promotion`의 coupon policy와 redemption lifecycle로 분리합니다. 예를 들어
  최소 주문 금액, SKU eligibility, 사용 횟수 제한, checkout 실패 시 예약 해제는 order/payment 내부로
  흘려보내지 않고 coupon usecase가 담당합니다.
- 업무 절차가 늘어나면 orchestration을 추가합니다. 예를 들어 환불 전 관리자 승인, 배송 완료 후 자동
  정산, 재고 부족 시 보상 흐름은 여러 모듈을 직접 엮지 않고 usecase, job, outbox를 통해 연결합니다.
- 고객 주체가 필요하면 `customer`가 안정적인 `customerId`와 lifecycle을 소유합니다.
- 이메일/비밀번호 로그인이 필요하면 `auth`가 credential, password hash, session token lifecycle을
  소유합니다. 비밀번호 hash와 token 생성은 port 뒤에 두고, raw password나 raw token은 저장하지
  않습니다.
- 역할과 권한 판단이 필요하면 `authorization`이 actor별 role grant와 permission decision을 소유합니다.
  `auth`는 세션과 credential을, `authorization`은 "이 actor가 이 action을 수행할 수 있는가"를
  분리해서 다룹니다.
- 누가 어떤 운영 행위를 어떤 결과로 수행했는지 남겨야 하면 `audit-log`가 actor, action, resource,
  result, reason, metadata를 불변 기록으로 저장합니다. 허용/거부 판단은 `authorization`에 남기고,
  audit-log는 판단과 실행 결과의 기록만 담당합니다.
- 재사용 가능한 고객 주소가 필요하면 `address-book`이 주소 원본과 기본 주소 지정을 소유합니다.
  `fulfillment`는 배송 실행 시점의 snapshot address를 보관하고, address-book 자체를 직접 소유하지
  않습니다.
- 외부 시스템이 붙으면 port와 adapter를 추가합니다. PG, ERP, WMS, 배송사, 알림 시스템은 core에 직접
  들어오지 않고, 내부 event와 command를 외부 API에 맞게 변환하는 adapter로 둡니다.
- 알림이 필요하면 `notification`의 요청, 발송, 실패, 재시도 상태를 사용합니다. 실제 이메일/SMS/Slack
  provider는 sender port 뒤에 두고, 발송 결과만 projection과 event로 기록합니다.
- 고객 문의와 운영 처리가 필요하면 `support-ticket`이 접수, 담당자 배정, 고객 응답 대기, 해결, 종료
  lifecycle을 소유합니다. 주문, 반품, 환불은 참조 ID로만 연결하고 각 모듈 내부 구현을 직접 가져오지
  않습니다.
- 운영 화면이나 리포트가 필요하면 projection/read model을 추가합니다. 조회 요구 때문에 domain
  model을 바꾸지 않고, `domain_events`나 current table을 기준으로 필요한 읽기 모델을 구성합니다.
- 새로운 도메인이 생기면 독립 모듈로 붙입니다. loyalty, coupon, settlement 같은 기능은 같은 layer
  shape를 따르며, 기존 모듈과는 domain event, application port, outbox/job을 통해 연결합니다.

## 폴더 구조

```txt
src/shared      작은 공용 primitive
src/infra       config, DB, logging, telemetry, queue adapters
src/http        Hono app, middleware, delivery routes
src/modules     business modules
src/jobs        batch and outbox processors
src/workers     runtime entrypoints and scheduler adapters
docs            architecture and maintenance policy
ai/skills       operational playbooks for future AI agents
```

현재 비즈니스 모듈:

```txt
src/modules/order/       주문 lifecycle event stream과 결제 상태 projection
src/modules/customer/    고객 등록, 정지, 재활성화, 종료 lifecycle event stream
src/modules/auth/        이메일 credential, login, session 발급/검증/폐기 event stream
src/modules/authorization/ actor role grant, revoke, permission decision event stream
src/modules/audit-log/   actor action/resource/result immutable audit record event stream
src/modules/address-book/ 고객 주소 등록, 수정, 기본 주소 지정, 비활성화 event stream
src/modules/inventory/   SKU별 재고 이동 ledger, 예약, 해제, 확정, 만료 projection
src/modules/payment/     Toss Payments adapter 뒤의 결제 lifecycle event stream
src/modules/checkout/    주문 검증, 재고 예약, 결제 승인, 보상 흐름 orchestration
src/modules/fulfillment/ 출고, 운송장, 배송 상태 event stream과 projection
src/modules/refund/      환불 요청, 승인, PG 환불, 재입고, 완료 event stream
src/modules/settlement/  결제, 환불, 배송 이벤트에서 만든 주문별 정산 준비 상태 projection
src/modules/promotion/   쿠폰 할인 정책, quote, 예약, 확정, 해제 event stream
src/modules/returns/     반품 요청, RMA 발급, 입고, 검수 event stream
src/modules/notification/ 알림 요청, 발송 성공/실패, 재시도 추적 event stream
src/modules/support-ticket/ 고객 문의 접수, 배정, 해결, 종료 event stream
```

각 모듈은 같은 layer shape를 따릅니다.

```txt
  domain/
  application/
  ports/
  infra/
  http/
  tests/
```

각 layer의 역할은 다음처럼 나뉩니다.

- `domain/`: 순수 TypeScript 타입과 상태 전이 함수가 위치합니다. IO, framework, DB, logging 없이
  입력을 받아 새 상태와 domain event를 반환하는 쪽을 선호합니다.
- `application/`: usecase orchestration 계층입니다. repository, external provider, transaction
  port를 조합하고 예상 가능한 실패를 `Result`로 반환합니다.
- `ports/`: application이 필요로 하는 repository, UnitOfWork, external gateway interface를
  정의합니다.
- `infra/`: Kysely repository, mapper, external API adapter처럼 port의 concrete implementation을
  둡니다.
- `http/`: Hono/Zod 기반 delivery adapter입니다. 요청 검증, command 변환, response mapping만
  담당합니다.
- `tests/`: domain behavior, usecase orchestration, route contract, repository behavior를 risk
  기준으로 검증합니다.

트랜잭션 경계는 application usecase에서 명시적으로 잡습니다. Domain은 transaction을 알지 못하고,
Kysely transaction도 application 밖으로 새지 않습니다. domain event append, current projection
update, outbox write는 짧은 UnitOfWork transaction 안에서 함께 처리하며, 결제/배송사 API 같은 외부
호출은 DB transaction 밖에서 수행합니다.

## 기술 스택과 선택 이유

- Node.js 24 Active LTS: 이 레포의 기본 workload는 PostgreSQL, 결제대행사, 배송사, queue, observability처럼 IO 대기가 많은 API와 worker입니다. Node의 event loop 기반 non-blocking IO는 요청마다 OS thread를 오래 점유하지 않고 많은 동시 대기를 처리하기에 적합합니다. CPU-bound 작업은 queue/worker로 분리하고, 멀티코어 활용과 배포 확장은 stateless process를 수평 확장하는 전제로 둡니다.
- TypeScript ESM, strict mode: domain state, command, event, error를 discriminated union과 exhaustive check로 모델링해 boundary drift를 컴파일 단계에서 먼저 발견하기 위한 선택입니다.
- pnpm, exact dependency saves: lockfile과 exact version으로 재현 가능한 설치를 우선합니다.
- Hono, `@hono/node-server`: HTTP framework를 얇은 delivery adapter로 유지하기 위해 작은 API surface를 가진 라우터를 사용합니다.
- PostgreSQL, Kysely, `pg`: transaction, constraint, relational query가 필요한 비즈니스 상태를 PostgreSQL에 두고, Kysely로 SQL 경계를 명시하면서 DB row와 domain model을 분리합니다.
- Zod: HTTP/env/external webhook payload 같은 untrusted boundary에서만 validation과 narrowing을 수행합니다.
- Toss Payments adapter: PG 연동은 payment gateway port 뒤에 둬 core usecase가 provider SDK나 HTTP 세부사항을 알지 않게 합니다.
- Pino JSON logging: 운영 로그를 구조화된 JSON signal로 남기기 위한 선택입니다.
- OpenTelemetry, Prometheus, Grafana stack: application code와 domain logic 바깥에서 request/runtime signal을 관찰하기 위한 표준 instrumentation 경계입니다.
- BullMQ + Valkey, SQS 문서화: local 개발은 Redis-compatible queue로 재현하고, AWS-style 배포에서는 queue adapter를 SQS로 교체할 수 있게 core processor를 분리합니다.
- Vitest, Testcontainers: 순수 domain/usecase는 빠른 unit test로, repository와 migration은 실제 PostgreSQL 기반 integration test로 검증합니다.
- Biome, dependency-cruiser, custom convention scanner: formatting/lint, import direction, repo-specific architecture rule을 반복 가능한 quality gate로 묶습니다.

## 로컬 실행

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm dev
```

### 로컬 Kubernetes(kind)

로컬 Kubernetes baseline은 EKS로 가기 전 같은 배포 모델을 kind에서 검증하기 위한 구성입니다. API,
outbox worker, scheduler, migration job, Postgres, Valkey, Prometheus, Grafana, Tempo, Loki, Alloy,
kube-state-metrics를 Kubernetes 안에 띄웁니다.

필수 도구:

- Docker
- kind
- kubectl

baseline 시작:

```bash
scripts/k8s-local-up.sh
```

로컬 포트 열기:

```bash
scripts/k8s-local-port-forward.sh
```

접속 경로:

- API health: http://localhost:3000/healthz
- API readiness: http://localhost:3000/readyz
- Grafana: http://localhost:3001 (`admin` / `admin`)
- Prometheus: http://localhost:9090

kind cluster 삭제:

```bash
scripts/k8s-local-down.sh
```

manifest는 `deploy/k8s/local/`에 있습니다. `secrets.example.yaml`은 kind 전용 non-sensitive 기본값을
담고 있으며 local kustomization에서 바로 적용됩니다. Postgres와 Valkey는 재생성하기 쉬운 disposable
`emptyDir` volume을 사용합니다.

예시 요청:

```bash
curl -X POST http://localhost:3000/orders/order-1/pay

curl -X POST http://localhost:3000/customers \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"customer-register-1","email":"customer@example.com","displayName":"Kim"}'

curl -X POST http://localhost:3000/customers/customer-1/suspend \
  -H 'content-type: application/json' \
  -d '{"reason":"payment risk"}'

curl -X POST http://localhost:3000/customers/customer-1/reactivate

curl -X POST http://localhost:3000/customers/customer-1/close \
  -H 'content-type: application/json' \
  -d '{"reason":"customer requested closure"}'

curl -X POST http://localhost:3000/auth/email/register \
  -H 'content-type: application/json' \
  -d '{"customerId":"customer-1","idempotencyKey":"auth-register-1","email":"customer@example.com","password":"password-1"}'

curl -X POST http://localhost:3000/auth/email/login \
  -H 'content-type: application/json' \
  -d '{"email":"customer@example.com","password":"password-1"}'

curl -X POST http://localhost:3000/auth/sessions/verify \
  -H 'content-type: application/json' \
  -d '{"token":"session-token"}'

curl -X POST http://localhost:3000/auth/sessions/revoke \
  -H 'content-type: application/json' \
  -d '{"token":"session-token"}'

curl -X POST http://localhost:3000/authorization/role-grants \
  -H 'content-type: application/json' \
  -d '{"actorId":"agent-1","role":"SUPPORT_AGENT","idempotencyKey":"grant-role-1","grantedByActorId":"admin-1","grantReason":"support team member"}'

curl -X POST http://localhost:3000/authorization/check \
  -H 'content-type: application/json' \
  -d '{"actorId":"agent-1","permission":"support-ticket:assign","resource":{"type":"SUPPORT_TICKET","id":"ticket-1"}}'

curl -X POST http://localhost:3000/authorization/role-grants/grant-1/revoke \
  -H 'content-type: application/json' \
  -d '{"revokedByActorId":"admin-1","revokeReason":"team changed"}'

curl -X POST http://localhost:3000/audit-log/records \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"audit-1","actorId":"agent-1","action":"support-ticket.assign","resourceType":"SUPPORT_TICKET","resourceId":"ticket-1","result":"SUCCESS","reason":"assigned to support queue","requestId":"request-1","metadata":{"ticketId":"ticket-1","assigneeId":"agent-1"},"occurredAt":"2026-01-01T00:00:00.000Z"}'

curl -X POST http://localhost:3000/address-book/addresses \
  -H 'content-type: application/json' \
  -d '{"customerId":"customer-1","idempotencyKey":"address-add-1","purpose":"SHIPPING","makeDefault":true,"label":"Home","recipientName":"Kim","phone":"010-0000-0000","line1":"Seoul road 1","line2":null,"city":"Seoul","region":null,"postalCode":"12345","country":"KR"}'

curl -X POST http://localhost:3000/address-book/addresses/address-1/default

curl -X POST http://localhost:3000/address-book/addresses/address-1/disable \
  -H 'content-type: application/json' \
  -d '{"reason":"customer requested removal"}'

curl -X POST http://localhost:3000/payments/confirm \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","paymentKey":"test-payment-key","amount":10000,"currency":"KRW","idempotencyKey":"confirm-1"}'

curl -X POST http://localhost:3000/checkout/submit \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","sku":"sku-1","quantity":2,"paymentKey":"test-payment-key","amount":10000,"currency":"KRW","idempotencyKey":"checkout-1"}'

curl -X POST http://localhost:3000/fulfillments \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","idempotencyKey":"fulfillment-1","recipient":{"name":"Kim","phone":"010-0000-0000","line1":"Seoul","line2":null,"postalCode":"12345","country":"KR"},"package":{"weightGrams":500,"description":"T-shirt"}}'

curl -X POST http://localhost:3000/fulfillments/fulfillment-1/pack

curl -X POST http://localhost:3000/fulfillments/fulfillment-1/label \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"label-1"}'

curl -X POST http://localhost:3000/refunds \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","paymentId":"payment-1","amount":10000,"currency":"KRW","reason":"customer request","returnRequired":true,"restock":{"sku":"sku-1","quantity":2},"idempotencyKey":"refund-1"}'

curl -X POST http://localhost:3000/refunds/refund-1/process

curl -X POST http://localhost:3000/returns \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","fulfillmentId":"fulfillment-1","idempotencyKey":"return-1","reason":"wrong size","items":[{"sku":"sku-1","quantity":1}]}'

curl -X POST http://localhost:3000/returns/return-1/authorize

curl -X POST http://localhost:3000/returns/return-1/receive

curl -X POST http://localhost:3000/returns/return-1/inspect \
  -H 'content-type: application/json' \
  -d '{"accepted":true,"restockableItems":[{"sku":"sku-1","quantity":1}],"note":"restockable"}'

curl -X POST http://localhost:3000/notifications \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"notify-1","channel":"EMAIL","recipient":"customer@example.com","templateKey":"return.authorized","payload":{"orderId":"order-1","rmaNumber":"RMA-1"}}'

curl -X POST http://localhost:3000/notifications/notification-1/send

curl -X POST http://localhost:3000/support/tickets \
  -H 'content-type: application/json' \
  -d '{"customerId":"customer-1","idempotencyKey":"ticket-1","category":"ORDER","priority":"NORMAL","subject":"Order address change","description":"Customer wants to change the shipping address","orderId":"order-1"}'

curl -X POST http://localhost:3000/support/tickets/ticket-1/assign \
  -H 'content-type: application/json' \
  -d '{"assigneeId":"agent-1"}'

curl -X POST http://localhost:3000/support/tickets/ticket-1/waiting-customer

curl -X POST http://localhost:3000/support/tickets/ticket-1/resolve \
  -H 'content-type: application/json' \
  -d '{"resolution":"Customer confirmed the new address"}'

curl -X POST http://localhost:3000/support/tickets/ticket-1/close

curl -X POST http://localhost:3000/promotions/coupons \
  -H 'content-type: application/json' \
  -d '{"code":"save-3000","discount":{"type":"FIXED_AMOUNT","amount":{"amount":3000,"currency":"KRW"}},"minOrderAmount":{"amount":5000,"currency":"KRW"},"eligibleSkus":["sku-1"],"maxRedemptions":100,"startsAt":"2026-01-01T00:00:00.000Z","expiresAt":"2026-12-31T00:00:00.000Z"}'

curl -X POST http://localhost:3000/promotions/coupons/quote \
  -H 'content-type: application/json' \
  -d '{"code":"save-3000","orderId":"order-1","orderAmount":{"amount":10000,"currency":"KRW"},"skus":["sku-1"]}'

curl -X POST http://localhost:3000/promotions/coupons/reserve \
  -H 'content-type: application/json' \
  -d '{"code":"save-3000","orderId":"order-1","orderAmount":{"amount":10000,"currency":"KRW"},"skus":["sku-1"],"idempotencyKey":"coupon-reserve-1"}'

curl -X POST http://localhost:3000/settlements/sync \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1"}'

curl http://localhost:3000/settlements/order-1
```

Outbox job 실행:

```bash
pnpm worker:outbox
```

Inventory reservation expiration job 실행:

```bash
pnpm worker:inventory-expire
```

Fulfillment status sync job 실행:

```bash
pnpm worker:fulfillment-sync
```

정산 동기화 job 실행:

```bash
pnpm worker:settlement-sync
```

장기 실행 local runtime adapter:

```bash
pnpm dev:outbox-worker
pnpm dev:scheduler
```

## 관측성

```bash
pnpm observability:up
```

- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200
- Loki: http://localhost:3100

서비스는 `/metrics`에서 Prometheus metrics를 노출하고, OTLP traces/metrics를
`OTEL_EXPORTER_OTLP_ENDPOINT`로 export할 수 있습니다.

로컬 Kubernetes에서는 Prometheus가 API service의 `/metrics`를 scrape하고, Tempo가 runtime pod의 OTLP
HTTP trace export를 받으며, kube-state-metrics가 API/worker/scheduler/observability pod와 deployment
상태를 Grafana에서 볼 수 있게 합니다. Loki는 Grafana datasource로 배포되지만, 이번 baseline에서
application log shipping collector를 새로 추가하지는 않습니다. Pino log는 이후 log collector가 수집할
수 있도록 JSON 형태를 유지합니다.

## EKS 고려사항

이번 범위는 로컬 Kubernetes baseline입니다. Terraform, EKS cluster resource, VPC, ALB, RDS, SQS, IRSA,
Secrets Manager 생성은 포함하지 않습니다.

EKS로 갈 때도 adapter 경계는 유지합니다.

- in-cluster Postgres는 `DATABASE_URL`을 통해 RDS로 교체합니다.
- local BullMQ/Valkey는 기존 queue/event publisher port 뒤의 SQS adapter로 교체합니다.
- local Kubernetes Secret은 Secrets Manager 또는 별도 secret delivery 방식으로 교체합니다.
- ingress는 ALB 또는 Kubernetes ingress controller 뒤에 둡니다.
- OpenTelemetry, Prometheus, Grafana, Loki, Tempo는 domain/application 밖의 runtime/observability
  concern으로 유지합니다.

## 환경 변수

모든 변수는 `.env.example`을 참고하세요. 환경 변수 직접 접근은 `src/infra/config/env.ts`에서만
허용됩니다. `TOSS_PAYMENTS_SECRET_KEY`가 없으면 서버는 뜨지만 payment gateway는 명시적인
`PAYMENT_GATEWAY_NOT_CONFIGURED` 실패를 반환합니다.

## 명령어

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
pnpm quality
```

개발 서버:

```bash
pnpm dev
pnpm dev:worker
pnpm dev:outbox-worker
pnpm dev:scheduler
```

DB migration:

```bash
pnpm db:migrate
pnpm db:rollback
```

모듈 폴더 스캐폴드:

```bash
pnpm scaffold:module promotion
```

이 명령은 표준 layer 폴더와 빈 `index.ts`만 만듭니다. 도메인 모델, usecase, repository, route는
요구사항을 읽고 직접 설계해야 합니다.

## 테스트 전략

테스트는 risk-based, behavior-first입니다. 함수가 있다는 이유만으로 테스트하지 않습니다.

이 레포는 domain behavior tests, usecase orchestration tests, Hono route contract tests, outbox job
tests, Docker-backed PostgreSQL integration tests를 포함합니다.

Docker가 없으면 integration test는 실행 가능한 상태로 남기고 명시적으로 gate됩니다.

## 확장 정책

새 모듈은 기존 layer shape를 따라 추가합니다. 다른 모듈의 `infra` 또는 `http` layer를 직접
공유하지 않습니다.

Core logic은 usecase, port, domain event를 통해 협력합니다.

반복을 줄이는 보조 도구는 경계 밖에 둡니다. `pnpm scaffold:module <name>`은 폴더 시작점을 만들
뿐이고, route 테스트는 `test/http/create-test-app.ts`로 검증 대상 usecase만 주입합니다. Outbox row
insert 변환은 `src/infra/outbox/outbox-event.mapper.ts`를 공유하지만, domain event 정의와 저장
시점은 각 모듈의 domain/application/infra 흐름에 남깁니다.

큰 batch workload는 `AsyncIterable`을 사용합니다. 일반적인 bounded HTTP read는 `Promise<T>` 또는
`Promise<T[]>`를 사용합니다.

## AI 유지보수 정책

`AGENTS.md`가 source of truth입니다. 미래의 agent는 먼저 `AGENTS.md`를 읽고, 관련 `docs/` 문서와
`ai/skills/*.md` playbook을 확인해야 합니다.

현재 제공되는 skill:

- `add-domain-module`
- `add-usecase`
- `add-http-route`
- `add-repository`
- `add-batch-job`
- `add-queue-adapter`
- `add-observability-signal`
- `refactor-with-boundaries`
- `run-quality-gates`
- `enforce-type-safety`

## Convention Harness

```txt
AGENTS.md                  intent and non-negotiable rules
ai/skills/*.md             repeatable AI workflows
Biome                      formatting and linting
dependency-cruiser         import boundaries
scripts/convention-scan.ts repository-specific drift checks
docs/17-definition-of-done completion standard
CI                         quality gates
```

Biome는 style을 잡고, dependency-cruiser는 import direction을 잡고, `convention-scan`은 이
레포만의 architecture/type-safety drift를 잡습니다.

## Definition of Done

의미 있는 변경은 다음이 만족되어야 완료입니다.

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
```

그리고 TypeScript strictness, architecture boundaries, risk-based tests, documentation updates가
유지되어야 합니다.
