# OpenTelemetry Astronomy Shop System Architecture

The OpenTelemetry Astronomy Shop repository showcases a microservice-based distributed system. It is designed to demonstrate the integration of OpenTelemetry within a realistic architectural context, providing observability across shops of microservices. Below is the detailed architecture of the system, highlighting each service, configurations, and interactions.

## Repository Structure

The repository is organized as follows:

```
├── .markdownlint.yaml
├── kubernetes/
│   └── opentelemetry-demo.yaml
└── src/
    ├── accounting/
    ├── ad/
    ├── cart/
    ├── checkout/
    ├── flagd-ui/
    ├── frontend/
    ├── frontend-proxy/
    ├── grafana/
    ├── load-generator/
    ├── payment/
    ├── product-catalog/
    ├── prometheus/
    ├── react-native-app/
    ├── recommendation/
    └── shipping/
```

### 1. **Kubernetes**

- **`kubernetes/opentelemetry-demo.yaml`**: Critical for deploying the services into a Kubernetes environment. It sets up resources like namespaces, services, deployments, ConfigMaps, and integrates with observability tools such as Grafana, Jaeger, and OpenTelemetry Collector.

### 2. **src/accounting**

- Implements the Accounting microservice using a Kafka consumer to handle order-related data.
- **`Consumer.cs`**: Processes incoming Kafka messages.
- **`Helpers.cs`**, **`Log.cs`**: Utility functionalities for environment management and structured logging.
- **`Program.cs`**: Entry point setting up dependencies and services.

### 3. **src/ad**

- Provides advertising services using gRPC.
- **`AdService.java`**: Main service class for handling ads.
- **`problempattern/`**: Simulates CPU load and garbage collection scenarios for testing resilience.

### 4. **src/cart**

- Manages shopping cart functionalities.
- **`Program.cs`**: Sets up the gRPC server and OpenTelemetry.
- **`cartstore/`**, **`services/`**: Interfaces and implementations for data storage and service logic.
- **`tests/`**: Automated tests for service validation.

### 5. **src/checkout**

- Facilitates the order checkout process.
- **`main.go`**: Core application handling order interactions.
- **`kafka/producer.go`**: Manages message publishing to Kafka.
- **`money/`**: Utility for financial operations and their testing.

### 6. **src/flagd-ui**

- UI components for managing feature flags.
- API routes interconnect serverless functions with microservices.

### 7. **src/frontend**

- Composes the user interface leveraging Next.js.
- **`components/`**: Contains modular UI parts.
- **`cypress/`**: End-to-end testing scripts.
- **`gateways/`, `pages/`**: Gateways and API routes for service communication.
- **`styles/`, `utils/`**: Theme and utility configurations.

### 8. **src/frontend-proxy**

- **`envoy.tmpl.yaml`**: Configuration for using Envoy proxy, central to distributing incoming requests to services, and supporting OpenTelemetry tracing.

### 9. **src/grafana**

- Configurations for monitoring with Grafana.
- **`provisioning/dashboards/`, `datasources/`**: Defines data sources including Prometheus, Jaeger, OpenSearch for centralized telemetry visualization.

### 10. **src/load-generator**

- **`locustfile.py`**: A script for generating synthetic load to stress test the system. Integrates OpenTelemetry for performance measurement.

### 11. **src/payment**

- Handles payment transactions.
- **`charge.js`**, **`opentelemetry.js`**: Executes payment logic and integrates OpenTelemetry for tracing and metrics.
- **`index.js`**: gRPC server setup.

### 12. **src/product-catalog**

- Manages product data.
- **`main.go`**: gRPC setup for service operations.
- **`genproto/`**: Protocol buffer definitions for communication.

### 13. **src/prometheus**

- **`prometheus-config.yaml`**: Configuration for data scraping intervals, crucial for system observability.
- Implements monitoring and alerting via Prometheus.

### 14. **src/react-native-app**

- Mobile front-end using React Native.
- **`components/`**: Mobile UI components.
- **`gateways/`, `hooks/`, `utils/`**: Handles API communications, theme management, and OpenTelemetry.

### 15. **src/recommendation**

- Provides product recommendations.
- **`recommendation_server.py`**: Serves recommendations using gRPC, with OpenTelemetry integration for observability.

### 16. **src/shipping**

- Handles shipping operations.
- **`shipping_service.rs`**: Core logic for shipping quotes and tracking.
- **`telemetry/`**: Setups for OpenTelemetry tracing and logging.

## System Interactions

The OpenTelemetry Astronomy Shop functions as a network of microservices, with each service communicating primarily through gRPC. OpenTelemetry is woven into the architecture to provide visibility into each operation through tracing, logging, and metrics. Components like Envoy proxy redouble this interconnected system by managing incoming and outgoing requests, with telemetry data funneled to monitoring interfaces like Grafana through Prometheus.

The comprehensive monitoring setup ensures any bottleneck or failure in the distributed system is quickly identified and addressed, maximizing reliability and performance. Each service independently contributes to the system's overall capability while maintaining cross-service observability. This makes the OpenTelemetry Astronomy Shop an exemplary model for monitoring in microservice architectures.
