Okay, here is a comprehensive, technically detailed codebase walkthrough of the ticketing microservices system, based on the provided component analyses.

# Ticketing Microservices Codebase Walkthrough

## System Overview

The Ticketing Microservices system is a distributed application designed for buying and selling event tickets online. It is built as a collection of small, autonomous services that communicate primarily asynchronously via an event bus (NATS Streaming Server) and synchronously via RESTful APIs exposed through an API Gateway (Kubernetes Ingress). The system is deployed on Kubernetes, leveraging its orchestration capabilities for scaling, resilience, and service discovery.

**Purpose:** To provide a platform for users to list, browse, order, and pay for event tickets.

**Architecture:**

- **Microservices:** The system is composed of several independent services (Auth, Tickets, Orders, Payments, Expiration), each responsible for a specific domain and having its own database.
- **Event-Driven Architecture (EDA):** Services communicate asynchronously by publishing and subscribing to events on a NATS Streaming Server. This decouples services, improves resilience, and enables reactive behavior.
- **RESTful APIs:** Services expose APIs for client interaction and some synchronous service-to-service calls (though minimal in this design, primarily client-to-service via Ingress).
- **API Gateway (Ingress):** A single entry point for external traffic, routing requests to the appropriate backend service based on path.
- **Shared Library (`@lt-ticketing/common`):** Contains reusable code for cross-cutting concerns like error handling, authentication middleware, and event bus contracts, ensuring consistency across services.
- **Databases:** Each stateful service uses its own MongoDB instance. The Expiration service uses Redis for its queue.
- **Container Orchestration:** Deployed and managed using Kubernetes.
- **Observability:** Integrated logging (Winston), tracing (Datadog), and metrics collection.

**Key Components:**

- **Auth Service:** Handles user authentication (signup, signin, signout) and issues JWTs.
- **Client:** A Next.js frontend application providing the user interface.
- **Common Library:** Shared code for errors, middleware, and event definitions.
- **Expiration Service:** Monitors order expiration deadlines using a queue and publishes events when orders expire.
- **Infra (Kubernetes):** Defines the deployment and configuration of all services, databases, NATS, Ingress, and monitoring agents.
- **NATS-Test:** A utility directory for testing NATS communication patterns in isolation.
- **Orders Service:** Manages the lifecycle of user orders, tracks ticket reservations, and reacts to payment and expiration events.
- **Payments Service:** Processes payments via Stripe and records payment details, reacting to order creation/cancellation events.
- **Tickets Service:** Manages ticket listings, tracks ticket availability (reserved status), and publishes ticket creation/update events.

---

## Component Analyses

### Auth Service (`auth/`)

The `auth` service is responsible for user authentication and authorization. It provides API endpoints for user registration, login, and logout, and manages user sessions using JWTs stored in HTTP-only cookies.

**Purpose:** To manage user accounts and authenticate users for access to the system.

**Architecture:** Express.js application, Mongoose for MongoDB interaction, JWT for stateless authentication, Cookie-Session middleware, uses `@lt-ticketing/common` for shared logic.

**Key Responsibilities:** User signup, signin, signout, current user lookup, password hashing, JWT generation and validation.

```
auth/
  src/
    app.ts                  # Main Express application setup, middleware configuration, and route mounting.
    index.ts                # Entry point: connects to MongoDB, checks environment variables, starts the server.
    models/
      user.ts               # Mongoose model and schema definition for the User entity, including password hashing logic.
    routes/
      __test__/             # Integration tests for the authentication routes.
        current-user.test.ts # Tests for the current user endpoint.
        signin.test.ts      # Tests for the signin endpoint.
        signout.test.ts     # Tests for the signout endpoint.
        signup.test.ts      # Tests for the signup endpoint.
      currentuser.ts        # Route handler for GET /api/users/currentuser.
      signin.ts             # Route handler for POST /api/users/signin.
      signout.ts            # Route handler for POST /api/users/signout.
      signup.ts             # Route handler for POST /api/users/signup.
    test/
      getAuthCookie.ts      # Helper function for tests to get an authentication cookie by signing up a user.
      setup.ts              # Jest test setup file: configures environment, sets up in-memory MongoDB, clears database before tests.
    tracer.ts               # Initializes Datadog tracing.
    utils/
      password.ts           # Utility class for securely hashing and comparing passwords using scrypt.
```

**Implementation Details:**

- Uses `express-validator` for input validation and `validateRequest` middleware from `common`.
- Securely hashes passwords using `scrypt` via the `Password` utility class.
- Generates JWTs signed with `process.env.JWT_KEY` upon successful authentication.
- Stores the JWT in `req.session.jwt`, which `cookie-session` automatically manages as an HTTP-only cookie.
- The `currentUser` middleware from `common` reads and verifies the JWT from the cookie on subsequent requests to _any_ service using the same `JWT_KEY`.
- Uses `NotFoundError`, `BadRequestError`, and `errorHandler` from `common` for consistent error responses.

### Client Component (`client/`)

The `client` directory contains the Next.js frontend application, providing the user interface and interacting with the backend microservices via HTTP requests routed through the Ingress controller.

