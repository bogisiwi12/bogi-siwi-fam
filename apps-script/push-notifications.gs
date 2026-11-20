/**
 * Google Apps Script sender for background web push notifications.
 *
 * Required Script Properties (Project Settings > Script Properties):
 *   FIREBASE_PROJECT_ID        e.g. bogisiwifam
 *   FIREBASE_DB_URL            e.g. https://bogisiwifam-default-rtdb.asia-southeast1.firebasedatabase.app
 *   SERVICE_ACCOUNT_EMAIL      e.g. firebase-adminsdk-xxxxx@bogisiwifam.iam.gserviceaccount.com
 *   SERVICE_ACCOUNT_PRIVATE_KEY  the "private_key" value from the service account JSON (keep the \n)
 *   APP_LINK                   e.g. https://bogisiwifam.web.app
 *
 * Run setupPushNotifications() once, then sendTestPush() to verify.
 */

var PROPS = PropertiesService.getScriptProperties();
var CACHE = CacheService.getScriptCache();
var FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
var DB_SCOPE =
  'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database';
var TOKEN_CACHE_KEY = 'fcm_access_token_v3';

function setupPushNotifications() {
  PROPS.setProperty('LAST_PUSH_AT', String(Date.now()));
  PROPS.setProperty('LAST_PUSH_IDS', '[]');
  installTrigger();
}

function installTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendPushNotifications') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('sendPushNotifications').timeBased().everyMinutes(1).create();
}

function sendPushNotifications() {
  var cfg = loadConfig();
  var lastAt = Number(PROPS.getProperty('LAST_PUSH_AT') || 0);
  var lastIds = JSON.parse(PROPS.getProperty('LAST_PUSH_IDS') || '[]');

  if (!lastAt) {
    PROPS.setProperty('LAST_PUSH_AT', String(Date.now()));
    return;
  }

  var notifications = fetchNewNotifications(cfg, lastAt);
  if (!notifications.length) return;

  var fresh = notifications.filter(function (n) {
    var at = Number(n.at) || 0;
    return at > lastAt || (at === lastAt && lastIds.indexOf(n.id) === -1);
  });
  if (!fresh.length) return;

  var tokens = fetchPushTokens(cfg);
  if (!tokens.length) {
    commitCursor(fresh, lastAt, lastIds);
    return;
  }

  var accessToken = getAccessToken(cfg);

  fresh.forEach(function (n) {
    tokens.forEach(function (t) {
      if (t.uid === n.actorId) return;
      try {
        sendFcm(cfg, accessToken, buildMessage(cfg, n, t.token));
      } catch (err) {
        Logger.log('Push failed for %s: %s', t.uid, err);
        var message = String(err);
        if (message.indexOf('UNREGISTERED') !== -1 || message.indexOf('INVALID_ARGUMENT') !== -1) {
          removeToken(cfg, t);
        }
      }
    });
  });

  commitCursor(fresh, lastAt, lastIds);
}

function sendTestPush() {
  var cfg = loadConfig();
  var tokens = fetchPushTokens(cfg);
  if (!tokens.length) throw new Error('No push tokens registered yet. Enable push in the web app first.');

  var accessToken = getAccessToken(cfg);
  tokens.forEach(function (t) {
    sendFcm(cfg, accessToken, buildMessage(cfg, {
      id: 'test-' + Date.now(),
      action: 'added',
      actorName: 'Test',
      type: 'income',
      amount: 1000,
      categoryLabel: 'Push test',
      walletName: 'Apps Script'
    }, t.token));
  });
}

