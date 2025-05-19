import { WebClient } from "@slack/web-api";
import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";

declare module "express-session" {
  interface SessionData {
    slackAccessToken?: string;
    slackUserId?: string;
  }
}

dotenv.config();

// Environment variables
const PORT = process.env.PORT || 3000;
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI =
  process.env.SLACK_REDIRECT_URI || "http://localhost:3000/slack/oauth_redirect";
const SESSION_SECRET = process.env.SESSION_SECRET || "your-session-secret";

// Validate required environment variables
if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
  console.error("Error: Missing required environment variables. Please check your .env file.");
  process.exit(1);
}

// Initialize Express app
const app = express();

// Configure session middleware
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === "production" },
  }) as express.RequestHandler
);

// Middleware to make session available in templates
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Simple HTML template helper
const renderPage = (title: string, content: string) => `
  <!DOCTYPE html>
  <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { background: #f8f8f8; border-radius: 8px; padding: 20px; margin-top: 20px; }
        pre { background: #f0f0f0; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .btn { background: #4a154b; color: white; padding: 10px 15px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 10px 0; }
        .btn:hover { background: #5e1d5e; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="container">
        ${content}
      </div>
    </body>
  </html>
`;

// Home route - Start OAuth flow
app.get("/", (_req, res) => {
  // Only request user_scope, no bot scopes (scope=) at all
  const userScopes = [
    "search:read", 
    "channels:history", 
    "groups:history", 
    "im:history", 
    "mpim:history", 
    "users:read", 
    "users.profile:read", 
    "channels:read", 
    "groups:read", 
    "im:read", 
    "mpim:read"
  ].join(",");
  
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&user_scope=${userScopes}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}`;

  const content = `
    <p>Click the button below to connect your Slack workspace:</p>
    <a href="${authUrl}" class="btn">Connect to Slack</a>
    <p>After authorizing, you'll be redirected back to this app.</p>
  `;

  res.send(renderPage("Slack OAuth2 Integration", content));
});

// OAuth callback handler
app.get("/slack/oauth_redirect", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(
      renderPage(
        "OAuth Error",
        `
      <p>Error from Slack: ${error}</p>
      <p><a href="/" class="btn">Try Again</a></p>
    `
      )
    );
  }

  if (!code) {
    return res.status(400).send(renderPage("Error", "Missing authorization code"));
  }

  try {
    // Exchange the authorization code for an access token
    const response = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code: code as string,
        redirect_uri: SLACK_REDIRECT_URI,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.info("OAuth response:", response.data);

    // For user-based search, we need the user token
    const userToken = response.data.authed_user?.access_token;

    if (!userToken) {
      throw new Error("No user access token received from Slack");
    }

    // Store the token in the session
    req.session.slackAccessToken = userToken;
    req.session.slackUserId = response.data.authed_user?.id;

    // Redirect to the search page
    res.redirect("/search");
  } catch (error) {
    console.error("OAuth error:", error);
    res.status(500).send(
      renderPage(
        "OAuth Error",
        `
      <p>Error during OAuth process: ${error instanceof Error ? error.message : "Unknown error"}</p>
      <p><a href="/" class="btn">Try Again</a></p>
    `
      )
    );
  }
});

// Search page
app.get("/search", async (req, res) => {
  const { slackAccessToken } = req.session;

  if (!slackAccessToken) {
    return res.redirect("/");
  }

  const { query = "" } = req.query;
  let searchResults = null;

  try {
    if (query) {
      const slack = new WebClient(slackAccessToken);
      const result = await slack.search.messages({
        query: query as string,
        count: 10,
      });
      searchResults = result.messages?.matches || [];
    }

    let resultsHtml = "";
    if (searchResults) {
      if (searchResults.length > 0) {
        resultsHtml = `
          <h3>Search Results for "${query}":</h3>
          <ul>
            ${searchResults
              .map(
                (message: any) => `
                <li>
                  <strong>${message.username || "Unknown User"}</strong> in #${message.channel?.name || "unknown"}<br>
                  <pre>${message.text}</pre>
                  <small>${new Date(parseFloat(message.ts) * 1000).toLocaleString()}</small>
                </li>`
              )
              .join("")}
          </ul>
        `;
      } else {
        resultsHtml = `<p>No results found for "${query}"</p>`;
      }
    }

    const content = `
      <form method="get" action="/search" style="margin-bottom: 20px;">
        <input type="text" name="query" value="${query}" placeholder="Search messages..." style="padding: 8px; width: 300px; margin-right: 10px;" />
        <button type="submit" class="btn">Search</button>
      </form>
      ${resultsHtml}
      <p><a href="/" class="btn">Back to Home</a></p>
    `;

    res.send(renderPage("Search Messages", content));
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).send(
      renderPage(
        "Search Error",
        `
      <p>Error searching messages: ${error instanceof Error ? error.message : "Unknown error"}</p>
      <p><a href="/search" class="btn">Try Again</a></p>
    `
      )
    );
  }
});

// Start the server
app.listen(PORT, () => {
  console.info(`Server running at http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