**Purpose:** To serve as the user-facing interface for the ticketing system.

**Architecture:** Next.js framework, React components, `axios` for API calls, custom `use-request` hook for API interaction logic, `build-client` helper for SSR/CSR API endpoint handling.

**Key Responsibilities:** Rendering UI, handling user input, making API calls, displaying data and errors, client-side routing.

```
client/
  api/
    build-client.js         # Helper to create an Axios instance, handling server-side vs. client-side requests.
  components/
    header.js               # Reusable navigation header component.
  hooks/
    use-request.js          # Custom React hook for making API requests and handling errors.
  next.config.js              # Next.js configuration file (sets up polling for dev).
  pages/                      # Directory for Next.js pages (routes).
    _app.js                 # Custom App component, wraps all pages, fetches currentUser, imports global CSS.
    auth/                   # Authentication related pages.
      signin.js           # Sign In page component.
      signout.js          # Sign Out page component.
      signup.js           # Sign Up page component.
    banana.js               # Example/Test page (likely not part of core app).
    index.js                # Landing page, displays list of tickets.
    orders/                 # Order related pages.
      [orderId].js        # Dynamic route for displaying a single order and handling payment.
      index.js                # Page displaying a list of the current user's orders.
    tickets/                # Ticket related pages.
      [ticketId].js       # Dynamic route for displaying a single ticket and initiating an order.
      new.js                  # Page for creating a new ticket.
```

**Implementation Details:**

- `_app.js` uses `getInitialProps` and `build-client.js` to fetch `currentUser` on every page load (both server-side and client-side), passing authentication status down as a prop.
- `build-client.js` dynamically sets the API base URL based on whether the code is running on the server (using internal Ingress service name) or in the browser (using relative path `/`). It passes original request headers (including cookies) during SSR.
- `use-request.js` simplifies API calls, handles loading/error states, and displays validation errors from backend services.
- Pages like `signup.js`, `signin.js`, `new.js` (ticket), `[ticketId].js` (order creation), and `[orderId].js` (payment) use `use-request` to interact with backend APIs.
- `[orderId].js` integrates `react-stripe-checkout` for payment form and token generation.

### Common Library (`common/`)

The `common` directory is a shared Node.js/TypeScript library containing reusable code components used across multiple microservices.

**Purpose:** To provide standardized error handling, middleware, and event bus communication patterns.

**Architecture:** A standard library package imported as a dependency by other services.

**Key Responsibilities:** Define custom errors, provide Express middleware (authentication, validation, error handling), define NATS event subjects and data interfaces, provide base classes for NATS publishers and listeners, configure shared logging.

```
common/
  src/
    errors/
      bad-request-error.ts             # Custom error for 400 Bad Request responses.
      custom-error.ts                  # Abstract base class for all custom application errors. Defines statusCode and serializeErrors method.
      database-connection-error.ts     # Custom error for 500 Database Connection errors.
      not-authorized-error.ts          # Custom error for 401 Unauthorized responses.
      not-found-error.ts               # Custom error for 404 Not Found responses.
      request-validation-error.ts      # Custom error for 400 Bad Request due to request validation failures (from express-validator).
    events/
      base-event.ts                    # Interface defining the basic structure of a NATS event (subject and data).
      base-listener.ts                 # Abstract base class for NATS event listeners. Handles subscription setup, message parsing, and acknowledgment.
      base-publisher.ts                # Abstract base class for NATS event publishers. Handles message serialization and publishing.
      expiration-complete-event.ts     # Interface for the 'expiration:complete' event data.
      order-cancelled-event.ts         # Interface for the 'order:cancelled' event data.
      order-created-event.ts           # Interface for the 'order:created' event data.
      payment-created-event.ts         # Interface for the 'payment:created' event data.
      subject.ts                       # Enum defining all possible NATS event subjects (channel names).
      ticket-created-event.ts          # Interface for the 'ticket:created' event data.
      ticket-updated-event.ts          # Interface for the 'ticket:updated' event data.
    types/
      order-status.ts                # Enum defining possible order statuses.
      queue-group-names.ts           # Enum defining standard NATS queue group names for different services.
    index.ts                           # Main entry point, exporting all public components from the library.
    logger.ts                          # Configures and exports a shared Winston logger instance.
    middlewares/
      current-user.ts                  # Express middleware to extract and verify JWT from session, attaching user payload to req.currentUser.
      error-handler.ts                 # Express middleware to handle errors, specifically CustomError instances, and send standardized responses.
      require-auth.ts                  # Express middleware to check if req.currentUser is set, throwing NotAuthorizedError if not.
      validate-request.ts              # Express middleware to check for express-validator errors, throwing RequestValidationError if found.
```

**Implementation Details:**

