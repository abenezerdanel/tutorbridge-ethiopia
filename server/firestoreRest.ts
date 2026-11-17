// Firebase Auth JWT Verifier & Firestore REST v1 Client
// Uses Node 22 built-in crypto + fetch with caller's verified Firebase ID token.
// Strictly erasable TypeScript.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<FirebaseAppletConfig>;
  if (!parsed.projectId || !parsed.firestoreDatabaseId) {
    throw new Error('Missing projectId or firestoreDatabaseId in firebase-applet-config.json');
  }
  return {
    projectId: parsed.projectId,
    firestoreDatabaseId: parsed.firestoreDatabaseId,
  };
}

export const FIREBASE_CONFIG = loadFirebaseConfig();

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

interface GoogleJwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

let cachedJwks: Record<string, GoogleJwk> = {};
let jwksExpiresAt = 0;

async function getGoogleJwks(): Promise<Record<string, GoogleJwk>> {
  const now = Date.now();
  if (now < jwksExpiresAt && Object.keys(cachedJwks).length > 0) {
    return cachedJwks;
  }

  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase JWKS: ${res.status}`);
  }
  const data = (await res.json()) as { keys?: GoogleJwk[] };
  const map: Record<string, GoogleJwk> = {};
  for (const key of data.keys ?? []) {
    if (key.kid) {
      map[key.kid] = key;
    }
  }
  cachedJwks = map;
  jwksExpiresAt = now + 1000 * 60 * 30; // 30 minutes
  return map;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as T;
}

function decodeBase64UrlBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported JWT algorithm or missing kid');
  }

  const jwks = await getGoogleJwks();
  let jwk = jwks[header.kid];
  if (!jwk) {
    // Force refresh once in case of key rotation
    jwksExpiresAt = 0;
    const refreshed = await getGoogleJwks();
    jwk = refreshed[header.kid];
  }
  if (!jwk) {
    throw new Error('Unable to find signing key for Firebase token');
  }

  const publicKey = crypto.createPublicKey({
    key: {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    },
    format: 'jwk',
  });

  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = decodeBase64UrlBuffer(sigB64);
  const validSig = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
  if (!validSig) {
    throw new Error('Invalid Firebase ID token signature');
  }

  const payload = decodeBase64UrlJson<{
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
  }>(payloadB64);

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_CONFIG.projectId) {
    throw new Error('Token audience mismatch');
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_CONFIG.projectId}`) {
    throw new Error('Token issuer mismatch');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Token subject missing');
  }
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Firebase ID token expired');
  }
  if (payload.iat && payload.iat > nowSec + 300) {
    throw new Error('Token issued-at is in the future');
  }

  return {
    uid: payload.sub,
    email: payload.email ?? '',
    emailVerified: payload.email_verified === true,
    name: payload.name ?? payload.email ?? 'TutorBridge User',
  };
}

// Firestore REST value encoding & decoding
export type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

export function fromFirestoreValue(val: FirestoreValue): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values ?? []).map((v) => fromFirestoreValue(v));
  }
  if ('mapValue' in val) {
    return fromFirestoreFields(val.mapValue.fields ?? {});
  }
  return null;
}

export function fromFirestoreFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = fromFirestoreValue(v);
  }
  return out;
}

export function docResourceName(collection: string, docId: string): string {
  return `projects/${FIREBASE_CONFIG.projectId}/databases/${FIREBASE_CONFIG.firestoreDatabaseId}/documents/${collection}/${docId}`;
}

function firestoreBaseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/${FIREBASE_CONFIG.firestoreDatabaseId}/documents`;
}

export async function getDocRest(
  collection: string,
  docId: string,
  idToken: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const url = `${firestoreBaseUrl()}/${collection}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore getDoc(${collection}/${docId}) failed (${res.status}): ${errText}`);
  }
  const docJson = (await res.json()) as { fields?: Record<string, FirestoreValue> };
  return {
    id: docId,
    ...fromFirestoreFields(docJson.fields ?? {}),
  };
}

export interface FirestoreRestWrite {
  update: {
    name: string;
    fields: Record<string, FirestoreValue>;
  };
  updateMask?: { fieldPaths: string[] };
  updateTransforms?: Array<{
    fieldPath: string;
    setToServerValue: 'REQUEST_TIME';
  }>;
  currentDocument?: { exists: boolean };
}

export async function commitWritesRest(
  writes: FirestoreRestWrite[],
  idToken: string
): Promise<void> {
  const url = `${firestoreBaseUrl()}:commit`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore commit failed (${res.status}): ${errText}`);
  }
}

export async function runQueryRest(
  structuredQuery: Record<string, unknown>,
  idToken: string
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const url = `${firestoreBaseUrl()}:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore runQuery failed (${res.status}): ${errText}`);
  }
  const rows = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, FirestoreValue> };
  }>;
  const results: Array<Record<string, unknown> & { id: string }> = [];
  for (const row of rows) {
    if (row.document && row.document.fields) {
      const parts = row.document.name.split('/');
      const id = parts[parts.length - 1] ?? '';
      results.push({
        id,
        ...fromFirestoreFields(row.document.fields),
      });
    }
  }
  return results;
}
