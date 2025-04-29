# Ticketing System Codebase Walkthrough

## Overview

The Ticketing system is a microservices-based platform for buying and selling tickets to events. It follows an event-driven architecture where services communicate asynchronously through a message broker (NATS Streaming). The system consists of six main services, each with its own database and responsibility, plus a shared common library.

```
ticketing/
├── auth/                 # Authentication service
├── client/               # React frontend application
├── common/               # Shared library used across services
├── expiration/           # Order expiration service
├── infra/                # Kubernetes configuration
├── orders/               # Order management service
├── payments/             # Payment processing service
├── tickets/              # Ticket management service
├── skaffold.yaml         # Development workflow configuration
└── README.md             # Project documentation
```

## Service Architecture

### Common Library (`/common`)

The common library provides shared functionality across all services, ensuring consistency and reducing code duplication.

```
common/
├── src/
│   ├── errors/                # Custom error classes
│   │   ├── bad-request-error.ts
│   │   ├── custom-error.ts
│   │   ├── database-connection-error.ts
│   │   ├── not-authorized-error.ts
│   │   ├── not-found-error.ts
│   │   └── request-validation-error.ts
│   ├── events/                # Event definitions and base classes
│   │   ├── base-event.ts      # Base interface for all events
│   │   ├── base-listener.ts   # Abstract class for event subscribers
│   │   ├── base-publisher.ts  # Abstract class for event publishers
│   │   ├── subject.ts         # Enum of event types
│   │   ├── ticket-created-event.ts
│   │   ├── ticket-updated-event.ts
│   │   ├── order-created-event.ts
│   │   ├── order-cancelled-event.ts
│   │   ├── expiration-complete-event.ts
│   │   ├── payment-created-event.ts
│   │   └── types/
│   │       ├── order-status.ts    # Enum of order states
│   │       └── queue-group-names.ts # Constants for NATS consumer groups
│   ├── middlewares/           # Express middlewares
│   │   ├── current-user.ts    # Extracts user from JWT
│   │   ├── error-handler.ts   # Standardized error responses
│   │   ├── require-auth.ts    # Authentication check
│   │   └── validate-request.ts # Request validation
│   ├── logger.ts              # Logging utility
│   └── index.ts               # Exports all shared components
```

**Key Components:**

- **Error Handling**: Standardized error classes that extend `CustomError` for consistent error responses.
- **Event System**: Base classes for event publishing and subscription with NATS Streaming.
- **Middlewares**: Express middlewares for authentication, validation, and error handling.
- **Event Interfaces**: Type definitions for all events exchanged between services.

The event system is particularly important as it defines the contract between services. The `base-listener.ts` and `base-publisher.ts` provide abstract classes that handle the mechanics of event subscription and publishing, while specific event interfaces define the data structure for each event type.

### Auth Service (`/auth`)

The Auth service handles user authentication, including signup, signin, and signout operations.

```
auth/
├── src/
│   ├── models/
│   │   └── user.ts           # User model with password hashing
│   ├── routes/
│   │   ├── currentuser.ts    # Returns current user info
│   │   ├── signin.ts         # Handles user login
│   │   ├── signout.ts        # Handles user logout
│   │   └── signup.ts         # Handles user registration
│   ├── utils/
│   │   └── password.ts       # Password hashing utilities
│   ├── app.ts                # Express app setup
│   ├── index.ts              # Service entry point
│   └── tracer.ts             # Tracing configuration
```

**Key Components:**

- **User Model**: Defines the MongoDB schema for users with password hashing using bcrypt.
- **Authentication Routes**: Express routes for user signup, signin, signout, and current user.
- **JWT**: Uses JSON Web Tokens for authentication, stored in cookies.

The Auth service is independent and doesn't publish or subscribe to any events. It provides JWT tokens that other services use to authenticate requests. The `currentuser` route is used by the client to determine if a user is logged in.

### Tickets Service (`/tickets`)

The Tickets service manages the creation, updating, and retrieval of ticket listings.

```
tickets/
├── src/
│   ├── events/
│   │   ├── listeners/
│   │   │   ├── order-created-listener.ts    # Marks tickets as reserved
│   │   │   └── order-cancelled-listener.ts  # Releases reserved tickets
│   │   └── publishers/
│   │       ├── ticket-created-publisher.ts  # Announces new tickets
│   │       └── ticket-updated-publisher.ts  # Announces ticket updates
│   ├── models/
│   │   └── ticket.ts          # Ticket model with versioning
│   ├── routes/
│   │   ├── index.ts           # Lists all tickets
│   │   ├── new.ts             # Creates new tickets
│   │   ├── show.ts            # Shows ticket details
│   │   └── update.ts          # Updates ticket details
│   ├── app.ts                 # Express app setup
│   ├── index.ts               # Service entry point
│   ├── nats-wrapper.ts        # NATS client singleton
│   └── tracer.ts              # Tracing configuration
```

**Key Components:**

- **Ticket Model**: Defines the MongoDB schema for tickets with optimistic concurrency control using versioning.
- **CRUD Routes**: Express routes for creating, reading, updating, and listing tickets.
- **Event Publishers**: Publish events when tickets are created or updated.
- **Event Listeners**: Listen for order events to mark tickets as reserved or release them.