- `CustomError` provides a base for consistent error responses (`statusCode`, `serializeErrors`).
- `errorHandler` middleware catches `CustomError` instances and formats the response.
- `currentUser` middleware decodes JWT from cookie and populates `req.currentUser`.
- `requireAuth` middleware checks for `req.currentUser` and throws `NotAuthorizedError` if missing.
- `validateRequest` middleware checks `express-validator` results and throws `RequestValidationError`.
- `Subject` enum defines NATS topics. Event interfaces define data payloads.
- `BaseListener` and `BasePublisher` abstract classes handle NATS client interactions (connecting, subscribing, publishing, acknowledging) and message serialization/deserialization.
- `QueueGroupName` enum defines standard queue groups for listeners.

### Expiration Service (`expiration/`)

The `expiration` service is a background worker responsible for monitoring order expiration deadlines and triggering events when they are reached.

**Purpose:** To ensure orders that are not paid within a time limit are cancelled.

**Architecture:** Node.js application, listens to NATS events, uses Bull queue backed by Redis for delayed job scheduling, publishes NATS events.

**Key Responsibilities:** Listen for `order:created` events, schedule expiration jobs, publish `expiration:complete` events when jobs process.

```
expiration/
  src/
    __mocks__/
      nats-wrapper.ts             # Mock NATS wrapper for testing purposes.
    events/
      listeners/
        order-created-listener.ts # Listens for OrderCreated events from the Orders service.
      publishers/
        expiration-complete-publisher.ts # Publishes ExpirationComplete events.
    index.ts                      # Application entry point, NATS connection, listener setup.
    logger.ts                     # Centralized logging configuration using Winston.
    nats-wrapper.ts               # Singleton wrapper for the NATS Streaming client.
    queues/
      expiration-queue.ts         # Defines the Bull queue for scheduling expiration jobs.
    tracer.ts                     # Initializes Datadog tracing.
```

**Implementation Details:**

- Connects to NATS using `natsWrapper` and subscribes to `order:created` via `OrderCreatedListener`.
- `OrderCreatedListener` calculates the delay until the order's `expiresAt` time.
- Uses the `expirationQueue` (Bull, connected to Redis) to add a job with the order ID and the calculated delay (`expirationQueue.add({ orderId }, { delay })`).
- The `expirationQueue.process` worker function is executed when a job's delay is met.
- The worker instantiates `ExpirationCompletePublisher` and publishes an `expiration:complete` event with the `orderId`.
- Uses `QueueGroupName.ExpirationService` for the listener to ensure queue group semantics.

### Infrastructure Definition (`infra/k8s/`)

This directory contains Kubernetes YAML manifests defining the deployment and configuration of all components in the cluster.

**Purpose:** To declare the desired state of the system's infrastructure for Kubernetes orchestration.

**Architecture:** Kubernetes Deployments, Services (ClusterIP), Ingress, StatefulSets (for databases, NATS), ConfigMaps, RBAC, Observability agents (Datadog, Grafana Alloy).

**Key Responsibilities:** Define service replicas, container images, environment variables, internal networking (Services), external routing (Ingress), persistent storage (databases), message broker (NATS), monitoring/logging setup.

```yaml
k8s/
  alloy-config.yaml           # Defines a ConfigMap for Grafana Alloy's configuration (log collection rules)
  alloy-depl.yaml             # Defines the Deployment for the Grafana Alloy log collector agent
  alloy-rbac.yaml             # Defines ClusterRole and ClusterRoleBinding for Grafana Alloy to access pod logs
  auth-depl.yaml              # Defines the Deployment and ClusterIP Service for the 'auth' microservice
  auth-mongo-depl.yaml        # Defines the Deployment and ClusterIP Service for the 'auth' service's MongoDB database
  client-depl.yaml            # Defines the Deployment and ClusterIP Service for the 'client' (Next.js frontend)
  datadog-agent.yaml          # Defines the DatadogAgent custom resource for cluster-wide monitoring (logs, APM)
  debug-pod.yaml              # A simple Pod definition for debugging purposes (e.g., running curl)
  expiration-depl.yaml        # Defines the Deployment for the 'expiration' microservice
  expiration-redis-depl.yaml  # Defines the Deployment and ClusterIP Service for the 'expiration' service's Redis instance
  ingress-srv.yaml            # Defines the Ingress resource to route external traffic to internal services
  nats-depl.yaml              # Defines the Deployment and ClusterIP Service for the NATS Streaming Server
  orders-depl.yaml            # Defines the Deployment and ClusterIP Service for the 'orders' microservice
  orders-mongo-depl.yaml      # Defines the Deployment and ClusterIP Service for the 'orders' service's MongoDB database
  payments-depl.yaml          # Defines the Deployment and ClusterIP Service for the 'payments' microservice
  payments-mongo-depl.yaml    # Defines the Deployment and ClusterIP Service for the 'payments' service's MongoDB database
  tickets-depl.yaml           # Defines the Deployment and ClusterIP Service for the 'tickets' microservice
  tickets-mongo-depl.yaml     # Defines the Deployment and ClusterIP Service for the 'tickets' service's MongoDB database
```

**Implementation Details:**