function loadConfig() {
  var privateKey = normalizePrivateKey(PROPS.getProperty('SERVICE_ACCOUNT_PRIVATE_KEY'));

  if (privateKey.indexOf('-----BEGIN') !== 0 || privateKey.indexOf('-----END') === -1) {
    throw new Error(
      'SERVICE_ACCOUNT_PRIVATE_KEY is invalid. Paste only the "private_key" value from the service account JSON, ' +
        'including the -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- lines. ' +
        'Run debugPrivateKey() to inspect it.'
    );
  }

  var serviceAccountEmail = required('SERVICE_ACCOUNT_EMAIL')
    .trim()
    .replace(/^"|"$/g, '');

  if (serviceAccountEmail.indexOf('@') === -1 || serviceAccountEmail.indexOf('.iam.gserviceaccount.com') === -1) {
    throw new Error(
      'SERVICE_ACCOUNT_EMAIL must be the "client_email" from the service account JSON, ' +
        'e.g. firebase-adminsdk-xxxxx@bogisiwifam.iam.gserviceaccount.com. Got: ' +
        serviceAccountEmail
    );
  }

  return {
    projectId: required('FIREBASE_PROJECT_ID').trim(),
    dbUrl: required('FIREBASE_DB_URL').trim().replace(/\/$/, ''),
    serviceAccountEmail: serviceAccountEmail,
    privateKey: privateKey,
    appLink: (PROPS.getProperty('APP_LINK') || '').trim().replace(/\/$/, '')
  };
}

function debugConfig() {
  var cfg = loadConfig();
  Logger.log('projectId: %s', cfg.projectId);
  Logger.log('dbUrl: %s', cfg.dbUrl);
  Logger.log('serviceAccountEmail: %s', cfg.serviceAccountEmail);
  Logger.log('appLink: %s', cfg.appLink);
  Logger.log('private key length: %s', cfg.privateKey.length);
}

function debugDatabaseAccess() {
  var cfg = loadConfig();
  var token = getAccessToken(cfg);

  try {
    var info = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token),
      { muteHttpExceptions: true }
    );
    Logger.log('tokeninfo HTTP %s', info.getResponseCode());
    Logger.log('tokeninfo body: %s', info.getContentText());
  } catch (err) {
    Logger.log('tokeninfo failed: %s', err);
  }

  var base = cfg.dbUrl + '/notifications.json?shallow=true';

  try {
    var viaQuery = UrlFetchApp.fetch(base + '&access_token=' + encodeURIComponent(token), {
      muteHttpExceptions: true
    });
    Logger.log('query param -> HTTP %s: %s', viaQuery.getResponseCode(), viaQuery.getContentText());
  } catch (err) {
    Logger.log('query param failed: %s', err);
  }

  try {
    var viaHeader = UrlFetchApp.fetch(base, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    Logger.log('auth header -> HTTP %s: %s', viaHeader.getResponseCode(), viaHeader.getContentText());
  } catch (err) {
    Logger.log('auth header failed: %s', err);
  }
}

