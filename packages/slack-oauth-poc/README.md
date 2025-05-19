# Slack OAuth2 Proof of Concept

This is a TypeScript-based OAuth2 proof-of-concept application that demonstrates how to integrate with the Slack API to read and search messages using OAuth 2.0.

## Features

- OAuth 2.0 authentication with Slack
- Secure session management
- Message search functionality
- Clean, responsive UI
- TypeScript support with proper type definitions
- Environment-based configuration

## Prerequisites

- Node.js 18 or later
- A Slack workspace where you have permission to install apps
- A Slack App with OAuth 2.0 configured

## Setup

1. **Create a Slack App**

   - Go to [Slack API](https://api.slack.com/apps)
   - Click "Create New App" and choose "From scratch"
   - Name your app and select your workspace

2. **Configure OAuth & Permissions**

   - In your app settings, go to "OAuth & Permissions"
   - Under "Scopes", add the following Bot Token Scopes:
     - `channels:history`
     - `groups:history`
     - `im:history`
     - `mpim:history`
     - `search:read`
   - Under "OAuth Tokens & Redirect URLs", add the Redirect URL:
     - `http://localhost:3000/slack/oauth_redirect`
   - Save changes

3. **Install the app to your workspace**

   - Go to "OAuth & Permissions"
   - Click "Install to Workspace"
   - Authorize the app

4. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   - Update the `.env` file with your Slack App credentials

## Installation

```bash
# Install dependencies
pnpm install

# Build the application
pnpm build
```

## Running the Application

### Development Mode

```bash
pnpm dev
```

### Production Mode

```bash
pnpm build
pnpm start
```

## Usage

1. Visit `http://localhost:3000` in your browser
2. Click "Connect to Slack" to authorize the application
3. After authorization, you'll be redirected to the search page
4. Enter a search query and press Enter to search messages

## API Endpoints

- `GET /` - Home page with Slack OAuth button
- `GET /slack/oauth_redirect` - OAuth callback handler
- `GET /search` - Search interface and results

## Environment Variables

| Variable              | Description                    | Required | Default                                      |
| --------------------- | ------------------------------ | -------- | -------------------------------------------- |
| `SLACK_CLIENT_ID`     | Your Slack App's Client ID     | Yes      | -                                            |
| `SLACK_CLIENT_SECRET` | Your Slack App's Client Secret | Yes      | -                                            |
| `SLACK_REDIRECT_URI`  | OAuth redirect URI             | No       | `http://localhost:3000/slack/oauth_redirect` |
| `PORT`                | Port to run the server on      | No       | `3000`                                       |
| `SESSION_SECRET`      | Secret for session encryption  | No       | Random string                                |

## Security Considerations

- Always use HTTPS in production
- Store sensitive information (tokens, secrets) in environment variables, not in code
- Use proper session management in production
- Implement proper error handling and logging

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
