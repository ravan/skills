---
name: linkedin-login
description: Capture LinkedIn authentication cookies with the Playwright CLI and save them to a project .env file. Use when a user asks to log in to LinkedIn, refresh LinkedIn auth, capture LinkedIn cookies, fix expired LinkedIn scraping credentials, or run /linkedin-login.
---

# LinkedIn Login

Capture `li_at` and `JSESSIONID` cookies from an authenticated LinkedIn browser session and save them as `LINKEDIN_LI_AT` and `LINKEDIN_JSESSIONID` in the current project's `.env`.

## Quick Start

Run from the project root:

```bash
bash .agents/skills/linkedin-login/scripts/run-linkedin-login.sh
```

On macOS, the runner copies the user's last active Chrome profile into a temporary directory, starts real Chrome with extensions enabled and a local debugging port, then uses the Playwright CLI to attach and capture cookies. On other platforms, it opens Playwright-managed system Chrome. If the Playwright CLI is not installed, the runner automatically installs `@playwright/test` through `npm exec`.

## Workflow

1. Ensure the command is run from the project root where `.env` should be written.
2. Run the command from Quick Start. If the Playwright CLI is missing, let the runner install it automatically.
3. If output says `STATE=LOGIN_REQUIRED`, tell the user to complete LinkedIn login in the Chrome window.
4. Wait until the command exits with `DONE`.
5. Confirm that LinkedIn cookies were saved to `.env`.

## Requirements

- Node.js with `npm` available.
- System Chrome installed.
- Network access for the Playwright package on first run if it is not already cached.

## macOS Profile Selection

By default, the runner uses the last active Chrome profile from:

```text
~/Library/Application Support/Google/Chrome/Local State
```

To force a profile:

```bash
LINKEDIN_LOGIN_CHROME_PROFILE_DIRECTORY="Profile 1" bash .agents/skills/linkedin-login/scripts/run-linkedin-login.sh
```

Useful overrides:

- `LINKEDIN_LOGIN_CHROME_BIN`: path to Chrome binary.
- `LINKEDIN_LOGIN_CHROME_ROOT`: path to Chrome user data root.
- `LINKEDIN_LOGIN_CHROME_PROFILE_DIRECTORY`: Chrome profile directory, such as `Default` or `Profile 1`.
- `LINKEDIN_LOGIN_CDP_PORT`: local debugging port, default `9222`.
- `LINKEDIN_LOGIN_PLAYWRIGHT_PACKAGE`: Playwright package to install/run, default `@playwright/test@latest`.
- `LINKEDIN_LOGIN_USE_PLAYWRIGHT_CHROME=1`: skip macOS profile-copy attach flow and use Playwright's persistent Chrome launch.

## Notes

- This skill intentionally uses the Playwright CLI, not a Claude MCP or plugin runner.
- On macOS, the script does not read or decrypt Chrome cookie storage, Keychain data, or password manager data. It copies the selected Chrome profile so installed extensions can run, then captures cookies through Playwright's browser context after the user completes login.
- The script writes cookie values directly to `.env` and does not print cookie values to stdout.
- If cookies expire, run the same command again.