function normalizePrivateKey(raw) {
  var value = String(raw || '').trim();
  if (!value) return '';

  if (value.charAt(0) === '{' && value.indexOf('"private_key"') !== -1) {
    try {
      var parsed = JSON.parse(value);
      if (parsed.private_key) value = String(parsed.private_key);
    } catch (err) {
      /* not valid JSON, keep the raw value */
    }
  }

  if (
    (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
    (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")
  ) {
    value = value.slice(1, -1);
  }

  return value
    .replace(/\\r/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim();
}

function debugPrivateKey() {
  var raw = PROPS.getProperty('SERVICE_ACCOUNT_PRIVATE_KEY') || '';
  var key = normalizePrivateKey(raw);
  var lines = key.split('\n');

  Logger.log('raw length: %s', raw.length);
  Logger.log('normalized length: %s', key.length);
  Logger.log('has BEGIN header: %s', key.indexOf('-----BEGIN') === 0);
  Logger.log('has END footer: %s', key.indexOf('-----END') !== -1);
  Logger.log('line count: %s', lines.length);
  Logger.log('first line: %s', lines[0]);
  Logger.log('last line: %s', lines[lines.length - 1]);
  Logger.log('looks like PKCS#8: %s', key.indexOf('BEGIN PRIVATE KEY') !== -1);
  Logger.log('looks like PKCS#1: %s', key.indexOf('BEGIN RSA PRIVATE KEY') !== -1);
}

function required(name) {
  var value = PROPS.getProperty(name);
  if (!value) throw new Error('Missing Script Property: ' + name);
  return value;
}

function fetchNewNotifications(cfg, lastAt) {
  var url =
    cfg.dbUrl +
    '/notifications.json?orderBy=' +
    encodeURIComponent('"at"') +
    '&startAt=' +
    lastAt +
    '&limitToFirst=100';

  var data = dbGet(cfg, url);
  if (!data) return [];

  return Object.keys(data).map(function (id) {
    var entry = data[id] || {};
    entry.id = id;
    return entry;
  });
}

function fetchPushTokens(cfg) {
  var data = dbGet(cfg, cfg.dbUrl + '/pushTokens.json');
  if (!data) return [];

  var result = [];
  Object.keys(data).forEach(function (uid) {
    var tokens = data[uid] || {};
    Object.keys(tokens).forEach(function (key) {
      var entry = tokens[key] || {};
      if (entry.token) result.push({ uid: entry.uid || uid, token: entry.token, key: key });
    });
  });
  return result;
}

function removeToken(cfg, target) {
  var url =
    cfg.dbUrl +
    '/pushTokens/' +
    encodeURIComponent(target.uid) +
    '/' +
    encodeURIComponent(target.key) +
    '.json';
  try {
    UrlFetchApp.fetch(withAccessToken(url, getAccessToken(cfg)), {
      method: 'delete',
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log('Could not remove stale token: %s', err);
  }
}

function withAccessToken(url, accessToken) {
  return url + (url.indexOf('?') === -1 ? '?' : '&') + 'access_token=' + encodeURIComponent(accessToken);
}

function dbGet(cfg, url) {
  var response = UrlFetchApp.fetch(withAccessToken(url, getAccessToken(cfg)), {
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Realtime Database read failed: ' + response.getContentText());
  }

  return JSON.parse(response.getContentText() || 'null');
}

function buildMessage(cfg, notification, token) {
  var actionLabels = { added: 'added', updated: 'updated', deleted: 'deleted' };
  var action = actionLabels[notification.action] || 'changed';
  var amount = Number(notification.amount) || 0;
  var sign = notification.type === 'income' ? '+' : '-';
  var title = (notification.actorName || 'A family member') + ' ' + action + ' a transaction';
  var body =
    (notification.categoryLabel || notification.category || 'Transaction') +
    ' · ' +
    sign +
    amount.toLocaleString() +
    (notification.walletName ? ' · ' + notification.walletName : '');

  return {
    token: token,
    data: {
      title: title,
      body: body,
      tag: String(notification.id || ''),
      notificationId: String(notification.id || ''),
      kind: 'finance',
      link: cfg.appLink + '/finance'
    },
    webpush: {
      headers: { Urgency: 'high' },
      fcmOptions: { link: cfg.appLink + '/finance' }
    },
    android: { priority: 'high' }
  };
}

function sendFcm(cfg, accessToken, message) {
  var response = UrlFetchApp.fetch(
    'https://fcm.googleapis.com/v1/projects/' + cfg.projectId + '/messages:send',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + accessToken },
      payload: JSON.stringify({ message: message }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('FCM send failed: ' + response.getContentText());
  }
}

function getAccessToken(cfg) {
  var cached = CACHE.get(TOKEN_CACHE_KEY);
  if (cached) return cached;

  var now = Math.floor(Date.now() / 1000);
  var header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claims = base64Url(
    JSON.stringify({
      iss: cfg.serviceAccountEmail,
      scope: FCM_SCOPE + ' ' + DB_SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    })
  );
  var unsigned = header + '.' + claims;
  var signature = Utilities.computeRsaSha256Signature(unsigned, cfg.privateKey);
  var jwt = unsigned + '.' + Utilities.base64EncodeWebSafe(signature).replace(/=+$/, '');

  var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Service account token exchange failed: ' + response.getContentText());
  }

  var payload = JSON.parse(response.getContentText());
  CACHE.put(TOKEN_CACHE_KEY, payload.access_token, 3300);
  return payload.access_token;
}

function base64Url(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/, '');
}

function commitCursor(fresh, lastAt, lastIds) {
  var maxAt = lastAt;
  fresh.forEach(function (n) {
    var at = Number(n.at) || 0;
    if (at > maxAt) maxAt = at;
  });

  var idsAtMax = maxAt === lastAt ? lastIds.slice() : [];
  fresh.forEach(function (n) {
    if ((Number(n.at) || 0) === maxAt && idsAtMax.indexOf(n.id) === -1) {
      idsAtMax.push(n.id);
    }
  });

  PROPS.setProperty('LAST_PUSH_AT', String(maxAt));
  PROPS.setProperty('LAST_PUSH_IDS', JSON.stringify(idsAtMax));
}