- Each service has a Deployment (defining pods) and a ClusterIP Service (internal DNS and load balancing).
- Databases (MongoDB, Redis) and NATS are deployed as StatefulSets or Deployments with persistent storage considerations (though not fully detailed in these YAMLs, the concept is implied).
- Environment variables (`MONGO_URI`, `NATS_URL`, `JWT_KEY`, `STRIPE_KEY`, etc.) are passed to containers, often referencing internal Service names (e.g., `auth-mongo-srv`) or Kubernetes Secrets.
- `ingress-srv.yaml` routes traffic from `ticketing.dev` based on paths (`/api/users`, `/api/tickets`, etc.) to the corresponding internal Services.
- Observability agents (Datadog, Alloy) are configured to collect logs, metrics, and traces from the cluster.

### NATS Test Utility (`nats-test/`)

This directory contains simple, standalone scripts to demonstrate and test the NATS Streaming publish/subscribe pattern using the shared `common` library components.

**Purpose:** To provide isolated examples of NATS event publishing and listening.

**Architecture:** Simple Node.js scripts using `node-nats-streaming` and `@lt-ticketing/common` event base classes.

**Key Responsibilities:** Connect to NATS, publish a sample event, listen for a sample event, demonstrate queue groups and acknowledgments.

```
nats-test/
  src/
    events/
      ticket-created-listener.ts  # Defines the specific logic for handling a TicketCreated event
      ticket-created-publisher.ts # Defines the specific publisher for the TicketCreated event
    listener.ts                 # Main script to run the NATS listener client
    publisher.ts                # Main script to run the NATS publisher client
```

**Implementation Details:**

- `publisher.ts` connects to NATS and uses `TicketCreatedPublisher` (extending `common/BasePublisher`) to send a hardcoded `ticket:created` event.
- `listener.ts` connects to NATS and uses `TicketCreatedListener` (extending `common/BaseListener`) to subscribe to `ticket:created` with a queue group (`'payments-service'`). Its `onMessage` method logs the received data and calls `msg.ack()`.
- This is a testing/demonstration module, not part of the deployed application services.

### Orders Service (`orders/`)

The `orders` service manages the lifecycle of user orders for tickets. It handles order creation, retrieval, and cancellation, and tracks ticket reservation status by reacting to events.

**Purpose:** To manage user orders and their state transitions.

**Architecture:** Express.js application, Mongoose for MongoDB, event listeners and publishers for NATS, uses `@lt-ticketing/common` for shared logic, uses `mongoose-update-if-current` for optimistic concurrency.

**Key Responsibilities:** Create, view, cancel orders; maintain local ticket cache; check ticket reservation status; react to ticket, expiration, and payment events; publish order events.

```
orders/
  src/
    __mocks__/
      nats-wrapper.ts             # Mock NATS client for testing
    app.ts                          # Express application setup and middleware
    events/
      listeners/                  # NATS event listeners (consumers)
        __test__/               # Tests for listeners
          expiration-complete-listener.test.ts # Test for ExpirationComplete listener
          ticket-created-listener.test.ts    # Test for TicketCreated listener
          ticket-updated-listener.test.ts    # Test for TicketUpdated listener
        expiration-complete-listener.ts  # Listens for ExpirationComplete events
        payment-created-listener.ts      # Listens for PaymentCreated events
        ticket-updated-listener.ts       # Listens for TicketUpdated events
      publishers/                 # NATS event publishers (producers)
        order-cancelled-publisher.ts     # Publishes OrderCancelled events
        order-created-publisher.ts       # Publishes OrderCreated events
    index.ts                        # Application entry point, connects to DB/NATS, starts listeners/server
    logger.ts                       # Winston logger configuration
    models/                         # Mongoose models
      order.ts                    # Defines the Order schema and model
      ticket.ts                   # Defines the local Ticket schema and model (denormalized)
    nats-wrapper.ts                 # Singleton wrapper for NATS client connection
    routes/                         # Express route handlers
      __test__/                   # Tests for routes
        delete.test.ts          # Test for DELETE /api/orders/:orderId
        index.test.ts           # Test for GET /api/orders
        new.test.ts             # Test for POST /api/orders
        show.test.ts            # Test for GET /api/orders/:orderId
      delete.ts                   # Route to cancel an order
      index.ts                      # Route to list user's orders
      new.ts                        # Route to create a new order
      show.ts                       # Route to get a specific order
    test/                           # Test helper functions and setup
      createOrder.ts              # Helper to create an order via API for tests
      createTicket.ts             # Helper to create a local ticket in DB for tests
      getAuthCookie.ts              # Helper to generate a fake auth cookie for tests
      setup.ts                      # Jest setup file (in-memory DB, NATS mock)
    tracer.ts                       # Datadog tracing initialization
```

**Implementation Details:**

- Maintains a local `Ticket` model (denormalized copy) updated via `ticket:created` and `ticket:updated` events. This local copy includes the `version` field for optimistic concurrency.
- The local `Ticket` model has an `isReserved()` instance method that queries the local `Order` collection.
- The `POST /api/orders` route checks `isReserved()` before creating an order.
- Orders have a status (`OrderStatus` enum from `common`) and an `expiresAt` timestamp.
- Uses `mongoose-update-if-current` plugin on the `Order` model for optimistic concurrency.
- Listens for `expiration:complete` to cancel expired orders (if not already paid).
- Listens for `payment:created` to mark orders as `Complete`.
- Publishes `order:created` and `order:cancelled` events.
- Uses `requireAuth` middleware from `common` to protect routes.

