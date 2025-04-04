# Comprehensive System Architecture Document

## 1. Overview

This ticketing platform is designed as a collection of decoupled microservices communicating through an event-driven architecture using NATS Streaming. The key services include:

- **Auth Service** – Manages user registration, sign in/out, and session management.
- **Tickets Service** – Handles ticket creation, update, retrieval, and reservation state.
- **Orders Service** – Manages ticket orders including creation, cancellation, and order status updates.
- **Payments Service** – Processes payments (via Stripe), records payment events, and updates order status upon successful transactions.
- **Expiration Service** – Monitors order lifetimes and issues expiration events to automatically cancel unpaid orders.
- **Client** – A Next.js web application acting as the user interface (UI) to access and interact with the backend services.
- **Common Module** – Provides shared utilities such as error classes, logging, request validation, authentication middleware, and event abstractions that standardize behavior across all services.
- **Infrastructure (Infra)** – Contains Kubernetes deployment manifests for production-level orchestration, service discovery (via Ingress), and connectivity to dependencies like MongoDB, Redis, and NATS.
- **NATS Test Module** – A demonstration/test harness for simulating event publishing and consumption using the NATS Streaming platform.

---

## 2. System Components and File Tree Overview

Below is an abstracted file tree representation of the entire repository. Each directory corresponds to a logical microservice or component group:

```
.
├── auth                -> Authentication microservice (user management)
├── client              -> Next.js web client (UI) for end users
├── common              -> Shared utilities (errors, events, middlewares, logger)
├── expiration          -> Service handling order expiration logic
├── infra               -> Kubernetes resources and cluster configuration
├── nats-test           -> Test harness for demonstrating NATS event integration
├── orders              -> Service managing order creation, listing, and cancellation
├── payments            -> Payment processing service (integrates with Stripe)
└── tickets             -> Service managing ticket data (creation, update, query)
```

Each service is built as a standalone Node.js/Express application (except for the client, which is a Next.js app) and leverages common patterns for middleware registration, database (Mongo) connection, and inter-service communication via NATS.

---

## 3. Detailed Module Breakdown

### 3.1 Auth Service

**Path:** `auth/`

**Purpose:**  
Manages user registration, login, logout, and verifying the current authenticated user by issuing and checking JWTs. It persists user data in MongoDB.

**File Tree & Key Components:**

```
auth/
└── src/
    ├── app.ts            -> Sets up the Express app, registers middlewares (JSON parsing, cookie-session), and mounts auth routes.
    ├── index.ts          -> Bootstraps the service: validates environment variables (JWT_KEY, AUTH_MONGO_URI), connects to MongoDB, and starts the HTTP server.
    ├── models/
    │   └── user.ts       -> Defines the User schema and model (includes password hashing pre-save logic).
    ├── routes/
    │   ├── currentuser.ts -> GET endpoint to return current authenticated user details.
    │   ├── signin.ts      -> POST endpoint to authenticate users using email/password and issue JWT.
    │   ├── signout.ts     -> POST endpoint to clear the session (user logout).
    │   └── signup.ts      -> POST endpoint for user registration.
    └── utils/
        └── password.ts   -> Contains password hashing and comparison functions using crypto.
```

---

### 3.2 Tickets Service

**Path:** `tickets/`

**Purpose:**  
Handles ticket lifecycle management (creation, updates, display) and ensures ticket availability is kept in sync with orders. It publishes events when tickets are created or updated and subscribes to order events (e.g., order cancellation/creation) to adjust ticket reservations.

**File Tree & Key Components:**

```
tickets/
└── src/
    ├── __mocks__/
    │   └── nats-wrapper.ts          -> Mock implementation of NATS client for testing.
    ├── app.ts                     -> Configures the Express app; registers ticket routes and common middleware.
    ├── index.ts                   -> Entry point: validates env variables, connects to MongoDB & NATS; instantiates event listeners; starts server.
    ├── logger.ts                  -> Configures Winston logger for structured logging.
    ├── nats-wrapper.ts            -> Abstraction over NATS Streaming client; ensures reliable connection for event publishing/subscription.
    ├── models/
    │   └── ticket.ts              -> Mongoose model for Ticket with fields (title, price, userId, optional orderId) and concurrency control.
    ├── events/
    │   ├── listeners/
    │   │   ├── order-created-listener.ts  -> Listens for OrderCreated events; marks ticket as reserved.
    │   │   └── order-cancelled-listener.ts  -> Listens for OrderCancelled events; clears ticket reservation.
    │   └── publishers/
    │       ├── ticket-created-publisher.ts  -> Publishes TicketCreated events upon new ticket creation.
    │       └── ticket-updated-publisher.ts  -> Publishes TicketUpdated events after ticket modifications.
    └── routes/
        ├── index.ts             -> GET endpoint to list all tickets.
        ├── new.ts               -> POST endpoint to create a new ticket (with authentication and validation).
        ├── show.ts              -> GET endpoint to retrieve details of a specific ticket.
        └── update.ts            -> PUT endpoint to update ticket details—ensures only ticket owners or valid non-reserved tickets may be updated.
```

---

## 4. Component Interactions and Overall System Workflow

### Event-Driven Communication

- **NATS Streaming Server** is at the heart of the event-driven architecture. Every service uses a common **nats-wrapper** module to establish a connection, publish domain events (e.g., TicketCreated, OrderCreated, PaymentCreated, ExpirationComplete), and subscribe to events in order to maintain consistent state across the system.

- **Tickets Service** publishes events (TicketCreated, TicketUpdated) whenever a ticket is added or modified. It also listens for order-related events to update the reservation status.

- **Orders Service** creates orders by validating ticket availability, publishes OrderCreated events, and listens to ExpirationComplete and PaymentCreated events to transition order states.

- **Payments Service** consumes order state information to verify and process payments using Stripe. Upon a successful transaction, it publishes a PaymentCreated event, indicating that the order has been paid.

- **Expiration Service** listens for OrderCreated events, schedules expiration jobs via a Redis-backed queue, and when an order’s time expires, publishes an ExpirationComplete event. This ensures that unpaid orders are cancelled promptly.

---

## 5. How the System Works as a Whole

1. **User Journey:**

   - A new user registers or signs in via the Auth service.
   - Upon authentication, the user navigates the client to browse available tickets and selects a ticket to purchase.

2. **Order Creation:**

   - When a user places an order, the Orders service checks for ticket availability and creates an order with an expiration time.
   - An OrderCreated event is published via NATS.

3. **Order Management:**

   - The Expiration service schedules a background job and publishes an ExpirationComplete event if the payment is not completed in time.
   - Concurrently, the Orders service listens to PaymentCreated events to mark orders as complete.

4. **Payment Processing:**

   - The Payments service verifies the order, processes a charge through Stripe, and publishes a PaymentCreated event.

5. **Synchronized Updates:**
   - The Tickets service listens to changes from the Orders service and updates ticket reservation flags accordingly.

---

## 6. Conclusion

This document provides a holistic view of the ticketing platform’s architecture. The event-driven design and modular implementation ensure that each service can scale independently while maintaining tight integration via a robust messaging layer and common utilities.
