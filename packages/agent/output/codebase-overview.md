Okay, let's assemble a comprehensive, technically detailed codebase walkthrough based on the provided component analyses.

---

## Comprehensive Codebase Walkthrough: Ticketing Microservices System

This document provides an in-depth technical walkthrough of the ticketing microservices system codebase. It details the purpose, architecture, and implementation of each major component and explains how these components interact to fulfill key user scenarios.

### 1. Overall System Overview

**Purpose:**
The ticketing system is a distributed application designed to allow users to browse, create, order, and purchase tickets for events. It follows a microservice architecture pattern to provide scalability, resilience, and independent deployability of different functional areas.

**Architecture:**
The system is built as a collection of independent microservices, each responsible for a specific domain (authentication, tickets, orders, payments, expiration). Key architectural characteristics include:

- **Microservices:** Each core function is encapsulated in its own service (Auth, Tickets, Orders, Payments, Expiration).
- **Database per Service:** Each stateful service (Auth, Tickets, Orders, Payments) has its own dedicated MongoDB database instance. The Expiration service uses Redis for its queue. Services do not share databases directly.
- **Event-Driven Communication:** Services communicate asynchronously primarily through a message broker (RabbitMQ, with NATS Streaming potentially being phased out). Events are used to notify other services about state changes (e.g., `OrderCreated`, `TicketUpdated`).
- **API Gateway / Ingress:** A single entry point (Nginx Ingress Controller in Kubernetes) routes external HTTP traffic to the appropriate backend service based on the request path.
- **Shared Library:** A common Node.js module (`@lt-ticketing/common`) provides reusable code for cross-cutting concerns like error handling, middleware, event definitions, message broker wrappers, logging, and tracing.
- **Frontend Client:** A Next.js application serves as the user interface, interacting with the backend services via the Ingress.
- **Containerization & Orchestration:** Services are containerized using Docker and deployed/managed using Kubernetes.
- **Observability:** Integrated logging (Grafana Alloy/Loki), tracing (Datadog/OpenTelemetry), and potentially metrics provide visibility into the system's behavior.

**Key Components:**

- **`auth`:** Manages user authentication (signup, signin, signout) and identifies the current user using JWTs in cookies. Uses MongoDB.
- **`tickets`:** Manages event tickets (create, view, update). Tracks ticket reservation status based on orders. Uses MongoDB.
- **`orders`:** Manages user orders for tickets (create, view, cancel). Maintains a local cache of ticket data. Uses MongoDB.
- **`payments`:** Handles payment processing via Stripe. Records payments. Uses MongoDB.
- **`expiration`:** Implements order expiration logic using a delayed job queue (Bull/Redis). Publishes events when orders expire. Uses Redis.
- **`client`:** The Next.js frontend application providing the user interface.
- **`common`:** A shared Node.js module containing reusable code (middleware, errors, event definitions, message broker wrappers, logging, tracing).
- **`infra/k8s`:** Kubernetes manifests defining the deployment, services, ingress, secrets, and observability infrastructure.
- **`nats-test`:** A utility for testing NATS Streaming connectivity and event publishing/listening in isolation (likely related to a migration from NATS to RabbitMQ).
- **Databases:** Dedicated MongoDB instances for `auth`, `tickets`, `orders`, `payments`. Redis for `expiration`.
- **Message Brokers:** RabbitMQ (primary) and NATS Streaming (potentially legacy/alternative) for asynchronous event communication.
- **Ingress:** Nginx Ingress Controller for external traffic routing.
- **Observability Stack:** Datadog Agent, OpenTelemetry Collector, Grafana Alloy for tracing, metrics, and logging collection.

---

### 2. Component Analyses

This section provides a detailed technical breakdown of each major component directory, based on the provided analyses.

#### 2.1 `.git` (Git Repository Metadata)

**Purpose:**
The `.git` directory is the standard directory created and managed by the Git version control system. It contains all the information Git needs to track the project's history, manage branches, handle commits, and interact with remote repositories. It is fundamental to the development workflow but is **not** an application service or component that runs as part of the deployed system.