### Payments Service (`payments/`)

The `payments` service handles processing payments for orders using the Stripe API and records successful payments.

**Purpose:** To process payments and record payment details.

**Architecture:** Express.js application, Mongoose for MongoDB, event listeners and publishers for NATS, uses `@lt-ticketing/common` for shared logic, integrates with Stripe API, uses `mongoose-update-if-current` on local Order model.

**Key Responsibilities:** Listen for order events to maintain local cache, receive payment requests, validate requests, interact with Stripe API to create charges, save payment records, publish `payment:created` events.

```
payments/
  src/
    __mocks__/
      nats-wrapper.ts           # Mock NATS client for testing
      stripe.ts                 # Mock Stripe client for testing
    app.ts                      # Express application setup, middleware, and route mounting
    events/                     # NATS event listeners and publishers
      listeners/                # Consumers of NATS events
        __test__/               # Tests for listeners
          order-cancelled-listener.test.ts # Test for OrderCancelledListener
          order-created-listener.test.ts # Test for OrderCreatedListener
        order-cancelled-listener.ts # Listens for 'order:cancelled' events
        order-created-listener.ts # Listens for 'order:created' events
      publishers/               # Producers of NATS events
        payment-created-publisher.ts # Publishes 'payment:created' events
    index.ts                    # Service entry point: connects to DB/NATS, starts listeners/server
    logger.ts                   # Winston logger configuration
    models/                     # Mongoose models
      order.ts                  # Mongoose model for local Order cache (denormalized)
      payment.ts                # Mongoose model for Payment records
    nats-wrapper.ts             # Singleton wrapper for NATS client connection
    routes/                     # Express route handlers
      __test__/                 # Tests for routes
        new.test.ts             # Tests for the POST /api/payments route
      new.ts                    # Handles POST /api/payments route (payment creation)
    stripe.ts                   # Initializes the Stripe client
    test/                       # Test helper files
      createTicket.ts           # Helper to create a ticket (likely leftover/copied from tickets service)
      getAuthCookie.ts          # Helper to generate a test authentication cookie
      setup.ts                  # Jest setup file: in-memory MongoDB, NATS mock
    tracer.ts                   # Datadog tracing initialization
```

**Implementation Details:**

- Maintains a local `Order` model (denormalized cache) updated via `order:created` and `order:cancelled` events. This local copy includes `userId`, `price`, `status`, and `version`.
- Uses `mongoose-update-if-current` plugin on the local `Order` model for optimistic concurrency when processing events.
- The `POST /api/payments` route (`routes/new.ts`) receives `orderId` and Stripe `token`.
- It validates the order against its local cache (exists, belongs to user, not cancelled).
- It calls `stripe.charges.create` using the order's price.
- Saves a `Payment` document (linking `orderId` and `stripeId`).
- Publishes a `payment:created` event.
- Uses `requireAuth` middleware from `common`.

### Tickets Service (`tickets/`)

The `tickets` service manages the creation, listing, viewing, and updating of event tickets. It also tracks whether a ticket is reserved by an active order.

**Purpose:** To manage ticket listings and availability.

**Architecture:** Express.js application, Mongoose for MongoDB, event listeners and publishers for NATS, uses `@lt-ticketing/common` for shared logic, uses `mongoose-update-if-current` for optimistic concurrency.

**Key Responsibilities:** Create, list, view, update tickets; enforce authentication and authorization for updates; prevent updates to reserved tickets; track ticket reservation status (`orderId`); react to order creation/cancellation events; publish ticket events.

```
tickets/
  src/
    __mocks__/
      nats-wrapper.ts                 # Mock NATS wrapper for testing
    app.ts                          # Express application setup and middleware
    events/                         # NATS event handling
      listeners/                    # Event consumers
        __test__/                   # Tests for listeners
          order-cancelled-listener.test.ts # Test for OrderCancelledListener
          order-created-listener.test.ts # Test for OrderCreatedListener
        order-cancelled-listener.ts # Listens for OrderCancelledEvent
        order-created-listener.ts   # Listens for OrderCreatedEvent
      publishers/                   # Event producers
        ticket-created-publisher.ts # Publishes TicketCreatedEvent
        ticket-updated-publisher.ts # Publishes TicketUpdatedEvent
    index.ts                        # Application entry point, connects to DB/NATS, starts listeners/server
    logger.ts                       # Winston logger configuration
    models/                         # Mongoose models
      __test__/                     # Tests for models
        ticket.test.ts              # Tests for Ticket model (specifically versioning)
      ticket.ts                     # Ticket Mongoose model definition
    nats-wrapper.ts                 # Singleton wrapper for NATS client connection
    routes/                         # Express route handlers
      __test__/                     # Tests for routes
        index.test.ts               # Test for GET /api/tickets
        new.test.ts                 # Test for POST /api/tickets
        show.test.ts                # Test for GET /api/tickets/:id
        update.test.ts              # Test for PUT /api/tickets/:id
      index.ts                      # Route to list all tickets
      new.ts                        # Route to create a new ticket
      show.ts                       # Route to get a single ticket by ID
      update.ts                     # Route to update a ticket by ID
    test/                           # Test utilities and setup
      createTicket.ts               # Helper function to create a ticket via API for tests
      getAuthCookie.ts              # Helper function to generate a fake auth cookie for tests
      setup.ts                      # Jest setup file (in-memory DB, mock NATS)
    tracer.ts                       # Datadog tracing initialization
```