The Tickets service demonstrates the event-driven architecture well. When a ticket is created or updated, it publishes events that other services can subscribe to. It also listens for order events to update the ticket's reservation status, ensuring that tickets can't be double-booked.

### Orders Service (`/orders`)

The Orders service manages the creation and cancellation of orders for tickets.

```
orders/
├── src/
│   ├── events/
│   │   ├── listeners/
│   │   │   ├── expiration-complete-listener.ts  # Handles expired orders
│   │   │   ├── payment-created-listener.ts      # Marks orders as complete
│   │   │   ├── ticket-created-listener.ts       # Tracks available tickets
│   │   │   └── ticket-updated-listener.ts       # Updates ticket info
│   │   └── publishers/
│   │       ├── order-created-publisher.ts       # Announces new orders
│   │       └── order-cancelled-publisher.ts     # Announces cancelled orders
│   ├── models/
│   │   ├── order.ts           # Order model with status tracking
│   │   └── ticket.ts          # Local ticket model with reservation check
│   ├── routes/
│   │   ├── delete.ts          # Cancels orders
│   │   ├── index.ts           # Lists user's orders
│   │   ├── new.ts             # Creates new orders
│   │   └── show.ts            # Shows order details
│   ├── app.ts                 # Express app setup
│   ├── index.ts               # Service entry point
│   ├── nats-wrapper.ts        # NATS client singleton
│   └── tracer.ts              # Tracing configuration
```

**Key Components:**

- **Order Model**: Defines the MongoDB schema for orders with status tracking.
- **Local Ticket Model**: A local representation of tickets with methods to check if a ticket is already reserved.
- **Order Routes**: Express routes for creating, cancelling, and viewing orders.
- **Event Publishers**: Publish events when orders are created or cancelled.
- **Event Listeners**: Listen for ticket, expiration, and payment events to update order status.

The Orders service maintains its own copy of ticket data, updated through events from the Tickets service. This demonstrates the concept of data duplication in microservices, where each service has its own view of the data it needs. The service also implements the reservation logic, ensuring that tickets can't be double-booked.

### Expiration Service (`/expiration`)

The Expiration service handles the time-based expiration of orders, ensuring that unpaid orders are automatically cancelled after a set period.

```
expiration/
├── src/
│   ├── events/
│   │   ├── listeners/
│   │   │   └── order-created-listener.ts    # Schedules order expiration
│   │   └── publishers/
│   │       └── expiration-complete-publisher.ts  # Announces expired orders
│   ├── queues/
│   │   └── expiration-queue.ts  # Bull queue for delayed jobs
│   ├── index.ts                 # Service entry point
│   ├── nats-wrapper.ts          # NATS client singleton
│   └── tracer.ts                # Tracing configuration
```

**Key Components:**

- **Expiration Queue**: A Bull queue backed by Redis that schedules delayed jobs for order expiration.
- **Order Created Listener**: Listens for new orders and schedules expiration jobs.
- **Expiration Complete Publisher**: Publishes events when orders expire.

The Expiration service is unique in that it doesn't have a REST API or a database. It uses Redis and Bull to schedule delayed jobs that trigger when an order's expiration time is reached. When an order is created, the service calculates the delay until expiration and adds a job to the queue. When the job executes, it publishes an expiration event that the Orders service listens for.

### Payments Service (`/payments`)

The Payments service handles payment processing for orders using Stripe.

```
payments/
├── src/
│   ├── events/
│   │   ├── listeners/
│   │   │   ├── order-created-listener.ts    # Tracks orders for payment
│   │   │   └── order-cancelled-listener.ts  # Prevents payment for cancelled orders
│   │   └── publishers/
│   │       └── payment-created-publisher.ts  # Announces successful payments
│   ├── models/
│   │   ├── order.ts           # Local order model
│   │   └── payment.ts         # Payment record model
│   ├── routes/
│   │   └── new.ts             # Processes payments
│   ├── app.ts                 # Express app setup
│   ├── index.ts               # Service entry point
│   ├── nats-wrapper.ts        # NATS client singleton
│   ├── stripe.ts              # Stripe API client
│   └── tracer.ts              # Tracing configuration
```

**Key Components:**

- **Payment Model**: Records successful payments with references to orders and Stripe charges.
- **Local Order Model**: A local representation of orders to validate payment requests.
- **Payment Route**: Processes payments through Stripe and records successful transactions.
- **Event Listeners**: Listen for order events to track which orders can be paid for.
- **Payment Created Publisher**: Publishes events when payments are successful.

The Payments service demonstrates how a third-party service (Stripe) is integrated into the microservices architecture. It maintains its own copy of order data, updated through events, and uses this to validate payment requests. When a payment is successful, it publishes an event that the Orders service listens for to mark the order as complete.

### Client Application (`/client`)

The Client application is a React frontend built with Next.js that provides the user interface for the ticketing system.

