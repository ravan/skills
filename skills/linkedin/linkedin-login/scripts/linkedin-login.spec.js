const { test, chromium } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRoot = process.env.LINKEDIN_LOGIN_PROJECT_ROOT || process.cwd();
const envPath = path.join(projectRoot, '.env');
const cdpUrl = process.env.LINKEDIN_LOGIN_CDP_URL;
const chromeUserDataDir = process.env.LINKEDIN_LOGIN_CHROME_USER_DATA_DIR;
const chromeProfileDirectory = process.env.LINKEDIN_LOGIN_CHROME_PROFILE_DIRECTORY;
const extensionDirs = process.env.LINKEDIN_LOGIN_EXTENSION_DIRS;

function setEnvValue(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }

  const prefix = contents.length > 0 && !contents.endsWith('\n') ? '\n' : '';
  return `${contents}${prefix}${line}\n`;
}

function updateEnvFile(values) {
  let contents = '';

  if (fs.existsSync(envPath)) {
    contents = fs.readFileSync(envPath, 'utf8');
  }

  for (const [key, value] of Object.entries(values)) {
    contents = setEnvValue(contents, key, value);
  }

  fs.writeFileSync(envPath, contents, { mode: 0o600 });
}

async function getAuthCookies(context) {
  const cookies = await context.cookies();
  const liAt = cookies.find((cookie) => cookie.name === 'li_at');
  const jsessionId = cookies.find((cookie) => cookie.name === 'JSESSIONID');

  return { liAt, jsessionId };
}

async function waitForAuthCookies(context, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const authCookies = await getAuthCookies(context);

    if (authCookies.liAt && authCookies.jsessionId) {
      return authCookies;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for LinkedIn auth cookies`);
}

test('capture LinkedIn auth cookies', async () => {
  test.setTimeout(360_000);

  const userDataDir = chromeUserDataDir || path.join(os.tmpdir(), 'linkedin-login-profile');
  const chromeArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
  ];

  if (chromeProfileDirectory) {
    chromeArgs.push(`--profile-directory=${chromeProfileDirectory}`);
  }

  if (extensionDirs) {
    chromeArgs.push(`--disable-extensions-except=${extensionDirs}`);
    chromeArgs.push(`--load-extension=${extensionDirs}`);
  }

  let browser;
  const context = cdpUrl
    ? await chromium.connectOverCDP(cdpUrl).then((connectedBrowser) => {
      browser = connectedBrowser;
      return connectedBrowser.contexts()[0];
    })
    : await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'chrome',
      args: chromeArgs,
      ignoreDefaultArgs: ['--enable-automation', '--disable-extensions'],
    });

  if (!context) {
    throw new Error(`No browser context found for ${cdpUrl}`);
  }

  try {
    const page = context.pages()[0] || await context.newPage();

    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

    let authCookies = await getAuthCookies(context);
    const url = page.url();
    if (
      authCookies.liAt && authCookies.jsessionId
      || url.includes('/feed')
      || url.includes('/mynetwork')
      || url.includes('/in/')
    ) {
      console.log('STATE=ALREADY_LOGGED_IN');
    } else {
      console.log('STATE=LOGIN_REQUIRED');
      authCookies = await waitForAuthCookies(context, 300_000);
      console.log('STATE=LOGIN_COMPLETE');
    }

    const { liAt, jsessionId } = authCookies.liAt && authCookies.jsessionId
      ? authCookies
      : await getAuthCookies(context);

    if (!liAt) {
      throw new Error('li_at cookie not found');
    }

    if (!jsessionId) {
      throw new Error('JSESSIONID cookie not found');
    }

    const jsessionValue = jsessionId.value.replace(/^"|"$/g, '');
    updateEnvFile({
      LINKEDIN_LI_AT: liAt.value,
      LINKEDIN_JSESSIONID: jsessionValue,
    });

    console.log(`ENV_PATH=${envPath}`);
    console.log('DONE');
  } finally {
    if (browser) {
      await browser.close();
    } else {
      await context.close();
    }
  }
});