**Implementation Details:**

- The `Ticket` model includes an optional `orderId` field to track reservation status.
- Uses `mongoose-update-if-current` plugin on the `Ticket` model for optimistic concurrency.
- The `PUT /api/tickets/:id` route checks if `ticket.orderId` is set and throws `BadRequestError` if attempting to update a reserved ticket. It also checks `ticket.userId` against `req.currentUser!.id` for authorization.
- Listens for `order:created` events to set the `orderId` on the corresponding ticket, marking it reserved.
- Listens for `order:cancelled` events to unset the `orderId` on the corresponding ticket, marking it available.
- Publishes `ticket:created` and `ticket:updated` events. The `ticket:updated` event is published both when a ticket is updated via the API _and_ when its `orderId` is changed by an order event.
- Uses `requireAuth` middleware from `common` to protect creation and update routes.

---

## System Operation Walkthrough: User Scenarios

Here's how the system components interact for key user flows:

1.  **User Signup/Signin:**

    - User interacts with the **Client** application (e.g., fills out a form on `/auth/signup` or `/auth/signin`).
    - **Client** sends an HTTP POST request to `/api/users/signup` or `/api/users/signin`.
    - **Ingress** routes the request to the **Auth Service**.
    - **Auth Service** validates input (`validateRequest`), checks/creates user in its **MongoDB**, hashes password (`utils/password.ts`).
    - On success, **Auth Service** generates a JWT, sets it in `req.session.jwt`. `cookie-session` middleware prepares the `Set-Cookie` header.
    - **Auth Service** responds to **Client** (e.g., 201 Created or 200 OK).
    - **Client** receives the response, the browser stores the HTTP-only cookie. **Client** redirects user (e.g., to `/`).
    - _Note: No NATS events are published by Auth service in this design._

2.  **Viewing Tickets (Landing Page):**

    - User navigates to the landing page (`/`) in the **Client**.
    - **Client** (`pages/index.js` `getInitialProps`) sends an HTTP GET request to `/api/tickets`.
    - **Ingress** routes the request to the **Tickets Service**.
    - **Tickets Service** queries its **MongoDB** for all tickets.
    - **Tickets Service** responds with the list of tickets.
    - **Client** receives the data and renders the list.
    - _Authentication Check:_ On initial load (`_app.js`), **Client** also sends GET `/api/users/currentuser` (via Ingress to Auth Service) to determine if the user is logged in. This uses the cookie set during signin. The `currentUser` middleware in **Auth Service** verifies the JWT and returns user info or null. This info is passed as a prop to all pages for conditional rendering (e.g., showing "Sign Out" vs "Sign In/Up").

3.  **Creating a Ticket:**

    - Authenticated user navigates to `/tickets/new` in the **Client**.
    - User fills out the form and submits.
    - **Client** sends an HTTP POST request to `/api/tickets` with ticket details (title, price).
    - **Ingress** routes the request to the **Tickets Service**.
    - **Tickets Service** middleware (`currentUser`, `requireAuth`, `validateRequest`) processes the request. `requireAuth` ensures the user is logged in.
    - **Tickets Service** saves the new ticket to its **MongoDB** (`models/ticket.ts`).
    - **Tickets Service** publishes a `ticket:created` event to **NATS** using `TicketCreatedPublisher`.
    - **Tickets Service** responds with 201 Created and the ticket data.
    - **Client** receives the response and redirects the user (e.g., to `/`).
    - **NATS** delivers the `ticket:created` event to listeners in other services (e.g., **Orders Service**).

4.  **Ordering a Ticket:**

    - Authenticated user views a specific ticket page (`/tickets/[ticketId]`) in the **Client**.
    - **Client** (`pages/tickets/[ticketId].js` `getInitialProps`) sends HTTP GET `/api/tickets/:ticketId` (via Ingress to Tickets Service) to fetch ticket details.
    - User clicks "Purchase".
    - **Client** sends an HTTP POST request to `/api/orders` with the `ticketId`.
    - **Ingress** routes the request to the **Orders Service**.
    - **Orders Service** middleware (`currentUser`, `requireAuth`, `validateRequest`) processes the request.
    - **Orders Service** finds the local copy of the ticket in its **MongoDB** (`models/ticket.ts`), checks if it's reserved (`isReserved()`).
    - **Orders Service** calculates expiration time, saves a new order (status `Created`) to its **MongoDB** (`models/order.ts`).
    - **Orders Service** publishes an `order:created` event to **NATS** using `OrderCreatedPublisher`.
    - **Orders Service** responds with 201 Created and the order data.
    - **Client** receives the response and redirects the user to the order details page (`/orders/[orderId]`).
    - **NATS** delivers the `order:created` event to listeners in other services (**Expiration Service**, **Payments Service**, **Tickets Service**).