```
client/
├── api/
│   └── build-client.js        # Axios client configuration
├── components/
│   └── header.js              # Navigation header component
├── hooks/
│   └── use-request.js         # Custom hook for API requests
├── pages/
│   ├── auth/
│   │   ├── signin.js          # Sign in page
│   │   ├── signout.js         # Sign out page
│   │   └── signup.js          # Sign up page
│   ├── orders/
│   │   ├── [orderId].js       # Order details page
│   │   └── index.js           # List user's orders
│   ├── tickets/
│   │   ├── [ticketId].js      # Ticket details page
│   │   └── new.js             # Create ticket page
│   ├── _app.js                # Next.js app component
│   └── index.js               # Landing page with ticket list
└── next.config.js             # Next.js configuration
```

**Key Components:**

- **Pages**: Next.js pages for different routes in the application.
- **API Client**: Configured Axios client for making requests to the backend services.
- **Custom Hooks**: Reusable logic for API requests with error handling.
- **Components**: Reusable UI components like the header.

The Client application interacts with all the backend services through their REST APIs. It uses Next.js's server-side rendering to fetch data on the server before rendering pages, which improves performance and SEO. The application also handles authentication by storing and sending JWT tokens in cookies.

### Infrastructure (`/infra`)

The Infrastructure directory contains Kubernetes configuration files for deploying the services.

```
infra/
├── k8s/
│   ├── auth-depl.yaml             # Auth service deployment
│   ├── auth-mongo-depl.yaml       # MongoDB for Auth service
│   ├── client-depl.yaml           # Client application deployment
│   ├── expiration-depl.yaml       # Expiration service deployment
│   ├── expiration-redis-depl.yaml # Redis for Expiration service
│   ├── ingress-srv.yaml           # Ingress controller for routing
│   ├── nats-depl.yaml             # NATS Streaming deployment
│   ├── orders-depl.yaml           # Orders service deployment
│   ├── orders-mongo-depl.yaml     # MongoDB for Orders service
│   ├── payments-depl.yaml         # Payments service deployment
│   ├── payments-mongo-depl.yaml   # MongoDB for Payments service
│   ├── tickets-depl.yaml          # Tickets service deployment
│   └── tickets-mongo-depl.yaml    # MongoDB for Tickets service
```

**Key Components:**

- **Service Deployments**: Kubernetes deployments for each service with container configurations.
- **Database Deployments**: MongoDB deployments for each service that needs persistent storage.
- **NATS Deployment**: Configuration for the NATS Streaming server.
- **Ingress Controller**: Routes external traffic to the appropriate service based on the URL path.

The infrastructure configuration demonstrates how the microservices are deployed and connected in a Kubernetes cluster. Each service has its own deployment and database, and they communicate through the NATS Streaming server. The Ingress controller routes external traffic to the appropriate service based on the URL path.

## Development Workflow

The `skaffold.yaml` file configures the development workflow using Skaffold, a tool for continuous development with Kubernetes.

```yaml
apiVersion: skaffold/v2alpha3
kind: Config
deploy:
  kubectl:
    manifests:
      - ./infra/k8s/*
build:
  local:
    push: false
  artifacts:
    - image: luketchang/auth
      context: .
      docker:
        dockerfile: auth/Dockerfile
      sync:
        manual:
          - src: "auth/src/*.ts"
            dest: .
    # Similar configurations for other services
```

Skaffold watches for file changes and automatically rebuilds and redeploys the affected services, making development faster and more efficient.

## Event Flow and Communication

The services communicate through events published to NATS Streaming. Here's a summary of the event flow:

1. **Ticket Creation**:

   - User creates a ticket through the Tickets service.
   - Tickets service publishes a `ticket:created` event.
   - Orders service listens for this event and creates a local copy of the ticket.

2. **Order Creation**:

   - User creates an order through the Orders service.
   - Orders service checks if the ticket is available and marks it as reserved.
   - Orders service publishes an `order:created` event.
   - Tickets service listens for this event and marks the ticket as reserved.
   - Expiration service listens for this event and schedules an expiration job.
   - Payments service listens for this event and creates a local copy of the order.

3. **Order Expiration**:

   - Expiration service publishes an `expiration:complete` event when the order expires.
   - Orders service listens for this event and cancels the order if it's not paid.
   - Orders service publishes an `order:cancelled` event if the order is cancelled.
   - Tickets service listens for this event and releases the ticket.
   - Payments service listens for this event and prevents payment for the cancelled order.

4. **Payment Processing**:
   - User makes a payment through the Payments service.
   - Payments service processes the payment with Stripe and records it.
   - Payments service publishes a `payment:created` event.
   - Orders service listens for this event and marks the order as complete.

This event-driven architecture ensures that each service has the data it needs to function independently while maintaining consistency across the system.

## Conclusion

The Ticketing system demonstrates a well-designed microservices architecture with clear separation of concerns and robust event-driven communication. Each service has its own responsibility and database, and they communicate asynchronously through events, making the system scalable and resilient.

The use of TypeScript, Express, MongoDB, NATS Streaming, and Kubernetes provides a modern and powerful tech stack for building distributed systems. The event-driven architecture ensures that data is consistent across services while allowing them to operate independently.