**Architecture (Git's Internal Structure):**
The `.git` directory has a specific internal structure defined by Git. It's not an application architecture but a file-based database and configuration store. Key subdirectories and files include `objects/` (stores data objects), `refs/` (stores pointers like branches/tags), `HEAD` (points to the current commit), `config` (repository configuration), `hooks/` (for custom scripts), and `index` (staging area).

**Implementation Details:**
The files within `.git` are managed exclusively by the Git command-line tool. They are typically binary or specially formatted text files not intended for manual editing. Git uses hashing (SHA-1/SHA-256), a directed acyclic graph (DAG) for commits, and compression for efficient storage.

**Relationship to the Broader System:**
The `.git` directory is essential for managing the source code of _all_ application services, the client, common libraries, and infrastructure configurations. It enables collaboration and is used by deployment processes (like Skaffold or CI/CD) to fetch code, but it does not interact with the running application services.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/.git/
├── HEAD                                # Points to the current branch or commit
├── config                              # Repository-specific configuration options
├── description                         # Description of the repository (often unused)
├── hooks/                              # Directory for Git hook scripts
│   ├── applypatch-msg.sample           # Sample hook script
│   ├── commit-msg.sample               # Sample hook script
│   ├── fsmonitor-watchman.sample       # Sample hook script
│   ├── post-update.sample              # Sample hook script
│   ├── pre-applypatch.sample           # Sample hook script
│   ├── pre-commit.sample               # Sample hook script
│   ├── pre-merge-commit.sample         # Sample hook script
│   ├── pre-push.sample                 # Sample hook script
│   ├── pre-rebase.sample               # Sample hook script
│   ├── pre-receive.sample              # Sample hook script
│   ├── prepare-commit-msg.sample       # Sample hook script
│   ├── update.sample                   # Sample hook script
│   └── ... (other sample or custom hooks)
├── index                               # Binary file storing the staging area (index)
├── info/                               # Auxiliary information
│   └── exclude                         # Patterns ignored by Git but not in .gitignore
├── objects/                            # Stores all Git objects (commits, trees, blobs, tags)
│   ├── info/                           # Auxiliary object info (e.g., alternates)
│   └── pack/                           # Stores pack files (compressed objects) and index files
│       └── ... (pack files and index files)
└── refs/                               # Stores pointers to commits (branches, tags, remotes)
    ├── heads/                          # Local branches
    │   └── ... (branch files)
    ├── remotes/                        # Remote branches
    │   └── origin/                     # Example remote (usually 'origin')
    │       └── ... (remote branch files)
    └── tags/                           # Tags
        └── ... (tag files)
```

**Source Files:**
Content of `.git` files is internal to Git and not relevant application source code.

#### 2.2 `auth` Service

**Purpose:**
The `auth` service is a core microservice responsible for managing user authentication and authorization (identifying the current user) within the ticketing system. It handles user registration, login, logout, and session management using JWTs.

**Architecture:**
A Node.js application using Express.js. It interacts with a dedicated MongoDB database (`auth-mongo-srv`) for user data persistence. Authentication state is managed via JWTs stored in secure, HTTP-only cookies. It consumes the `@lt-ticketing/common` library for shared middleware, error handling, and utilities.

**Key Responsibilities:**

- Securely store user credentials (hashed passwords).
- Validate user input for signup and signin.
- Prevent duplicate user registrations.
- Hash passwords using `scrypt`.
- Issue and verify JWTs.
- Set and clear JWTs in HTTP-only cookies.
- Provide an endpoint to retrieve the current user's information based on the JWT.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/auth/
├── .dockerignore         # Specifies files and directories to ignore when building the Docker image.
├── .gitignore            # Specifies files and directories to ignore in the Git repository.
├── Dockerfile            # Defines the steps to build the Docker image for the auth service.
├── package.json          # Lists project dependencies, scripts, and metadata.
├── src/                  # Contains the source code for the service.
│   ├── __mocks__/         # Mock implementations for testing.
│   │   └── tracing.ts    # Mock for the tracing library (dd-trace) used in tests.
│   ├── app.ts            # Sets up the Express application, middleware, and mounts routes. Configures cookie-session and uses common middleware.
│   ├── index.ts          # The main entry point, connects to MongoDB and starts the server. Checks for env vars, initializes tracing.
│   ├── models/           # Defines Mongoose data models.
│   │   └── user.ts       # Mongoose model for the User, including password hashing pre-save hook and toJSON transform.
│   ├── routes/           # Contains Express route handlers for API endpoints.
│   │   ├── __test__/      # Integration tests for the API routes using supertest and in-memory MongoDB.
│   │   │   ├── current-user.test.ts # Tests the /api/users/currentuser endpoint.
│   │   │   ├── signin.test.ts     # Tests the /api/users/signin endpoint.
│   │   │   ├── signout.test.ts    # Tests the /api/users/signout endpoint.
│   │   │   └── signup.test.ts     # Tests the /api/users/signup endpoint.
│   │   ├── currentuser.ts  # Route handler for GET /api/users/currentuser. Uses common currentUser middleware.
│   │   ├── signin.ts       # Route handler for POST /api/users/signin. Validates input, finds user, compares password, generates JWT, sets cookie.
│   │   ├── signout.ts      # Route handler for POST /api/users/signout. Clears the session cookie.
│   │   └── signup.ts       # Route handler for POST /api/users/signup. Validates input, checks for existing user, creates user, hashes password, generates JWT, sets cookie.
│   ├── test/             # Helper files for testing setup.
│   │   ├── getAuthCookie.ts # Helper function to get an authentication cookie for tests by simulating signup.
│   │   └── setup.ts        # Jest setup file for integration tests (MongoDB memory server, mocks, env vars).
│   ├── tracer.ts         # Initializes the tracing library (Datadog dd-trace).
│   └── utils/            # Utility functions.
│       └── password.ts   # Utility class for secure password hashing and comparison using scrypt.
└── tsconfig.json         # TypeScript configuration file.
```

**Technical Details:**

- Uses `express`, `express-async-errors`, `express-validator`, `jsonwebtoken`, `mongoose`, `cookie-session`, `scrypt`, `@lt-ticketing/common`, `dd-trace`.
- `index.ts` connects to MongoDB using `process.env.AUTH_MONGO_URI` and starts the Express server on port 3000.
- `app.ts` configures `cookie-session` with `signed: false` and `secure: process.env.NODE_ENV !== 'test'`, and uses `currentUser` and `errorHandler` middleware from `@lt-ticketing/common`.
- `models/user.ts` defines the Mongoose schema. A `pre('save')` hook hashes the password using `utils/password.ts` before saving. `toJSON` removes sensitive fields.
- `utils/password.ts` implements `scrypt` for secure password hashing and comparison.
- Routes (`signup`, `signin`) use `express-validator` for input validation and `validateRequest` middleware from `common`.
- JWTs are signed using `process.env.JWT_KEY` and stored in the `req.session.jwt` property, which `cookie-session` serializes into the `Set-Cookie` header.
- `currentuser.ts` relies on the `currentUser` middleware to populate `req.currentUser` by verifying the JWT from the cookie.
- Tests use `mongodb-memory-server` for isolated database testing and `supertest` for HTTP requests. Mocks are used for tracing.

**Relationship to Broader System:**

- Provides authentication services for the `client`.
- Sets the JWT cookie that is read and verified by the `currentUser` middleware in _all_ other backend services (`tickets`, `orders`, `payments`, `expiration`) via the `common` library, enabling them to identify the user without direct communication with the `auth` service.
- Depends on a dedicated MongoDB instance (`auth-mongo-srv`) managed by `infra/k8s`.
- Exposed externally via the Ingress (`ingress-srv.yaml`) on the `/api/users` path.
- Integrated with tracing (`tracer.ts`) and logging (`@lt-ticketing/common/logger`).

#### 2.3 `client` (Frontend Application)

**Purpose:**
The `client` directory contains the Next.js frontend application, serving as the user interface for the ticketing system. It provides pages for authentication, viewing tickets, creating tickets, viewing orders, and handling the payment flow.

**Architecture:**
A standard Next.js application. Uses React components (`components/`), pages (`pages/`) for routing, custom hooks (`hooks/`) for reusable logic, and utility functions (`api/`) for API interaction. It fetches data using Next.js's `getInitialProps` for Server-Side Rendering (SSR) or client-side data loading.

**Key Responsibilities:**

- Provide user interface for all application features.
- Handle client-side routing.
- Make API calls to backend services via the Ingress.
- Manage user authentication state (implicitly via cookies handled by the browser).
- Display data fetched from backend services.
- Handle and display errors from backend services.
- Integrate with Stripe client-side for payment input.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/client/
├── .dockerignore          # Specifies files and directories to ignore when building the Docker image
├── .gitignore             # Specifies files and directories to ignore in Git
├── Dockerfile             # Defines the steps to build the Docker image for the client application
├── api/                   # Contains utilities for interacting with backend APIs
│   └── build-client.js      # Configures and returns an Axios instance for making API requests, handling server-side vs. client-side differences (internal vs. external URLs).
├── components/            # Reusable React components
│   └── header.js          # The application header component, displaying navigation links based on user authentication status (uses currentUser prop).
├── hooks/                 # Custom React hooks
│   └── use-request.js     # A custom hook to simplify making API requests, handling loading, errors, and success callbacks. Formats backend errors for display.
├── next.config.js         # Next.js configuration file (e.g., webpack settings)
├── package.json           # Node.js package manager file, lists dependencies and scripts
├── pages/                 # Defines the application's routes and pages
│   ├── _app.js              # Custom App component, wraps all pages. Implements getInitialProps to fetch currentUser and pass it down. Sets up global styles.
│   ├── auth/                # Authentication related pages
│   │   ├── signin.js          # Sign-in page with a form. Uses useRequest to POST to /api/users/signin, redirects on success.
│   │   ├── signout.js         # Sign-out page. Uses useEffect and useRequest to POST to /api/users/signout on load, redirects on success.
│   │   └── signup.js          # Sign-up page with a form. Uses useRequest to POST to /api/users/signup, redirects on success.
│   ├── banana.js            # A simple test page (likely for initial setup verification)
│   ├── index.js             # The landing page. Uses getInitialProps to fetch tickets from /api/tickets, displays them.
│   ├── orders/              # Order related pages
│   │   ├── [orderId].js       # Dynamic route for displaying a single order's details. Uses getInitialProps to fetch order from /api/orders/:orderId. Implements countdown timer and Stripe checkout component. Uses useRequest to POST to /api/payments.
│   │   └── index.js           # Page displaying a list of the current user's orders. Uses getInitialProps to fetch orders from /api/orders.
│   ├── tickets/             # Ticket related pages
│   │   ├── [ticketId].js      # Dynamic route for displaying a single ticket's details. Uses getInitialProps to fetch ticket from /api/tickets/:ticketId. Uses useRequest to POST to /api/orders to create an order.
│   │   └── new.js             # Page with a form for creating a new ticket. Uses useRequest to POST to /api/tickets.
└── tsconfig.json          # TypeScript configuration file.
```

**Technical Details:**

- Uses `next`, `react`, `axios`, `react-stripe-checkout`.
- `pages/_app.js` uses `getInitialProps` to call `/api/users/currentuser` via `build-client.js` on every page load (SSR or client-side navigation) to determine the authenticated user.
- `api/build-client.js` dynamically creates an `axios` instance. On the server, it points to the internal Ingress service (`http://ingress-nginx-controller.ingress-nginx.svc.cluster.local`) and forwards headers (including cookies). In the browser, it uses a relative path (`/`).
- `hooks/use-request.js` is a custom hook that wraps `axios` calls, handles loading/error states, and formats errors received from the backend (which follow the `common` library's error structure).
- Authentication pages (`pages/auth/*`) use `useRequest` to interact with the Auth service API and `next/router` for redirection.
- Ticket and Order pages (`pages/tickets/*`, `pages/orders/*`) use `getInitialProps` to fetch initial data from the Tickets and Orders services via their respective API endpoints.
- `pages/orders/[orderId].js` integrates `react-stripe-checkout` for client-side payment form and uses `useRequest` to send the Stripe token and order ID to the Payments service's `/api/payments` endpoint.

**Relationship to Broader System:**

- The sole interface for end-users.
- Communicates with _all_ backend services (`auth`, `tickets`, `orders`, `payments`) _only_ via the **Ingress** (`ingress-srv.yaml`).
- Relies on the `auth` service (via the `/api/users/currentuser` endpoint) to determine the current user's authentication status.
- Interacts with `tickets-srv` for ticket listing/details/creation.
- Interacts with `orders-srv` for order listing/details/creation.
- Interacts with `payments-srv` for initiating payments.
- Does _not_ interact directly with databases or message brokers.

#### 2.4 `common` (Shared Library/Module)

**Purpose:**
The `common` directory contains a shared Node.js module (`@lt-ticketing/common`) providing reusable code components used across all microservices. This promotes consistency, reduces duplication, and centralizes definitions for cross-cutting concerns.

**Architecture:**
Not a running service, but a library consumed by other services. It provides:

- Custom Error classes.
- Express Middleware.
- Event definitions (Subjects, Interfaces, Types).
- Message Broker (NATS/RabbitMQ) base classes and wrappers.
- Logging utility.
- Tracing initialization and helpers.

**Key Responsibilities:**

- Standardize API error responses.
- Provide middleware for authentication (`currentUser`, `requireAuth`), request validation (`validateRequest`), and error handling (`errorHandler`).
- Define the structure and subjects for inter-service events.
- Provide abstract classes and wrappers for interacting with NATS Streaming and RabbitMQ.
- Configure and provide a shared logger instance.
- Initialize distributed tracing and provide helpers for tracing message flows.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/common/
├── .gitignore                 # Specifies intentionally untracked files that Git should ignore.
├── package.json               # Node.js package file, lists dependencies (Express, JWT, Winston, dd-trace, amqplib, node-nats-streaming, express-validator) and scripts.
├── src/                       # Source code directory
│   ├── errors/                # Contains custom error classes extending CustomError.
│   │   ├── bad-request-error.ts         # 400 Bad Request.
│   │   ├── custom-error.ts              # Abstract base class for custom errors, defines serializeErrors().
│   │   ├── database-connection-error.ts # 500 Internal Server Error for DB issues.
│   │   ├── not-authorized-error.ts      # 401 Unauthorized.
│   │   ├── not-found-error.ts           # 404 Not Found.
│   │   └── request-validation-error.ts  # 400 Bad Request for express-validator errors.
│   ├── events/                # Contains NATS-specific event definitions and base classes.
│   │   ├── base-event.ts                # Defines the basic structure of an event interface.
│   │   ├── base-listener.ts             # Abstract base class for NATS listeners (subscription, parsing, ack, tracing).
│   │   ├── base-publisher.ts            # Abstract base class for NATS publishers (publishing).
│   │   ├── expiration-complete-event.ts # Interface for 'expiration:complete'.
│   │   ├── order-cancelled-event.ts     # Interface for 'order:cancelled'.
│   │   ├── order-created-event.ts       # Interface for 'order:created'.
│   │   ├── payment-created-event.ts     # Interface for 'payment:created'.
│   │   ├── subject.ts                   # Enum listing all possible NATS event subjects.
│   │   ├── ticket-created-event.ts      # Interface for 'ticket:created'.
│   │   ├── ticket-updated-event.ts      # Interface for 'ticket:updated'.
│   │   └── types/                     # Contains shared types related to events
│   │       ├── order-status.ts          # Enum defining possible order statuses.
│   │       └── queue-group-names.ts     # Enum defining NATS queue group names for different services.
│   ├── index.ts                 # Main entry point, exports all public components.
│   ├── logger.ts                # Configures and exports a Winston logger instance.
│   ├── messaging/             # Contains RabbitMQ-specific base classes and wrapper.
│   │   ├── __mocks__/                 # Mock implementations for testing
│   │   │   └── rabbitmq-wrapper.ts      # Mock of the RabbitMQ wrapper.
│   │   ├── base-listener.ts             # Abstract base class for RabbitMQ listeners (queue assertion, binding, consumption, ack, tracing).
│   │   ├── base-publisher.ts            # Abstract base class for RabbitMQ publishers (publishing, tracing).
│   │   └── rabbitmq-wrapper.ts          # Manages the RabbitMQ connection and channel, includes reconnection logic and exchange assertion. Provides a singleton.
│   ├── middlewares/           # Contains Express middleware functions.
│   │   ├── current-user.ts              # Middleware to extract and verify JWT from session, attaching user info to request.
│   │   ├── error-handler.ts             # Middleware to catch errors and send standardized responses.
│   │   ├── require-auth.ts              # Middleware to ensure a user is authenticated (req.currentUser exists).
│   │   └── validate-request.ts          # Middleware to check for express-validator errors and throw RequestValidationError.
│   └── tracing.ts               # Configures and exports Datadog tracing setup and helper functions for messaging spans.
└── tsconfig.json              # TypeScript configuration file.
```

**Technical Details:**

- Uses `express`, `jsonwebtoken`, `winston`, `dd-trace`, `amqplib`, `node-nats-streaming`, `express-validator`.
- `errors/` classes extend `Error` and `CustomError`, implementing `serializeErrors()` for consistent JSON output `{ errors: [{ message: string, field?: string }] }`.
- `middlewares/` provide standard Express middleware functions used in service `app.ts` files. `currentUser` decodes JWT using `process.env.JWT_KEY`.
- `events/` contains NATS-specific base classes (`BaseListener`, `BasePublisher`) and event interfaces/enums (`Subject`, `OrderStatus`, `QueueGroupName`). Listeners handle durable subscriptions and manual acks.
- `messaging/` contains RabbitMQ-specific base classes (`RabbitMQListener`, `RabbitMQPublisher`) and a `RabbitMQWrapper`. Listeners handle queue binding and manual acks. Both NATS and RabbitMQ base classes integrate tracing helpers from `tracing.ts`.
- `rabbitmq-wrapper.ts` manages the `amqplib` connection, asserts a default topic exchange (`ticketing`), and provides a singleton instance.
- `logger.ts` configures Winston for structured JSON logging.
- `tracing.ts` initializes `dd-trace` and provides functions (`createMessageProducerSpan`, `createMessageConsumerSpan`) to create spans for message publishing and consumption, propagating trace context via message headers.
- `index.ts` re-exports all public components.

**Relationship to Broader System:**

- Consumed by _all_ backend services (`auth`, `tickets`, `orders`, `payments`, `expiration`).
- Provides the shared language for events and the infrastructure wrappers for message broker interaction.
- Enforces consistent API error responses and request processing patterns via middleware.
- Centralizes logging and tracing configuration, enabling system-wide observability.
- Defines shared types (`OrderStatus`, `QueueGroupName`) used across services.

#### 2.5 `expiration` Service

**Purpose:**
The `expiration` service is responsible for timing out orders that are not paid for within a specific duration. It listens for new orders, schedules an expiration job, and signals when an order has expired.

**Architecture:**
A Node.js application. It's event-driven, consuming `OrderCreatedEvent`s from RabbitMQ. It uses a distributed queue (Bull) backed by Redis to manage delayed jobs. It publishes `ExpirationCompleteEvent`s to RabbitMQ. It consumes the `@lt-ticketing/common` library.

**Key Responsibilities:**

- Listen for `OrderCreatedEvent`.
- Calculate the expiration delay for an order.
- Schedule a delayed job in a Bull queue (backed by Redis) for order expiration.
- Process jobs from the queue when the delay expires.
- Publish `ExpirationCompleteEvent` when a job is processed.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/expiration/
├── .dockerignore                 # Specifies files/directories to ignore when building the Docker image
├── .gitignore                    # Specifies files/directories to ignore in Git
├── Dockerfile                    # Defines the steps to build the service's Docker image
├── package.json                  # Project dependencies and scripts
├── src/                          # Source code directory
│   ├── __mocks__/               # Mock implementations for testing
│   │   └── nats-wrapper.ts       # Mock for NATS (likely unused in current RabbitMQ setup)
│   ├── events/                   # Event-related code
│   │   ├── listeners/            # Event listeners
│   │   │   └── order-created-listener.ts # Listens for OrderCreatedEvent from RabbitMQ, schedules expiration job. Extends common RabbitMQListener.
│   │   └── publishers/           # Event publishers
│   │       └── expiration-complete-publisher.ts # Publishes ExpirationCompleteEvent to RabbitMQ. Extends common RabbitMQPublisher.
│   ├── index.ts                  # Application entry point, connects to RabbitMQ, starts listener, initializes tracing. Checks RABBITMQ_URL env var.
│   ├── logger.ts                 # Configures the Winston logger for the service (uses common logger setup).
│   ├── nats-wrapper.ts           # NATS wrapper (appears unused in core logic)
│   ├── queues/                   # Queue implementations
│   │   └── expiration-queue.ts   # Defines and processes the Bull queue ("order:expiration"). Connects to Redis. Processes jobs by publishing ExpirationCompleteEvent.
│   ├── rabbitmq-wrapper.ts       # Configures and exports the RabbitMQ wrapper instance (from common).
│   └── tracer.ts                 # Initializes DataDog tracing.
└── tsconfig.json                 # TypeScript configuration
```

**Technical Details:**

- Uses `express`, `bull`, `redis`, `@lt-ticketing/common`, `dd-trace`, `amqplib`.
- `index.ts` connects to RabbitMQ using `process.env.RABBITMQ_URL` via `rabbitmqWrapper` and starts the `OrderCreatedListener`.
- `events/listeners/order-created-listener.ts` extends `RabbitMQListener`, listens on `Subject.OrderCreated` with `QueueGroupName.ExpirationService`. Its `onMessage` calculates delay and adds a job to the `expirationQueue`.
- `queues/expiration-queue.ts` sets up a Bull queue named `"order:expiration"` connected to Redis via `process.env.REDIS_HOST`. The `process` handler for the queue instantiates `ExpirationCompletePublisher` and publishes the `ExpirationCompleteEvent` with the `orderId` from the job data.
- `events/publishers/expiration-complete-publisher.ts` extends `RabbitMQPublisher` and publishes to `Subject.ExpirationComplete`.
- Tracing (`tracer.ts`) and logging (`logger.ts`) are initialized using the common library's patterns.

**Relationship to Broader System:**

- Consumes `OrderCreatedEvent` from the `orders` service via RabbitMQ.
- Publishes `ExpirationCompleteEvent` to be consumed by the `orders` service via RabbitMQ.
- Depends on RabbitMQ (`rabbitmq-depl.yaml`) and Redis (`expiration-redis-depl.yaml`) infrastructure managed by `infra/k8s`.
- Uses event definitions, RabbitMQ base classes, and logger/tracing setup from the `common` library.

#### 2.6 `infra/k8s` (Kubernetes Infrastructure)

**Purpose:**
The `infra/k8s` directory contains all the Kubernetes YAML manifests required to deploy, configure, and manage the entire ticketing microservices system within a Kubernetes cluster. It defines the desired state of all application components, databases, message brokers, networking, secrets, and observability tools.

**Architecture:**
Defines the system's deployment architecture on Kubernetes:

- `Deployment` resources for each microservice, database, and message broker, specifying container images, replicas, resources, and environment variables.
- `Service` resources (`ClusterIP`) for internal service discovery and communication.
- `Ingress` resource for external HTTP traffic routing to internal services.
- `Secret` resources for managing sensitive configuration data.
- `ConfigMap` resources for non-sensitive configuration.
- Resources for observability agents (Datadog, OpenTelemetry, Grafana Alloy) and their configurations/RBAC.

**Key Responsibilities:**

- Define how each service and its dependencies are containerized and deployed.
- Configure internal cluster networking (Service discovery).
- Configure external access routing (Ingress).
- Manage application configuration and secrets securely.
- Set up infrastructure for collecting logs, traces, and metrics.
- Enable Kubernetes to manage the lifecycle, scaling, and self-healing of application components.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/infra/
└── k8s/
    ├── alloy-config.yaml             # ConfigMap defining the configuration for Grafana Alloy log collection (Kubernetes discovery, relabeling, Loki output).
    ├── alloy-depl.yaml               # Deployment for Grafana Alloy, a log collector agent (mounts host paths for logs, uses configmap and secrets).
    ├── alloy-rbac.yaml               # Role-Based Access Control (RBAC) configuration for Grafana Alloy to access pod logs (ClusterRole, ClusterRoleBinding).
    ├── alloy-secrets.yaml            # Kubernetes Secret for Grafana Alloy credentials (e.g., Loki username/password).
    ├── auth-depl.yaml                # Deployment and Service (ClusterIP) for the Authentication microservice (connects to auth-mongo-srv, uses services-secrets for JWT_KEY).
    ├── auth-mongo-depl.yaml          # Deployment and Service (ClusterIP) for the MongoDB instance used by the Authentication service.
    ├── client-depl.yaml              # Deployment and Service (ClusterIP) for the Next.js client application (exposed via Ingress, uses Datadog JS lib annotation).
    ├── datadog-agent-secrets.yaml    # Kubernetes Secret for Datadog API and App keys.
    ├── datadog-agent.yaml            # Custom Resource definition for deploying the Datadog Agent (configures APM, logs, admission controller).
    ├── debug-pod.yaml                # A simple utility pod (e.g., with curl) for debugging network connectivity within the cluster.
    ├── expiration-depl.yaml          # Deployment and Service (ClusterIP) for the Expiration microservice (connects to expiration-redis-srv, rabbitmq-srv, uses services-secrets).
    ├── expiration-redis-depl.yaml    # Deployment and Service (ClusterIP) for the Redis instance used by the Expiration service.
    ├── ingress-srv.yaml              # Ingress resource defining how external traffic is routed to internal services based on host (ticketing.dev) and paths (/api/* to services, / to client). Uses Nginx annotations.
    ├── nats-depl.yaml                # Deployment and Service (ClusterIP) for the NATS Streaming Server (messaging broker).
    ├── orders-depl.yaml              # Deployment and Service (ClusterIP) for the Orders microservice (connects to orders-mongo-srv, rabbitmq-srv, uses services-secrets).
    ├── orders-mongo-depl.yaml        # Deployment and Service (ClusterIP) for the MongoDB instance used by the Orders service.
    ├── otel-collector-depl.yaml      # ConfigMap, Deployment, and Service (ClusterIP) for the OpenTelemetry Collector (receives OTLP traces, configured via ConfigMap).
    ├── payments-depl.yaml            # Deployment and Service (ClusterIP) for the Payments microservice (connects to payments-mongo-srv, rabbitmq-srv, uses services-secrets for JWT_KEY, STRIPE_KEY).
    ├── payments-mongo-depl.yaml      # Deployment and Service (ClusterIP) for the MongoDB instance used by the Payments service.
    ├── rabbitmq-depl.yaml            # Deployment and Service (ClusterIP) for the RabbitMQ message broker (uses rabbitmq-secret for credentials).
    ├── rabbitmq-secret.yaml          # Kubernetes Secret for RabbitMQ credentials.
    ├── services-secrets.yaml         # Kubernetes Secret potentially holding various service-specific secrets (e.g., JWT_KEY, STRIPE_KEY).
    ├── tickets-depl.yaml             # Deployment and Service (ClusterIP) for the Tickets microservice (connects to tickets-mongo-srv, rabbitmq-srv, uses services-secrets).
    └── tickets-mongo-depl.yaml       # Deployment and Service (ClusterIP) for the MongoDB instance used by the Tickets service.
```

**Technical Details:**

- Uses standard Kubernetes resource types (`Deployment`, `Service`, `Ingress`, `Secret`, `ConfigMap`, `ClusterRole`, `ClusterRoleBinding`).
- Services communicate using internal `ClusterIP` service names (e.g., `auth-mongo-srv`, `rabbitmq-srv`). These names resolve to stable cluster IPs via Kubernetes DNS.
- Environment variables in Deployments (`spec.template.spec.containers.env`) are populated from `Secret`s (`valueFrom.secretKeyRef`) or hardcoded values.
- The `Ingress` resource routes traffic based on `host: ticketing.dev` and `paths` using regex (`nginx.ingress.kubernetes.io/use-regex: 'true'`).
- Observability agents (Datadog, Alloy) are configured to discover and collect data from application pods using labels and annotations. Alloy mounts host paths (`/var/log/containers`) to access container logs.
- OpenTelemetry Collector receives traces via OTLP (gRPC/HTTP) on ports 4317/4318. Application services are configured to send traces to the `otel-collector` service.
- Secrets are base64 encoded in YAML but stored securely by Kubernetes.

**Relationship to Broader System:**

- Provides the runtime environment for _all_ other components.
- Defines the network topology, allowing services to find each other and external traffic to reach the system.
- Manages the lifecycle, scaling, and resilience of the microservices and their dependencies.
- Configures the integration points for observability tools.

#### 2.7 `nats-test` (NATS Test Utility)

**Purpose:**
The `nats-test` directory contains a simple, standalone application to test basic publish-subscribe messaging using NATS Streaming Server. It's a utility for verifying NATS connectivity and event flow in isolation, likely used during development or debugging, and potentially related to a migration away from NATS.

**Architecture:**
Simple Node.js publisher and listener clients that connect directly to a NATS Streaming server. They use event definitions and base classes from the `@lt-ticketing/common` library.

**Key Responsibilities:**

- Connect to a NATS Streaming Server.
- Publish a sample `TicketCreatedEvent`.
- Listen for and process `TicketCreatedEvent`s.
- Demonstrate NATS subjects, queue groups, and manual acknowledgments.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/nats-test/
├── .gitignore                 # Specifies intentionally untracked files that Git should ignore.
├── package.json               # Defines the project dependencies (like node-nats-streaming) and scripts.
├── src/                       # Contains the source code for the NATS test client.
│   ├── events/                # Holds definitions for NATS event publishers and listeners.
│   │   ├── ticket-created-listener.ts # Implements a listener specifically for the TicketCreated event, using common Listener base class.
│   │   └── ticket-created-publisher.ts # Implements a publisher specifically for the TicketCreated event, using common Publisher base class.
│   ├── listener.ts            # The main script to run the NATS listener client. Connects to NATS, starts listener.
│   └── publisher.ts           # The main script to run the NATS publisher client. Connects to NATS, publishes event.
└── tsconfig.json              # TypeScript configuration file.
```

**Technical Details:**

- Uses `node-nats-streaming` and `@lt-ticketing/common`.
- `listener.ts` and `publisher.ts` connect to NATS using `stan.connect('ticketing', clientId, { url: 'http://localhost:4222' })`.
- `events/ticket-created-listener.ts` extends `common.Listener`, specifies `Subject.TicketCreated` and `queueGroupName: 'payments-service'` (demonstrating queue groups), and implements `onMessage` to log data and call `msg.ack()`.
- `events/ticket-created-publisher.ts` extends `common.Publisher`, specifies `Subject.TicketCreated`, and is used to send messages.

**Relationship to Broader System:**

- Not a core running service.
- Uses shared event definitions and NATS base classes from the `common` library, demonstrating how the main services _would_ interact with NATS (or _did_ interact, if migrating to RabbitMQ).
- Used for isolated testing of the NATS messaging layer.

#### 2.8 `orders` Service

**Purpose:**
The `orders` service manages the creation, retrieval, and cancellation of user orders for tickets. It ensures tickets are available before ordering and tracks the order status throughout its lifecycle (created, cancelled, awaiting payment, complete).

**Architecture:**
A Node.js application using Express.js. It uses a dedicated MongoDB database (`orders-mongo-srv`) for order persistence and a local cache of ticket data. It is heavily event-driven, consuming events from `tickets`, `expiration`, and `payments` services via RabbitMQ, and publishing events (`OrderCreated`, `OrderCancelled`) to notify other services. It consumes the `@lt-ticketing/common` library.

**Key Responsibilities:**

- Provide a REST API for order creation, listing, showing, and cancellation.
- Maintain a local, eventually consistent copy of relevant ticket data by listening to `TicketCreated` and `TicketUpdated` events.
- Check if a ticket is reserved (`isReserved()` method on local ticket model) before creating a new order.
- Set an expiration time for new orders.
- Listen for `ExpirationCompleteEvent` to cancel expired orders.
- Listen for `PaymentCreatedEvent` to mark orders as complete.
- Publish `OrderCreatedEvent` and `OrderCancelledEvent`.
- Implement optimistic concurrency control on the Order model.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/orders/
├── .gitignore                  # Specifies intentionally untracked files that Git should ignore.
├── Dockerfile                  # Defines the steps to build a Docker image for the orders service.
├── package.json                # Lists project dependencies, scripts, and metadata.
├── src                         # Contains the main source code for the service.
│   ├── __mocks__               # Mock implementations for dependencies used in testing.
│   │   ├── nats-wrapper.ts     # Mock for NATS (likely unused)
│   │   └── rabbitmq-wrapper.ts # Mock for the RabbitMQ wrapper for testing event publishing/listening.
│   ├── app.ts                  # Sets up the Express application, middleware (json, cookieSession, currentUser, errorHandler), and registers route handlers.
│   ├── events                  # Contains event-related logic (listeners and publishers).
│   │   ├── listeners           # Classes that subscribe to events from other services.
│   │   │   ├── __test__        # Tests for the event listeners.
│   │   │   │   ├── expiration-complete-listener.test.ts # Tests ExpirationCompleteListener.
│   │   │   │   ├── ticket-created-listener.test.ts    # Tests TicketCreatedListener.
│   │   │   │   └── ticket-updated-listener.test.ts    # Tests TicketUpdatedListener (includes concurrency test).
│   │   │   ├── expiration-complete-listener.ts        # Listens for ExpirationComplete events to cancel orders. Extends common RabbitMQListener.
│   │   │   ├── payment-created-listener.ts            # Listens for PaymentCreated events to complete orders. Extends common RabbitMQListener.
│   │   │   ├── ticket-created-listener.ts             # Listens for TicketCreated events to create local ticket copies. Extends common RabbitMQListener.
│   │   │   └── ticket-updated-listener.ts             # Listens for TicketUpdated events to update local ticket copies (uses findByEvent for concurrency). Extends common RabbitMQListener.
│   │   └── publishers          # Classes that publish events to other services.
│   │       ├── order-cancelled-publisher.ts           # Publishes OrderCancelled events. Extends common RabbitMQPublisher.
│   │       └── order-created-publisher.ts             # Publishes OrderCreated events. Extends common RabbitMQPublisher.
│   ├── index.ts                # The main entry point. Connects to DB/RabbitMQ, starts listeners, starts server, initializes tracing. Checks env vars.
│   ├── logger.ts               # Configures the Winston logger (uses common setup).
│   ├── models                  # Defines Mongoose schemas and models for the database.
│   │   ├── order.ts            # Mongoose model for Order documents (includes versioning, status enum, ticket ref).
│   │   └── ticket.ts           # Mongoose model for local Ticket copies (includes versioning, findByEvent, isReserved method).
│   ├── nats-wrapper.ts         # NATS wrapper (appears unused)
│   ├── rabbitmq-wrapper.ts     # Initializes and exports the RabbitMQ wrapper instance (from common).
│   ├── routes                  # Contains Express route handlers for API endpoints.
│   │   ├── __test__            # Integration tests for the API routes using supertest and in-memory DB.
│   │   │   ├── delete.test.ts  # Tests DELETE /api/orders/:orderId.
│   │   │   ├── index.test.ts   # Tests GET /api/orders.
│   │   │   ├── new.test.ts     # Tests POST /api/orders (includes reserved ticket check).
│   │   │   └── show.test.ts    # Tests GET /api/orders/:orderId (includes auth check).
│   │   ├── delete.ts           # Route handler for cancelling an order (updates status, saves, publishes OrderCancelled). Uses requireAuth.
│   │   ├── index.ts            # Route handler for fetching all user orders (filters by userId, populates ticket). Uses requireAuth.
│   │   ├── new.ts              # Route handler for creating a new order (validates ticketId, checks ticket availability, calculates expiration, saves order, publishes OrderCreated). Uses requireAuth, validateRequest.
│   │   └── show.ts             # Route handler for fetching a specific order (finds by id, checks userId). Uses requireAuth.
│   ├── test                    # Helper files for testing.
│   │   ├── createOrder.ts      # Helper to create an order via API for tests.
│   │   ├── createTicket.ts     # Helper to create a ticket directly in test DB for tests.
│   │   ├── getAuthCookie.ts    # Helper to generate fake auth cookie for tests.
│   │   └── setup.ts            # Jest setup file (in-memory DB, mock RabbitMQ, JWT key).
│   └── tracer.ts               # Initializes DataDog tracing.
└── tsconfig.json               # TypeScript configuration file.
```

**Technical Details:**

- Uses `express`, `express-async-errors`, `express-validator`, `mongoose`, `cookie-session`, `mongoose-update-if-current`, `@lt-ticketing/common`, `dd-trace`, `amqplib`.
- `index.ts` connects to MongoDB (`process.env.ORDERS_MONGO_URI`) and RabbitMQ (`process.env.RABBITMQ_URL`) and starts listeners and the Express server.
- `app.ts` uses `currentUser`, `requireAuth`, `validateRequest`, and `errorHandler` middleware from `common`.
- `models/order.ts` and `models/ticket.ts` (local copy) use `mongoose-update-if-current` for optimistic concurrency via the `version` field. `Ticket.findByEvent` is used by listeners to find documents based on ID and _previous_ version. `Ticket.isReserved` queries the local Order collection.
- Routes (`new`, `show`, `delete`) use `requireAuth` and check `req.currentUser!.id` for authorization. `new` uses `validateRequest` and checks ticket availability (`isReserved`).
- Listeners (`TicketCreatedListener`, `TicketUpdatedListener`, `ExpirationCompleteListener`, `PaymentCreatedListener`) extend `common.RabbitMQListener`, listen on specific routing keys (`Subject.*`) and the `QueueGroupName.OrdersService` queue, and update local database state. They use `msg.ack()` for manual acknowledgment.
- Publishers (`OrderCreatedPublisher`, `OrderCancelledPublisher`) extend `common.RabbitMQPublisher` and are used by routes and listeners to send events.
- Tests use `mongodb-memory-server`, `supertest`, and mocks for RabbitMQ. Listener tests specifically verify optimistic concurrency handling.

**Relationship to Broader System:**

- Consumes `TicketCreatedEvent` and `TicketUpdatedEvent` from the `tickets` service.
- Consumes `ExpirationCompleteEvent` from the `expiration` service.
- Consumes `PaymentCreatedEvent` from the `payments` service.
- Publishes `OrderCreatedEvent` (consumed by `expiration`, `payments`, and `tickets`) and `OrderCancelledEvent` (consumed by `tickets` and `payments`).
- Relies on the `auth` service (via `currentUser` middleware) for user identification.
- Provides API endpoints consumed by the `client`.
- Depends on a dedicated MongoDB instance (`orders-mongo-srv`) and RabbitMQ (`rabbitmq-srv`) managed by `infra/k8s`.
- Uses shared components from the `common` library.
- Integrated with tracing and logging.

#### 2.9 `payments` Service

**Purpose:**
The `payments` service handles the processing of payments for orders using a third-party payment gateway (Stripe). It records successful payments and notifies other services.

**Architecture:**
A Node.js application using Express.js. It uses a dedicated MongoDB database (`payments-mongo-srv`) to store local order copies (for validation) and payment records. It consumes `OrderCreatedEvent` and `OrderCancelledEvent` from RabbitMQ and publishes `PaymentCreatedEvent`. It integrates with the Stripe API. It consumes the `@lt-ticketing/common` library.

**Key Responsibilities:**

- Listen for `OrderCreatedEvent` and `OrderCancelledEvent` to maintain a local, eventually consistent copy of relevant order data.
- Provide a REST API endpoint (`/api/payments`) to receive payment requests (order ID, Stripe token).
- Validate payment requests against the local order data (order exists, belongs to user, not cancelled).
- Interact with the Stripe API to create charges.
- Persist successful payment details.
- Publish `PaymentCreatedEvent`.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/payments/
├── .dockerignore               # Specifies files/directories to ignore when building the Docker image
├── .gitignore                  # Specifies files/directories to ignore in Git
├── Dockerfile                  # Defines the Docker image for the payments service
├── package.json                # Project dependencies and scripts (Node.js/npm)
├── src                         # Source code directory
│   ├── __mocks__               # Mock implementations for testing
│   │   ├── nats-wrapper.ts     # Mock for NATS (likely unused)
│   │   ├── rabbitmq-wrapper.ts # Mock for the RabbitMQ wrapper for testing message broker interactions
│   │   └── stripe.ts           # Mock for the Stripe client to simulate payment processing in tests
│   ├── app.ts                  # Express application setup, middleware (json, cookieSession, currentUser, errorHandler), and route mounting.
│   ├── events                  # Event handling logic
│   │   ├── listeners           # Event consumers
│   │   │   ├── __test__        # Tests for event listeners (includes concurrency test for OrderCancelled).
│   │   │   │   ├── order-cancelled-listener.test.ts # Tests OrderCancelledListener.
│   │   │   │   └── order-created-listener.test.ts # Tests OrderCreatedListener.
│   │   │   ├── order-cancelled-listener.ts # Listens for OrderCancelled events to update local order status. Extends common RabbitMQListener.
│   │   │   └── order-created-listener.ts # Listens for OrderCreated events to create local order copies. Extends common RabbitMQListener.
│   │   └── publishers          # Event producers
│   │       └── payment-created-publisher.ts # Publishes PaymentCreated events. Extends common RabbitMQPublisher.
│   ├── index.ts                # Application entry point: connects to DB/RabbitMQ, starts listeners, starts server, initializes tracing. Checks env vars.
│   ├── logger.ts               # Winston logger configuration (uses common setup).
│   ├── models                  # Mongoose database models
│   │   ├── order.ts            # Mongoose model for a local representation of an Order (includes versioning, status enum).
│   │   └── payment.ts          # Mongoose model for storing payment records (links to orderId, stores stripeId).
│   ├── nats-wrapper.ts         # NATS wrapper (appears unused)
│   ├── rabbitmq-wrapper.ts     # RabbitMQ client wrapper, extending common library.
│   ├── routes                  # Express route handlers
│   │   ├── __test__            # Tests for API routes using supertest and in-memory DB.
│   │   │   └── new.test.ts     # Tests POST /api/payments (includes order validation, Stripe mock interaction).
│   │   └── new.ts              # Handles POST /api/payments request (validates input, finds local order, checks auth/status, calls Stripe, saves payment, publishes PaymentCreated). Uses requireAuth, validateRequest.
│   ├── stripe.ts               # Initializes the Stripe client using STRIPE_KEY.
│   ├── test                    # Test utility files
│   │   ├── createTicket.ts     # Utility (likely unused in payments tests)
│   │   ├── getAuthCookie.ts    # Utility to generate fake auth cookie for tests.
│   │   └── setup.ts            # Jest setup file (in-memory DB, mock RabbitMQ, mock Stripe, JWT key).
│   └── tracer.ts               # Initializes DataDog tracing.
└── tsconfig.json               # TypeScript configuration file.
```

**Technical Details:**

- Uses `express`, `express-async-errors`, `express-validator`, `mongoose`, `cookie-session`, `mongoose-update-if-current`, `stripe`, `@lt-ticketing/common`, `dd-trace`, `amqplib`.
- `index.ts` connects to MongoDB (`process.env.PAYMENTS_MONGO_URI`) and RabbitMQ (`process.env.RABBITMQ_URL`) and starts listeners and the Express server.
- `app.ts` uses `currentUser`, `requireAuth`, `validateRequest`, and `errorHandler` middleware from `common`.
- `models/order.ts` (local copy) uses `mongoose-update-if-current` for optimistic concurrency. `models/payment.ts` stores payment records.
- `routes/new.ts` uses `requireAuth` and `validateRequest`. It fetches the order from the _local_ Payments database, performs authorization (`userId` check) and status checks (`status !== OrderStatus.Cancelled`). It calls `stripe.charges.create` using the `stripe` instance initialized in `stripe.ts` with `process.env.STRIPE_KEY`. It saves the `Payment` and publishes `PaymentCreatedEvent`.
- Listeners (`OrderCreatedListener`, `OrderCancelledListener`) extend `common.RabbitMQListener`, listen on specific routing keys (`Subject.*`) and the `QueueGroupName.PaymentsService` queue, and update the local Order database state using optimistic concurrency (`findByEvent` pattern).
- Publisher (`PaymentCreatedPublisher`) extends `common.RabbitMQPublisher` and is used by the `/api/payments` route.
- Tests use `mongodb-memory-server`, `supertest`, and mocks for RabbitMQ and Stripe. Listener tests verify optimistic concurrency.

**Relationship to Broader System:**

- Consumes `OrderCreatedEvent` and `OrderCancelledEvent` from the `orders` service via RabbitMQ.
- Publishes `PaymentCreatedEvent` to be consumed by the `orders` service via RabbitMQ.
- Relies on the `auth` service (via `currentUser` middleware) for user identification.
- Provides an API endpoint consumed by the `client`.
- Depends on a dedicated MongoDB instance (`payments-mongo-depl.yaml`) and RabbitMQ (`rabbitmq-depl.yaml`) managed by `infra/k8s`.
- Integrates with the external Stripe API.
- Uses shared components from the `common` library.
- Integrated with tracing and logging.

#### 2.10 `tickets` Service

**Purpose:**
The `tickets` service is the source of truth for event ticket information. It manages the creation, retrieval, listing, and updating of tickets. It also tracks whether a ticket is currently reserved by an active order.

**Architecture:**
A Node.js application using Express.js. It uses a dedicated MongoDB database (`tickets-mongo-srv`) for ticket persistence. It is event-driven, consuming `OrderCreatedEvent` and `OrderCancelledEvent` from RabbitMQ to update a ticket's reservation status (`orderId` field), and publishing `TicketCreatedEvent` and `TicketUpdatedEvent`. It consumes the `@lt-ticketing/common` library.

**Key Responsibilities:**

- Provide a REST API for creating, viewing (single and list), and updating tickets.
- Persist ticket data in MongoDB.
- Ensure only authenticated users can create or update tickets.
- Validate incoming request data.
- Prevent updates to tickets that are currently reserved.
- Listen for `OrderCreatedEvent` to set the `orderId` on a ticket.
- Listen for `OrderCancelledEvent` to clear the `orderId` on a ticket.
- Publish `TicketCreatedEvent` and `TicketUpdatedEvent`.
- Implement optimistic concurrency control on the Ticket model using the `version` field.

**Directory Structure:**

```bash
/Users/luketchang/code/ticketing/tickets/
├── .dockerignore                 # Specifies files and directories to ignore when building the Docker image.
├── .gitignore                    # Specifies intentionally untracked files that Git should ignore.
├── Dockerfile                    # Defines the steps to build the Docker image for the Tickets service.
├── package.json                  # Lists project dependencies and scripts (e.g., start, test).
├── src/                          # Source code directory.
│   ├── __mocks__/               # Mock implementations used for testing.
│   │   ├── nats-wrapper.ts       # Mock for NATS (likely unused)
│   │   └── rabbitmq-wrapper.ts   # Mock for the RabbitMQ wrapper.
│   ├── app.ts                    # Sets up the Express application, middleware (json, cookieSession, currentUser, errorHandler), and registers route handlers.
│   ├── events/                   # Contains event listeners and publishers.
│   │   ├── listeners/            # Event listeners that react to messages from the message broker.
│   │   │   ├── __test__/         # Tests for event listeners (includes concurrency test for OrderCancelled).
│   │   │   │   ├── order-cancelled-listener.test.ts # Tests OrderCancelledListener.
│   │   │   │   └── order-created-listener.test.ts   # Tests OrderCreatedListener.
│   │   │   ├── order-cancelled-listener.ts # Listens for OrderCancelledEvent to un-reserve a ticket. Extends common RabbitMQListener.
│   │   │   └── order-created-listener.ts   # Listens for OrderCreatedEvent to reserve a ticket. Extends common RabbitMQListener.
│   │   └── publishers/           # Event publishers that send messages to the message broker.
│   │       ├── ticket-created-publisher.ts # Publishes TicketCreatedEvent. Extends common RabbitMQPublisher.
│   │       └── ticket-updated-publisher.ts # Publishes TicketUpdatedEvent. Extends common RabbitMQPublisher.
│   ├── index.ts                  # The main entry point. Connects to DB/RabbitMQ, starts listeners, starts server, initializes tracing. Checks env vars.
│   ├── logger.ts                 # Configures the Winston logger (uses common setup).
│   ├── models/                   # Mongoose models defining the database schema.
│   │   ├── __test__/             # Tests for Mongoose models.
│   │   │   └── ticket.test.ts    # Tests the Ticket model, specifically optimistic concurrency (versioning).
│   │   └── ticket.ts             # Defines the Mongoose schema and model for a Ticket (includes versioning, orderId field).
│   ├── nats-wrapper.ts           # NATS wrapper (appears unused)
│   ├── rabbitmq-wrapper.ts       # Initializes and exports the RabbitMQ wrapper instance (from common).
│   ├── routes/                   # Express route handlers for the API endpoints.
│   │   ├── __test__/             # Tests for API routes using supertest and in-memory DB.
│   │   │   ├── index.test.ts     # Tests GET /api/tickets.
│   │   │   ├── new.test.ts       # Tests POST /api/tickets (includes auth check, validation).
│   │   │   ├── show.test.ts      # Tests GET /api/tickets/:id.
│   │   │   └── update.test.ts    # Tests PUT /api/tickets/:id (includes auth check, reserved check, validation).
│   │   ├── index.ts              # Route handler for GET /api/tickets (list all).
│   │   ├── new.ts                # Route handler for POST /api/tickets (create). Uses requireAuth, validateRequest.
│   │   ├── show.ts               # Route handler for GET /api/tickets/:id (get one).
│   │   └── update.ts             # Route handler for PUT /api/tickets/:id (update). Uses requireAuth, validateRequest. Checks userId and orderId.
│   ├── test/                     # Helper files for integration/route tests.
│   │   ├── createTicket.ts       # Helper to create a ticket via API for tests.
│   │   ├── getAuthCookie.ts      # Helper to generate fake auth cookie for tests.
│   │   └── setup.ts              # Jest setup file (in-memory DB, mock RabbitMQ, JWT key).
│   └── tracer.ts                 # Initializes DataDog tracing.
└── tsconfig.json                 # TypeScript compiler configuration.
```

**Technical Details:**

- Uses `express`, `express-async-errors`, `express-validator`, `mongoose`, `cookie-session`, `mongoose-update-if-current`, `@lt-ticketing/common`, `dd-trace`, `amqplib`.
- `index.ts` connects to MongoDB (`process.env.TICKETS_MONGO_URI`) and RabbitMQ (`process.env.RABBITMQ_URL`) and starts listeners and the Express server.
- `app.ts` uses `currentUser`, `requireAuth`, `validateRequest`, and `errorHandler` middleware from `common`.
- `models/ticket.ts` defines the schema with `title`, `price`, `userId`, `orderId` (optional string), and `version`. It uses `mongoose-update-if-current` for optimistic concurrency.
- Routes (`new`, `update`) use `requireAuth` and `validateRequest`. `update` also checks `ticket.userId === req.currentUser!.id` for authorization and `!ticket.orderId` to prevent updating reserved tickets.
- Listeners (`OrderCreatedListener`, `OrderCancelledListener`) extend `common.RabbitMQListener`, listen on specific routing keys (`Subject.*`) and the `QueueGroupName.TicketsService` queue. Their `onMessage` methods find the ticket by ID, update the `orderId` field (set or clear), save the ticket (triggering version increment), and publish a `TicketUpdatedEvent`. They use `msg.ack()`.
- Publishers (`TicketCreatedPublisher`, `TicketUpdatedPublisher`) extend `common.RabbitMQPublisher` and are used by routes and listeners.
- Tests use `mongodb-memory-server`, `supertest`, and mocks for RabbitMQ. Model tests specifically verify optimistic concurrency. Listener tests verify correct database updates and event publishing.

**Relationship to Broader System:**

- Publishes `TicketCreatedEvent` and `TicketUpdatedEvent` (consumed by the `orders` service via RabbitMQ).
- Consumes `OrderCreatedEvent` and `OrderCancelledEvent` from the `orders` service via RabbitMQ to manage the ticket's `orderId` (reservation status).
- Relies on the `auth` service (via `currentUser` middleware) for user identification.
- Provides API endpoints consumed by the `client`.
- Depends on a dedicated MongoDB instance (`tickets-mongo-depl.yaml`) and RabbitMQ (`rabbitmq-depl.yaml`) managed by `infra/k8s`.
- Uses shared components from the `common` library.
- Integrated with tracing and logging.

---

### 3. End-to-End System Operation Walkthrough: Data Flow and Service Interactions

This section details the flow of data and interactions between components for key user scenarios.

**Scenario 1: User Signup**

1.  **User Action:** User navigates to the signup page (`/auth/signup`) on the **Client**. Fills out the form and clicks submit.
2.  **Client (pages/auth/signup.js):** The form submission triggers the `doRequest` function from the `useRequest` hook. This hook uses the `axios` instance from `api/build-client.js` to send a `POST` request to `/api/users/signup` with the user's email and password in the request body.
3.  **Ingress (infra/k8s/ingress-srv.yaml):** The Ingress controller receives the request. Based on the path `/api/users/*`, it routes the request to the internal Kubernetes Service `auth-srv` on port 3000.
4.  **Auth Service (auth/src/app.ts):**
    - The request hits the Express application.
    - `express.json()` middleware parses the request body.
    - `cookieSession` middleware initializes the session object (`req.session`).
    - `currentUser` middleware runs. Since there's no JWT cookie yet, `req.currentUser` remains `null`.
    - The request is routed to the `routes/signup.ts` handler.
    - `express-validator` checks the email format and password length.
    - `validateRequest` middleware (from `common`) checks the validation results. If errors exist, it throws a `RequestValidationError` (from `common`), which is caught by the `errorHandler` middleware.
    - If validation passes, `User.findOne({ email: ... })` queries the **Auth MongoDB** (`auth-mongo-srv`) to check if a user with that email already exists.
    - If a user exists, a `BadRequestError` ("Email in use") is thrown (from `common`), caught by `errorHandler`.
    - If the email is unique, `User.build({ email, password })` creates a new Mongoose user instance.
    - The `pre('save')` hook in `auth/src/models/user.ts` is triggered. It calls `Password.hashPassword(password)` (from `auth/src/utils/password.ts`) using `scrypt` to generate a salt and hash the password. The hashed password and salt are stored on the user object.
    - `user.save()` persists the new user document to the **Auth MongoDB**.
    - `jwt.sign({ id: user.id, email: user.email }, process.env.JWT_KEY!)` generates a JSON Web Token containing the user's ID and email, signed with the secret key from the `JWT_KEY` environment variable (injected from `services-secrets.yaml` via `infra/k8s`).
    - `req.session = { jwt: userJwt }` sets the JWT in the session object. The `cookieSession` middleware automatically prepares the `Set-Cookie` header with the JWT, configured as HTTP-only and secure (in non-test environments).
    - The route handler sends a `201 Created` response with the user object (password excluded by the `toJSON` transform in the model).
    - Tracing spans are created by `auth/src/tracer.ts` and logs generated by `auth/src/logger.ts` (using `common/logger.ts`).
5.  **Ingress:** Routes the response back to the client.
6.  **Client:** The browser receives the `Set-Cookie` header and stores the cookie. The `useRequest` hook's `onSuccess` callback is triggered, which uses `Router.push('/')` to redirect the user to the landing page.
7.  **Observability:** Tracing spans for the HTTP request are collected by the Datadog Agent/OpenTelemetry Collector. Logs are collected by Grafana Alloy and sent to Loki.

**Scenario 2: Creating a Ticket**

1.  **User Action:** User navigates to the create ticket page (`/tickets/new`) on the **Client**. Fills out the form (title, price) and clicks submit.
2.  **Client (pages/tickets/new.js):** The form submission triggers `doRequest` from `useRequest`. This sends a `POST` request to `/api/tickets` with the ticket data.
3.  **Ingress:** Routes `/api/tickets/*` to the internal Kubernetes Service `tickets-srv` on port 3000.
4.  **Tickets Service (tickets/src/app.ts):**
    - The request hits the Express application.
    - Middleware (`json`, `cookieSession`) run.
    - `currentUser` middleware (from `common`) reads the JWT cookie (sent automatically by the browser), verifies it using `process.env.JWT_KEY`, and sets `req.currentUser` with the user payload (`id`, `email`).
    - `requireAuth` middleware (from `common`) checks if `req.currentUser` is set. If not, it throws a `NotAuthorizedError` (from `common`), handled by `errorHandler`.
    - The request is routed to the `routes/new.ts` handler.
    - `express-validator` checks `title` and `price`.
    - `validateRequest` middleware checks results, throws `RequestValidationError` if needed.
    - `Ticket.build({ title, price, userId: req.currentUser!.id })` creates a new Mongoose ticket instance, associating it with the current user's ID.
    - `ticket.save()` persists the new ticket document to the **Tickets MongoDB** (`tickets-mongo-srv`). The `mongoose-update-if-current` plugin automatically adds and initializes the `version` field to 0.
    - A `TicketCreatedPublisher` instance is created using the `rabbitmqWrapper.channel` (initialized in `index.ts` using `common/messaging/rabbitmq-wrapper.ts`).
    - `publisher.publish({ id: ticket.id, title: ticket.title, price: ticket.price, userId: ticket.userId, version: ticket.version })` sends a `TicketCreatedEvent` message to the RabbitMQ exchange (`ticketing` topic exchange by default from `common`) with the routing key `Subject.TicketCreated`. The `common/tracing.ts` helpers add trace context to the message headers.
    - The route handler sends a `201 Created` response with the created ticket.
    - Tracing spans and logs are generated.
5.  **Ingress:** Routes the response back to the client.
6.  **Client:** The `useRequest` hook's `onSuccess` callback redirects the user to the landing page (`/`).
7.  **Observability:** Tracing spans for the HTTP request and the RabbitMQ publish operation are collected. Logs are collected.

**Scenario 3: Creating an Order (Reserving a Ticket)**

1.  **User Action:** User views a specific ticket page (`/tickets/[ticketId]`) on the **Client**. Clicks the "Purchase" button.
2.  **Client (pages/tickets/[ticketId].js):** The button click triggers `doRequest` from `useRequest`. This sends a `POST` request to `/api/orders` with the `ticketId` in the request body.
3.  **Ingress:** Routes `/api/orders/*` to the internal Kubernetes Service `orders-srv` on port 3000.
4.  **Orders Service (orders/src/app.ts):**
    - The request hits the Express application.
    - Middleware (`json`, `cookieSession`, `currentUser`, `requireAuth`) run. `req.currentUser` is set.
    - The request is routed to the `routes/new.ts` handler.
    - `express-validator` checks `ticketId`. `validateRequest` runs.
    - `Ticket.findById(ticketId)` queries the _local_ Ticket collection in the **Orders MongoDB** (`orders-mongo-srv`). This local copy was created/updated by the `TicketCreatedListener` and `TicketUpdatedListener` in this service.
    - If the local ticket is not found, a `NotFoundError` is thrown.
    - If found, `ticket.isReserved()` is called. This method queries the _local_ Order collection in **Orders MongoDB** to see if any existing order references this ticket ID and has a status other than `Cancelled` or `Complete`.
    - If `isReserved()` returns true, a `BadRequestError` ("Ticket is already reserved") is thrown.
    - If the ticket is available, the expiration time is calculated (`new Date()` + 15 minutes, or a fixed duration like 30 seconds as seen in the code).
    - `Order.build({ userId: req.currentUser!.id, status: OrderStatus.Created, expiresAt: expiration, ticket: ticket })` creates a new Mongoose order instance, linking it to the user and the local ticket document.
    - `order.save()` persists the new order document to the **Orders MongoDB**. The `mongoose-update-if-current` plugin initializes the `version` field to 0.
    - An `OrderCreatedPublisher` instance is created using `rabbitmqWrapper.channel`.
    - `publisher.publish({ id: order.id, status: order.status, userId: order.userId, expiresAt: order.expiresAt.toISOString(), version: order.version, ticket: { id: ticket.id, price: ticket.price } })` sends an `OrderCreatedEvent` message to RabbitMQ with the routing key `Subject.OrderCreated`. Trace context is added to headers.
    - The route handler sends a `201 Created` response with the created order.
    - Tracing spans and logs are generated.
5.  **Ingress:** Routes the response back to the client.
6.  **Client:** The `useRequest` hook's `onSuccess` callback redirects the user to the order detail page (`/orders/:orderId`).
7.  **Observability:** Tracing spans for the HTTP request and the RabbitMQ publish are collected. Logs are collected.

**Scenario 3a: Event Flow triggered by OrderCreatedEvent**

1.  **RabbitMQ:** Receives the `OrderCreatedEvent` published by the Orders service. It routes the message to queues bound to the `Subject.OrderCreated` routing key.
2.  **Expiration Service (expiration/src/index.ts):**
    - The `OrderCreatedListener` (`expiration/src/events/listeners/order-created-listener.ts`), which is consuming messages from the `QueueGroupName.ExpirationService` queue bound to `Subject.OrderCreated`, receives the message. A consumer span is created by the `common.RabbitMQListener` base class, linked to the producer span via trace context in headers.
    - The `onMessage` method is executed. It extracts `orderId` and `expiresAt` from the event data.
    - It calculates the `delay` in milliseconds (`expiresAt` - current time).
    - `expirationQueue.add({ orderId: data.id }, { delay: delay })` adds a delayed job to the Bull queue (`expiration/src/queues/expiration-queue.ts`) backed by **Expiration Redis** (`expiration-redis-srv`).
    - The `common.RabbitMQListener` base class calls `msg.ack()` to acknowledge the message to RabbitMQ.
    - Tracing spans and logs are generated for message consumption and job scheduling.
3.  **Payments Service (payments/src/index.ts):**
    - The `OrderCreatedListener` (`payments/src/events/listeners/order-created-listener.ts`), consuming from `QueueGroupName.PaymentsService` bound to `Subject.OrderCreated`, receives the message. A consumer span is created.
    - The `onMessage` method is executed. It extracts relevant order data (`id`, `price`, `userId`, `version`).
    - `Order.build({ id: data.id, price: data.ticket.price, userId: data.userId, status: data.status, version: data.version })` creates a _local_ order document in the **Payments MongoDB** (`payments-mongo-srv`).
    - `order.save()` persists this local copy.
    - The `common.RabbitMQListener` base class calls `msg.ack()`.
    - Tracing spans and logs are generated.
4.  **Tickets Service (tickets/src/index.ts):**
    - The `OrderCreatedListener` (`tickets/src/events/listeners/order-created-listener.ts`), consuming from `QueueGroupName.TicketsService` bound to `Subject.OrderCreated`, receives the message. A consumer span is created.
    - The `onMessage` method is executed. It finds the ticket in the **Tickets MongoDB** (`tickets-mongo-srv`) using `Ticket.findById(data.ticket.id)`.
    - If found, it sets `ticket.set({ orderId: data.id })`.
    - `ticket.save()` updates the ticket document. The `mongoose-update-if-current` plugin increments the `version`.
    - A `TicketUpdatedPublisher` is created.
    - `publisher.publish({ id: ticket.id, title: ticket.title, price: ticket.price, userId: ticket.userId, orderId: ticket.orderId, version: ticket.version })` sends a `TicketUpdatedEvent` to RabbitMQ with routing key `Subject.TicketUpdated`. Producer span created.
    - The `common.RabbitMQListener` base class calls `msg.ack()`.
    - Tracing spans and logs are generated.
5.  **Scenario 3b: Event Flow triggered by TicketUpdatedEvent (from OrderCreated)**
    - **RabbitMQ:** Receives the `TicketUpdatedEvent` published by the Tickets service. It routes the message to queues bound to the `Subject.TicketUpdated` routing key.
    - **Orders Service:** The `TicketUpdatedListener` (`orders/src/events/listeners/ticket-updated-listener.ts`), consuming from `QueueGroupName.OrdersService` bound to `Subject.TicketUpdated`, receives the message. Consumer span created.
      - The `onMessage` method is executed. It finds the _local_ ticket copy in **Orders MongoDB** using `Ticket.findByEvent({ id: data.id, version: data.version })`. This method specifically looks for the ticket by ID and the _previous_ version (`data.version - 1`) to ensure events are processed in order.
      - If found, it updates the local ticket's `title` and `price`.
      - `ticket.save()` updates the local ticket document, incrementing its version.
      - The `common.RabbitMQListener` base class calls `msg.ack()`.
      - Tracing spans and logs are generated.

**Scenario 4: Order Expiration**

1.  **Expiration Service (expiration/src/queues/expiration-queue.ts):** After the calculated delay has passed, the Bull queue worker (running within the Expiration service pod) retrieves the job from **Expiration Redis**.
2.  The `process` handler for the `"order:expiration"` queue is executed. It receives the job data, which contains the `orderId`.
3.  An `ExpirationCompletePublisher` is created.
4.  `publisher.publish({ orderId: job.data.orderId })` sends an `ExpirationCompleteEvent` message to RabbitMQ with the routing key `Subject.ExpirationComplete`. Producer span created.
5.  Tracing spans and logs are generated.
6.  **RabbitMQ:** Receives the `ExpirationCompleteEvent`. It routes the message to queues bound to the `Subject.ExpirationComplete` routing key.
7.  **Orders Service (orders/src/index.ts):**
    - The `ExpirationCompleteListener` (`orders/src/events/listeners/expiration-complete-listener.ts`), consuming from `QueueGroupName.OrdersService` bound to `Subject.ExpirationComplete`, receives the message. Consumer span created.
    - The `onMessage` method is executed. It finds the order in the **Orders MongoDB** using `Order.findById(data.orderId)`.
    - If the order is not found or its status is already `Complete`, it logs a message and acknowledges.
    - If found and not `Complete`, it sets `order.status = OrderStatus.Cancelled`.
    - `order.save()` updates the order document, incrementing its version.
    - An `OrderCancelledPublisher` is created.
    - `publisher.publish({ id: order.id, version: order.version, ticket: { id: order.ticket.id } })` sends an `OrderCancelledEvent` message to RabbitMQ with routing key `Subject.OrderCancelled`. Producer span created.
    - The `common.RabbitMQListener` base class calls `msg.ack()`.
    - Tracing spans and logs are generated.
8.  **Scenario 4a: Event Flow triggered by OrderCancelledEvent (from Expiration)**
    - **RabbitMQ:** Receives the `OrderCancelledEvent` published by the Orders service. It routes the message to queues bound to the `Subject.OrderCancelled` routing key.
    - **Tickets Service (tickets/src/index.ts):**
      - The `OrderCancelledListener` (`tickets/src/events/listeners/order-cancelled-listener.ts`), consuming from `QueueGroupName.TicketsService` bound to `Subject.OrderCancelled`, receives the message. Consumer span created.
      - The `onMessage` method is executed. It finds the ticket in the **Tickets MongoDB** using `Ticket.findById(data.ticket.id)`.
      - If found, it sets `ticket.set({ orderId: undefined })`.
      - `ticket.save()` updates the ticket document, incrementing its version.
      - A `TicketUpdatedPublisher` is created.
      - `publisher.publish({ id: ticket.id, title: ticket.title, price: ticket.price, userId: ticket.userId, orderId: ticket.orderId, version: ticket.version })` sends a `TicketUpdatedEvent` to RabbitMQ with routing key `Subject.TicketUpdated`. Producer span created.
      - The `common.RabbitMQListener` base class calls `msg.ack()`.
      - Tracing spans and logs are generated.
    - **Payments Service (payments/src/index.ts):**
      - The `OrderCancelledListener` (`payments/src/events/listeners/order-cancelled-listener.ts`), consuming from `QueueGroupName.PaymentsService` bound to `Subject.OrderCancelled`, receives the message. Consumer span created.
      - The `onMessage` method is executed. It finds the _local_ order copy in **Payments MongoDB** using `Order.findByEvent({ id: data.id, version: data.version })`.
      - If found, it sets `order.status = OrderStatus.Cancelled`.
      - `order.save()` updates the local order document, incrementing its version.
      - The `common.RabbitMQListener` base class calls `msg.ack()`.
      - Tracing spans and logs are generated.

**Scenario 5: Paying for an Order**

1.  **User Action:** User views an order detail page (`/orders/[orderId]`) on the **Client**. If the order is not expired, the Stripe checkout form is displayed. User enters payment details and submits.
2.  **Client (pages/orders/[orderId].js):** The Stripe client-side library interacts with Stripe to get a payment token. The `react-stripe-checkout` component's `token` callback is triggered. This callback uses `doRequest` from `useRequest` to send a `POST` request to `/api/payments` with the `orderId` and the Stripe `token`.
3.  **Ingress:** Routes `/api/payments/*` to the internal Kubernetes Service `payments-srv` on port 3000.
4.  **Payments Service (payments/src/app.ts):**
    - The request hits the Express application.
    - Middleware (`json`, `cookieSession`, `currentUser`, `requireAuth`) run. `req.currentUser` is set.
    - The request is routed to the `routes/new.ts` handler.
    - `express-validator` checks `token` and `orderId`. `validateRequest` runs.
    - `Order.findById(orderId)` queries the _local_ Order collection in the **Payments MongoDB** (`payments-mongo-srv`).
    - If the local order is not found, a `NotFoundError` is thrown.
    - If found, it checks `order.userId === req.currentUser!.id` for authorization. If not authorized, a `NotAuthorizedError` is thrown.
    - It checks `order.status !== OrderStatus.Cancelled`. If the order is cancelled, a `BadRequestError` ("Cannot pay for a cancelled order") is thrown.
    - `stripe.charges.create({ amount: order.price * 100, currency: 'usd', source: token.id, description: 'Payment for ticket order' })` is called using the Stripe client (`payments/src/stripe.ts`) initialized with `process.env.STRIPE_KEY`. This makes an API call to the external **Stripe API**.
    - If the Stripe charge is successful, `Payment.build({ orderId: order.id, stripeId: charge.id })` creates a new Mongoose payment instance.
    - `payment.save()` persists the payment document to the **Payments MongoDB**.
    - A `PaymentCreatedPublisher` is created.
    - `publisher.publish({ id: payment.id, orderId: payment.orderId, stripeId: payment.stripeId })` sends a `PaymentCreatedEvent` message to RabbitMQ with the routing key `Subject.PaymentCreated`. Producer span created.
    - The route handler sends a `201 Created` response with the created payment.
    - Tracing spans (including the external call to Stripe) and logs are generated.
5.  **Ingress:** Routes the response back to the client.
6.  **Client:** The `useRequest` hook's `onSuccess` callback redirects the user to the orders list page (`/orders`).
7.  **Observability:** Tracing spans for the HTTP request, the Stripe API call, and the RabbitMQ publish are collected. Logs are collected.

**Scenario 5a: Event Flow triggered by PaymentCreatedEvent**

1.  **RabbitMQ:** Receives the `PaymentCreatedEvent` published by the Payments service. It routes the message to queues bound to the `Subject.PaymentCreated` routing key.
2.  **Orders Service (orders/src/index.ts):**
    - The `PaymentCreatedListener` (`orders/src/events/listeners/payment-created-listener.ts`), consuming from `QueueGroupName.OrdersService` bound to `Subject.PaymentCreated`, receives the message. Consumer span created.
    - The `onMessage` method is executed. It finds the order in the **Orders MongoDB** using `Order.findById(data.orderId)`.
    - If the order is not found, it logs a warning and acknowledges.
    - If found, it sets `order.status = OrderStatus.Complete`.
    - `order.save()` updates the order document, incrementing its version.
    - The `common.RabbitMQListener` base class calls `msg.ack()`.
    - Tracing spans and logs are generated.
    - _Note:_ If an `ExpirationCompleteEvent` for this order arrives _after_ this listener has marked the order as `Complete`, the `ExpirationCompleteListener` in the Orders service is designed to check the status and will not cancel an already completed order.

**Scenario 6: Viewing User's Orders**

1.  **User Action:** User navigates to the orders list page (`/orders`) on the **Client**.
2.  **Client (pages/orders/index.js):** The `getInitialProps` function is called (SSR or client-side). It uses `build-client.js` to send a `GET` request to `/api/orders`.
3.  **Ingress:** Routes `/api/orders/*` to the internal Kubernetes Service `orders-srv` on port 3000.
4.  **Orders Service (orders/src/app.ts):**
    - The request hits the Express application.
    - Middleware (`json`, `cookieSession`, `currentUser`, `requireAuth`) run. `req.currentUser` is set.
    - The request is routed to the `routes/index.ts` handler.
    - `Order.find({ userId: req.currentUser!.id }).populate('ticket')` queries the **Orders MongoDB** to find all orders belonging to the current user. The `.populate('ticket')` call fetches the associated _local_ ticket document details (title, price, etc.) and embeds them in the order results.
    - The route handler sends a `200 OK` response with the array of orders.
    - Tracing spans and logs are generated.
5.  **Ingress:** Routes the response back to the client.
6.  **Client:** The `getInitialProps` function receives the order data and passes it as props to the `pages/orders/index.js` component, which renders the list.
7.  **Observability:** Tracing spans and logs are collected.

These scenarios illustrate the core interactions: synchronous HTTP requests from the client via Ingress to specific services, authentication/authorization using shared middleware and JWTs, persistence in dedicated databases, and asynchronous communication between backend services via RabbitMQ events, leveraging shared libraries for consistency and observability. The event-driven approach allows services to react to changes in other domains without tight coupling, promoting resilience and scalability. The use of optimistic concurrency (`mongoose-update-if-current`) in event listeners is critical for handling potential out-of-order message processing in a distributed system.