5.  **Paying for an Order:**

    - Authenticated user views an order details page (`/orders/[orderId]`) in the **Client**.
    - **Client** (`pages/orders/[orderId].js` `getInitialProps`) sends HTTP GET `/api/orders/:orderId` (via Ingress to Orders Service) to fetch order details.
    - User enters payment details into the Stripe form component.
    - The Stripe component interacts with Stripe's client-side API to get a payment token.
    - The Stripe component's `token` callback is triggered in the **Client**.
    - **Client** sends an HTTP POST request to `/api/payments` with the `orderId` and the Stripe `token`.
    - **Ingress** routes the request to the **Payments Service**.
    - **Payments Service** middleware (`currentUser`, `requireAuth`, `validateRequest`) processes the request.
    - **Payments Service** finds the order in its local **MongoDB** cache (`models/order.ts`), validates it (exists, owned by user, not cancelled).
    - **Payments Service** calls the **Stripe API** (`stripe.charges.create`) to create a charge using the token and order price.
    - **Stripe API** processes the charge and responds to **Payments Service**.
    - **Payments Service** saves a `Payment` record to its **MongoDB** (`models/payment.ts`).
    - **Payments Service** publishes a `payment:created` event to **NATS** using `PaymentCreatedPublisher`.
    - **Payments Service** responds with 201 Created and the payment data.
    - **Client** receives the response and redirects the user (e.g., to `/orders`).
    - **NATS** delivers the `payment:created` event to listeners in other services (e.g., **Orders Service**).

6.  **Order Expiration:**
    - (This flow is initiated by the system, not a direct user action).
    - **Expiration Service** receives an `order:created` event from **NATS**.
    - **Expiration Service** calculates the delay and adds a job to its **Redis**-backed Bull queue (`queues/expiration-queue.ts`).
    - After the delay, the Bull worker in **Expiration Service** processes the job.
    - The worker publishes an `expiration:complete` event to **NATS** using `ExpirationCompletePublisher`.
    - **NATS** delivers the `expiration:complete` event to listeners in other services (e.g., **Orders Service**).
    - **Orders Service** receives the `expiration:complete` event via `ExpirationCompleteListener`.
    - **Orders Service** finds the order in its **MongoDB**. If the order status is _not_ `Complete`, it updates the status to `Cancelled` and saves it.
    - **Orders Service** publishes an `order:cancelled` event to **NATS** using `OrderCancelledPublisher`.
    - **NATS** delivers the `order:cancelled` event to listeners in other services (**Tickets Service**, **Payments Service**, **Expiration Service** itself).
    - **Tickets Service** receives the `order:cancelled` event via `OrderCancelledListener`, finds the ticket, unsets its `orderId`, and saves it. It then publishes a `ticket:updated` event.
    - **Payments Service** receives the `order:cancelled` event via `OrderCancelledListener`, finds the local order cache, updates its status to `Cancelled`, and saves it.

---

## Low-Level Inter-Component Interactions

This section details the specific messages and events exchanged between services and their immediate triggers.

1.  **Client <-> Services (via Ingress):**

    - **Client -> Auth Service:**
      - HTTP POST `/api/users/signup` (Body: email, password) -> Trigger: User creation, JWT issuance, cookie setting.
      - HTTP POST `/api/users/signin` (Body: email, password) -> Trigger: User authentication, JWT issuance, cookie setting.
      - HTTP POST `/api/users/signout` -> Trigger: Clear session cookie.
      - HTTP GET `/api/users/currentuser` (Cookie: jwt) -> Trigger: JWT verification, return user payload or null.
    - **Client -> Tickets Service:**
      - HTTP GET `/api/tickets` -> Trigger: Fetch all tickets from DB.
      - HTTP POST `/api/tickets` (Body: title, price) -> Trigger: Auth check, validation, save ticket to DB, publish `ticket:created`.
      - HTTP GET `/api/tickets/:id` -> Trigger: Fetch specific ticket from DB.
      - HTTP PUT `/api/tickets/:id` (Body: title, price) -> Trigger: Auth check, ownership check, reserved check, validation, update ticket in DB, publish `ticket:updated`.
    - **Client -> Orders Service:**
      - HTTP GET `/api/orders` -> Trigger: Auth check, fetch user's orders from DB.
      - HTTP POST `/api/orders` (Body: ticketId) -> Trigger: Auth check, validation, check ticket availability (local DB), save order (status `created`) to DB, publish `order:created`.
      - HTTP GET `/api/orders/:orderId` -> Trigger: Auth check, ownership check, fetch order from DB.
      - HTTP DELETE `/api/orders/:orderId` -> Trigger: Auth check, ownership check, update order status to `cancelled` in DB, publish `order:cancelled`.
    - **Client -> Payments Service:**
      - HTTP POST `/api/payments` (Body: orderId, token) -> Trigger: Auth check, validation, check order validity (local DB), call Stripe API, save payment to DB, publish `payment:created`.

