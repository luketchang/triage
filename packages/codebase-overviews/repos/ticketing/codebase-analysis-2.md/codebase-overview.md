# Comprehensive Codebase Walkthrough for the Ticketing Microservices System

---

## Table of Contents

- [1. System Overview](#1-system-overview)
- [2. Component Walkthroughs](#2-component-walkthroughs)
  - [2.1 Auth Service](#21-auth-service)
  - [2.2 Client Application](#22-client-application)
  - [2.3 Common Library](#23-common-library)
  - [2.4 Expiration Service](#24-expiration-service)
  - [2.5 Infrastructure (Kubernetes Manifests)](#25-infrastructure-kubernetes-manifests)
  - [2.6 NATS Test Module](#26-nats-test-module)
  - [2.7 Orders Service](#27-orders-service)
  - [2.8 Payments Service](#28-payments-service)
  - [2.9 Tickets Service](#29-tickets-service)
- [3. End-to-End System Operation Walkthrough](#3-end-to-end-system-operation-walkthrough)
  - [3.1 User Signup and Authentication Flow](#31-user-signup-and-authentication-flow)
  - [3.2 Ticket Creation and Publishing Flow](#32-ticket-creation-and-publishing-flow)
  - [3.3 Order Creation and Expiration Flow](#33-order-creation-and-expiration-flow)
  - [3.4 Payment Processing Flow](#34-payment-processing-flow)
  - [3.5 Order Cancellation and Ticket Release Flow](#35-order-cancellation-and-ticket-release-flow)
- [4. Summary](#4-summary)

---

## 1. System Overview

This ticketing platform is architected as a **microservices-based distributed system** designed to handle event ticket sales with high scalability, reliability, and observability. The system is composed of multiple independently deployable services, each responsible for a distinct domain:

- **Auth Service:** Manages user authentication and authorization.
- **Client Application:** Next.js-based frontend for user interaction.
- **Tickets Service:** Manages ticket creation, updates, and availability.
- **Orders Service:** Handles order lifecycle including creation, cancellation, and status updates.
- **Payments Service:** Processes payments via Stripe and manages payment records.
- **Expiration Service:** Manages order expiration using delayed job queues.
- **Common Library:** Shared utilities, error handling, event contracts, messaging abstractions, middleware, logging, and tracing.
- **Infrastructure:** Kubernetes manifests for deploying and managing the system on a cluster.
- **NATS Test Module:** A minimal example for NATS Streaming event publishing and listening.

The system uses **event-driven architecture** with **RabbitMQ** as the primary message broker (with some legacy or experimental NATS usage), **MongoDB** for persistence, **Redis** for delayed job queues, and **DataDog** for observability (tracing and logging). The services communicate asynchronously via events to maintain eventual consistency and decoupling.

---

## 2. Component Walkthroughs

### 2.1 Auth Service

#### Overview

The `auth` service is responsible for user identity management, including signup, signin, signout, and session management. It uses JWT tokens stored in cookies for stateless authentication and MongoDB for user data persistence.

#### Architecture & Key Responsibilities

- **Express.js** server exposing RESTful endpoints.
- **MongoDB** with Mongoose for user data.
- **JWT** for authentication tokens.
- **Password hashing** with scrypt and salts.
- **Middleware** for request validation, error handling, and current user extraction.
- **Datadog tracing** for observability.
- **Comprehensive testing** with mocks and in-memory DB.

#### Directory Structure

```plaintext
auth/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── __mocks__/tracing.ts
    ├── app.ts
    ├── index.ts
    ├── models/user.ts
    ├── routes/
    │   ├── __test__/
    │   │   ├── current-user.test.ts
    │   │   ├── signin.test.ts
    │   │   ├── signout.test.ts
    │   │   └── signup.test.ts
    │   ├── currentuser.ts
    │   ├── signin.ts
    │   ├── signout.ts
    │   └── signup.ts
    ├── test/
    │   ├── getAuthCookie.ts
    │   └── setup.ts
    ├── tracer.ts
    └── utils/password.ts
```

#### Key Files

- `app.ts`: Express app setup with middleware and route registration.
- `index.ts`: Service bootstrap, DB connection, and server start.
- `models/user.ts`: Mongoose schema with password hashing pre-save hook.
- `routes/*.ts`: REST API handlers for auth lifecycle.
- `utils/password.ts`: Password hashing and comparison utilities.
- `tracer.ts`: Datadog tracing initialization.

---

### 2.2 Client Application

#### Overview

The `client` directory contains a **Next.js** frontend application that provides the user interface for the ticketing platform. It supports server-side rendering, authentication flows, ticket browsing, order management, and payment integration.

#### Architecture & Key Responsibilities

- **Next.js** for SSR and routing.
- **React components** with hooks.
- **Axios client** abstraction for API calls.
- **Authentication state** management.
- **Stripe integration** for payments.
- **Bootstrap** for styling.

#### Directory Structure

```plaintext
client/
├── Dockerfile
├── package.json
├── next.config.js
├── api/build-client.js
├── components/header.js
├── hooks/use-request.js
└── pages/
    ├── _app.js
    ├── banana.js
    ├── index.js
    ├── auth/
    │   ├── signin.js
    │   ├── signout.js
    │   └── signup.js
    ├── orders/
    │   ├── [orderId].js
    │   └── index.js
    └── tickets/
        ├── [ticketId].js
        └── new.js
```

#### Key Files

- `api/build-client.js`: Axios client factory for SSR and client.
- `components/header.js`: Navigation bar with auth-aware links.
- `hooks/use-request.js`: Custom hook for HTTP requests with error handling.
- `pages/_app.js`: Global app wrapper fetching current user.
- `pages/auth/*`: Authentication pages.
- `pages/orders/*`: Order listing and detail with payment.
- `pages/tickets/*`: Ticket listing, creation, and detail.

---

### 2.3 Common Library

#### Overview

The `common` directory is a shared library used by all microservices. It provides:

- Custom error classes.
- Event interfaces and base classes for NATS.
- RabbitMQ messaging abstractions.
- Express middlewares for auth, validation, and error handling.
- Centralized logging with Winston.
- Datadog tracing setup.

This library enforces consistency and reduces duplication across services.

#### Directory Structure

```plaintext
common/
├── package.json
├── tsconfig.json
└── src/
    ├── errors/
    ├── events/
    ├── logger.ts
    ├── messaging/
    ├── middlewares/
    ├── tracing.ts
    └── index.ts
```

#### Key Areas

- **Errors:** Custom error classes with HTTP status codes and serialization.
- **Events:** Typed event interfaces, subjects, base listener/publisher classes.
- **Messaging:** RabbitMQ wrapper and base classes with tracing.
- **Middlewares:** `currentUser`, `requireAuth`, `validateRequest`, `errorHandler`.
- **Logger:** Winston logger with JSON output.
- **Tracing:** Datadog tracer initialization and helpers.

---

### 2.4 Expiration Service

#### Overview

The `expiration` service listens for order creation events and schedules expiration jobs using Bull (Redis-backed). When an order expires, it publishes an expiration complete event.

#### Architecture & Key Responsibilities

- Listens to `OrderCreated` events via RabbitMQ.
- Schedules delayed expiration jobs in Bull queue.
- Publishes `ExpirationComplete` events after delay.
- Uses RabbitMQ wrapper and Bull queue.
- Integrates Datadog tracing and Winston logging.

#### Directory Structure

```plaintext
expiration/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── __mocks__/nats-wrapper.ts
    ├── events/
    │   ├── listeners/order-created-listener.ts
    │   └── publishers/expiration-complete-publisher.ts
    ├── index.ts
    ├── logger.ts
    ├── nats-wrapper.ts
    ├── queues/expiration-queue.ts
    ├── rabbitmq-wrapper.ts
    └── tracer.ts
```

---

### 2.5 Infrastructure (Kubernetes Manifests)

#### Overview

The `infra/k8s` directory contains Kubernetes manifests for deploying all microservices, databases, messaging infrastructure, observability tools, and ingress routing.

#### Key Components

- Deployments and Services for each microservice and MongoDB instances.
- RabbitMQ and NATS deployments.
- Redis deployment for expiration service.
- OpenTelemetry Collector and Datadog Agent for observability.
- Grafana Alloy for log aggregation.
- Ingress controller for routing external traffic.
- Secrets and RBAC configurations.

#### Directory Structure

```plaintext
infra/k8s/
├── auth-depl.yaml
├── auth-mongo-depl.yaml
├── client-depl.yaml
├── datadog-agent.yaml
├── expiration-depl.yaml
├── expiration-redis-depl.yaml
├── ingress-srv.yaml
├── nats-depl.yaml
├── orders-depl.yaml
├── orders-mongo-depl.yaml
├── otel-collector-depl.yaml
├── payments-depl.yaml
├── payments-mongo-depl.yaml
├── rabbitmq-depl.yaml
├── rabbitmq-secret.yaml
├── tickets-depl.yaml
├── tickets-mongo-depl.yaml
├── alloy-config.yaml
├── alloy-depl.yaml
├── alloy-rbac.yaml
├── debug-pod.yaml
└── services-secrets.yaml
```

---

### 2.6 NATS Test Module

#### Overview

The `nats-test` directory is a minimal example demonstrating publishing and listening to `TicketCreated` events using NATS Streaming Server.

#### Directory Structure

```plaintext
nats-test/
├── package.json
├── tsconfig.json
└── src/
    ├── events/
    │   ├── ticket-created-listener.ts
    │   └── ticket-created-publisher.ts
    ├── listener.ts
    └── publisher.ts
```

---

### 2.7 Orders Service

#### Overview

The `orders` service manages order lifecycle: creation, retrieval, cancellation, and updates triggered by external events. It uses MongoDB for persistence, RabbitMQ for messaging, and integrates with other services via events.

#### Architecture & Key Responsibilities

- REST API for order management.
- Listens to ticket, payment, and expiration events.
- Publishes order lifecycle events.
- Uses optimistic concurrency control.
- Enforces authentication and authorization.
- Integrates logging and tracing.

#### Directory Structure

```plaintext
orders/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── __mocks__/
    ├── app.ts
    ├── index.ts
    ├── logger.ts
    ├── nats-wrapper.ts
    ├── rabbitmq-wrapper.ts
    ├── tracer.ts
    ├── models/
    │   ├── order.ts
    │   └── ticket.ts
    ├── events/
    │   ├── listeners/
    │   └── publishers/
    ├── routes/
    └── test/
```

---

### 2.8 Payments Service

#### Overview

The `payments` service processes payments via Stripe, listens to order events, and publishes payment events. It ensures secure payment processing and maintains payment records.

#### Architecture & Key Responsibilities

- Processes payment requests.
- Listens to order created/cancelled events.
- Publishes payment created events.
- Uses MongoDB for persistence.
- Integrates Stripe SDK.
- Uses RabbitMQ for messaging.
- Implements authentication and validation.

#### Directory Structure

```plaintext
payments/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── __mocks__/
    ├── app.ts
    ├── events/
    │   ├── listeners/
    │   └── publishers/
    ├── index.ts
    ├── logger.ts
    ├── models/
    │   ├── order.ts
    │   └── payment.ts
    ├── nats-wrapper.ts
    ├── rabbitmq-wrapper.ts
    ├── routes/
    ├── stripe.ts
    ├── test/
    └── tracer.ts
```

---

### 2.9 Tickets Service

#### Overview

The `tickets` service manages ticket CRUD operations, publishes ticket events, and listens to order events to update ticket reservation status.

#### Architecture & Key Responsibilities

- REST API for ticket management.
- Publishes `TicketCreated` and `TicketUpdated` events.
- Listens to `OrderCreated` and `OrderCancelled` events.
- Uses optimistic concurrency control.
- Enforces authentication and authorization.
- Integrates logging and tracing.

#### Directory Structure

```plaintext
tickets/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── __mocks__/
    ├── app.ts
    ├── events/
    │   ├── listeners/
    │   └── publishers/
    ├── index.ts
    ├── logger.ts
    ├── models/
    │   ├── __test__/
    │   └── ticket.ts
    ├── nats-wrapper.ts
    ├── rabbitmq-wrapper.ts
    ├── routes/
    ├── test/
    └── tracer.ts
```

---

## 3. End-to-End System Operation Walkthrough

This section describes detailed data flow and service interactions for key user scenarios, illustrating how components collaborate.

---

### 3.1 User Signup and Authentication Flow

1. **User visits client frontend** and navigates to signup/signin page.
2. **Client calls Auth Service API** (`/api/users/signup` or `/api/users/signin`) with user credentials.
3. **Auth Service**:
   - Validates input.
   - For signup: hashes password, creates user in MongoDB.
   - For signin: verifies password.
   - Issues JWT token and sets it in a secure cookie.
4. **Client receives JWT cookie** and stores current user state.
5. **Subsequent client requests** include JWT cookie for authentication.
6. **Auth middleware (`currentUser`)** in backend services extracts user info from JWT for authorization.

---

### 3.2 Ticket Creation and Publishing Flow

1. **Authenticated user creates a ticket** via client UI.
2. **Client calls Tickets Service API** (`POST /api/tickets`) with ticket details.
3. **Tickets Service**:
   - Validates input and user authentication.
   - Creates ticket document in MongoDB.
   - Publishes `TicketCreated` event to RabbitMQ.
4. **Orders Service** listens to `TicketCreated` event:
   - Creates a local copy of the ticket for order validation.
5. **Client can now view the ticket** on the landing page or ticket detail page.

---

### 3.3 Order Creation and Expiration Flow

1. **User selects a ticket to purchase** and initiates order creation.
2. **Client calls Orders Service API** (`POST /api/orders`) with ticket ID.
3. **Orders Service**:
   - Validates ticket availability by checking local ticket copy.
   - Creates order with expiration timestamp.
   - Publishes `OrderCreated` event.
4. **Expiration Service** listens to `OrderCreated` event:
   - Schedules a delayed job in Bull queue to expire the order after configured delay.
5. **Tickets Service** listens to `OrderCreated` event:
   - Marks the ticket as reserved by setting `orderId`.
   - Publishes `TicketUpdated` event.
6. **Orders Service** listens to `TicketUpdated` event to keep ticket info updated.

---

### 3.4 Payment Processing Flow

1. **User proceeds to payment** on order detail page.
2. **Client collects payment info** and obtains Stripe token.
3. **Client calls Payments Service API** (`POST /api/payments`) with Stripe token and order ID.
4. **Payments Service**:
   - Validates order ownership and status.
   - Creates Stripe charge.
   - Saves payment record in MongoDB.
   - Publishes `PaymentCreated` event.
5. **Orders Service** listens to `PaymentCreated` event:
   - Marks order as complete.
6. **Client is redirected to orders list** showing updated order status.

---

### 3.5 Order Cancellation and Ticket Release Flow

1. **If order expires** (no payment within expiration window):
   - Expiration Service processes delayed job.
   - Publishes `ExpirationComplete` event.
2. **Orders Service** listens to `ExpirationComplete` event:
   - Cancels the order.
   - Publishes `OrderCancelled` event.
3. **Tickets Service** listens to `OrderCancelled` event:
   - Clears `orderId` on ticket to mark it as available.
   - Publishes `TicketUpdated` event.
4. **Client UI updates** to reflect ticket availability and order cancellation.

Alternatively, **user can manually cancel order** via Orders Service API, triggering similar event flow.

---

## 4. Summary

This ticketing platform is a well-architected microservices system leveraging event-driven communication, asynchronous messaging, and modern cloud-native infrastructure. Each service is focused on a single responsibility, communicating via RabbitMQ events to maintain eventual consistency. The system integrates observability through DataDog tracing and centralized logging, ensuring operational visibility.

The **Auth Service** secures user identity, the **Client** provides a rich UI, **Tickets** and **Orders** manage core domain entities, **Payments** handle financial transactions, and **Expiration** ensures timely order lifecycle management. The **Common Library** enforces consistency and reduces duplication, while the **Infrastructure** manifests enable scalable deployment on Kubernetes.

This architecture supports scalability, fault tolerance, and maintainability, making it suitable for production-grade ticketing applications.

---

If you require further deep dives into specific files, code examples, or additional scenarios, please let me know!