2.  **Service -> NATS Streaming Server (Publishers):**

    - **Tickets Service -> NATS:**
      - Event: `ticket:created` (Subject: `ticket:created`) -> Data: `{ id, title, price, userId, version }` -> Trigger: New ticket created via API.
      - Event: `ticket:updated` (Subject: `ticket:updated`) -> Data: `{ id, title, price, userId, version, orderId? }` -> Trigger: Ticket updated via API _or_ ticket's `orderId` changed by order event.
    - **Orders Service -> NATS:**
      - Event: `order:created` (Subject: `order:created`) -> Data: `{ id, status, userId, expiresAt, version, ticket: { id, price } }` -> Trigger: New order created via API.
      - Event: `order:cancelled` (Subject: `order:cancelled`) -> Data: `{ id, version, ticket: { id } }` -> Trigger: Order status updated to `cancelled` (user initiated or expiration).
    - **Payments Service -> NATS:**
      - Event: `payment:created` (Subject: `payment:created`) -> Data: `{ id, orderId, stripeId }` -> Trigger: Successful payment processed via Stripe.
    - **Expiration Service -> NATS:**
      - Event: `expiration:complete` (Subject: `expiration:complete`) -> Data: `{ orderId }` -> Trigger: Scheduled job for order expiration processed by Bull worker.

3.  **NATS Streaming Server -> Service (Listeners):**

    - **NATS -> Orders Service:**
      - Event: `ticket:created` (Queue Group: `orders-service`) -> Trigger: Create local `Ticket` document in Orders DB.
      - Event: `ticket:updated` (Queue Group: `orders-service`) -> Trigger: Find local `Ticket` by ID and _previous_ version, update title/price, save (optimistic concurrency).
      - Event: `expiration:complete` (Queue Group: `orders-service`) -> Trigger: Find `Order` by ID, if status is not `Complete`, update status to `cancelled`, save, publish `order:cancelled`.
      - Event: `payment:created` (Queue Group: `orders-service`) -> Trigger: Find `Order` by ID, update status to `Complete`, save.
    - **NATS -> Payments Service:**
      - Event: `order:created` (Queue Group: `payments-service`) -> Trigger: Create local `Order` document in Payments DB.
      - Event: `order:cancelled` (Queue Group: `payments-service`) -> Trigger: Find local `Order` by ID and _previous_ version, update status to `cancelled`, save (optimistic concurrency).
    - **NATS -> Tickets Service:**
      - Event: `order:created` (Queue Group: `tickets-service`) -> Trigger: Find `Ticket` by ID, set `orderId` to order ID, save, publish `ticket:updated`.
      - Event: `order:cancelled` (Queue Group: `tickets-service`) -> Trigger: Find `Ticket` by ID, set `orderId` to `undefined`, save, publish `ticket:updated`.
    - **NATS -> Expiration Service:**
      - Event: `order:created` (Queue Group: `expiration-service`) -> Trigger: Calculate delay, add job to Bull queue.
      - Event: `order:cancelled` (Queue Group: `expiration-service`) -> Trigger: (Not explicitly shown in listener code, but a common pattern would be to cancel the pending job in the queue if it exists).

4.  **Service -> Database:**

    - **Auth Service -> Auth MongoDB:** Read/Write `users` collection.
    - **Tickets Service -> Tickets MongoDB:** Read/Write `tickets` collection.
    - **Orders Service -> Orders MongoDB:** Read/Write `orders` and local `tickets` collections.
    - **Payments Service -> Payments MongoDB:** Read/Write local `orders` and `payments` collections.
    - **Expiration Service -> Expiration Redis:** Read/Write Bull queue state and jobs.

5.  **Payments Service <-> Stripe API:**
    - **Payments Service -> Stripe API:** HTTPS POST to Stripe API endpoint (e.g., `/v1/charges`) with payment token, amount, currency. -> Trigger: Stripe processes credit card charge.
    - **Stripe API -> Payments Service:** HTTPS response with charge details (success/failure, charge ID).

---

## Conclusion

The ticketing microservices system is a robust example of a distributed, event-driven architecture. It effectively separates concerns into distinct services, uses NATS Streaming for asynchronous communication and state synchronization, relies on Kubernetes for deployment and management, and leverages a shared common library for consistency. Key patterns demonstrated include:

- **API Gateway:** Ingress for external access and routing.
- **JWT Authentication:** Stateless authentication managed by the Auth service and consumed by others via shared middleware and secret.
- **Event Sourcing/CQRS principles:** Services react to events to update their local state (e.g., Orders and Payments services maintaining local ticket/order caches), enabling eventual consistency and decoupling.
- **Optimistic Concurrency:** Using `mongoose-update-if-current` to handle concurrent updates to shared data (like tickets or local order caches) arriving via the event bus.
- **Background Jobs:** Using a queue (Bull/Redis) for delayed processing tasks like order expiration.

This architecture provides scalability, resilience, and flexibility, allowing individual services to be developed, deployed, and scaled independently while maintaining a cohesive system through well-defined API contracts and event streams.
