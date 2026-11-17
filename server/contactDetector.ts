// Server-side Contact Protection & Obfuscation Detection Engine
// Strictly erasable TypeScript compatible with Node 22 native execution & tsx.

export type ViolationType =
  | 'phone_number'
  | 'whatsapp'
  | 'email'
  | 'website_url'
  | 'social_media'
  | 'external_meeting'
  | 'split_contact'
  | 'suspicious_attachment'
  | 'obfuscated_contact'
  | 'uncertain_review';

export type DetectionVerdict = 'approved' | 'blocked' | 'flagged_for_review' | 'approved_exception';

export interface ModerationSettingsConfig {
  blockPhoneNumbers: boolean;
  blockWhatsApp: boolean;
  blockEmails: boolean;
  blockUrls: boolean;
  blockSocialMedia: boolean;
  blockMeetingLinks: boolean;
  detectSplitMessages: boolean;
  scanAttachments: boolean;
  warningThreshold: number;
  tempRestrictionThreshold: number;
  suspensionReviewThreshold: number;
  tempRestrictionHours: number;
  approvedExceptions: string[];
}

export const DEFAULT_MODERATION_SETTINGS: ModerationSettingsConfig = {
  blockPhoneNumbers: true,
  blockWhatsApp: true,
  blockEmails: true,
  blockUrls: true,
  blockSocialMedia: true,
  blockMeetingLinks: true,
  detectSplitMessages: true,
  scanAttachments: true,
  warningThreshold: 1,
  tempRestrictionThreshold: 3,
  suspensionReviewThreshold: 5,
  tempRestrictionHours: 24,
  approvedExceptions: [
    'tutorbridge.et',
    'support@tutorbridge.et',
  ],
};

export interface DetectionResult {
  verdict: DetectionVerdict;
  violationType: ViolationType | null;
  matchedIndicators: string[];
  reason: string;
  normalizedSample: string;
}

export interface AttachmentScanInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  base64Content?: string;
  textPreview?: string;
}

export interface AttachmentScanResult {
  allowed: boolean;
  status: 'clean' | 'flagged' | 'blocked';
  violationType: ViolationType | null;
  matchedIndicators: string[];
  scanCapability: 'full_text_extract' | 'filename_and_text_metadata_only';
  scanNote: string;
}

const CONTACT_PROTECTION_WARNING_TEXT =
  'To protect your privacy and ensure secure transactions, TutorBridge requires all communication and service arrangements to remain within the platform. Sharing personal contact information or external links is not permitted.';

export { CONTACT_PROTECTION_WARNING_TEXT };

const DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  oh: '0',
  bado: '0',
  one: '1',
  and: '1',
  two: '2',
  hulet: '2',
  three: '3',
  sost: '3',
  four: '4',
  arat: '4',
  five: '5',
  amist: '5',
  six: '6',
  sidist: '6',
  seven: '7',
  sebat: '7',
  eight: '8',
  simint: '8',
  nine: '9',
  zetegn: '9',
};

const CYRILLIC_TO_LATIN: Record<string, string> = {
  '\u0430': 'a',
  '\u0435': 'e',
  '\u043E': 'o',
  '\u0440': 'p',
  '\u0441': 'c',
  '\u0445': 'x',
  '\u0443': 'y',
  '\u0410': 'A',
  '\u0415': 'E',
  '\u041E': 'O',
  '\u0420': 'P',
  '\u0421': 'C',
  '\u0425': 'X',
};

export function normalizeUnicodeAndHomoglyphs(raw: string): string {
  // Remove zero-width & soft-hyphen invisible characters
  let out = raw.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD]/g, '');

  // Convert fullwidth ASCII variants (FF01..FF5E) to standard ASCII
  out = out.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );

  // Replace common Cyrillic lookalikes
  out = out.replace(/[\u0410\u0415\u041E\u0420\u0421\u0425\u0430\u0435\u043E\u0440\u0441\u0445\u0443]/g, (ch) =>
    CYRILLIC_TO_LATIN[ch] ?? ch
  );

  // Normalize curly quotes and extra whitespace
  out = out.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  return out;
}

export function collapseSpelledDigitWords(text: string): { converted: string; foundWordSequence: boolean } {
  const tokens = text.split(/\s+/);
  const outTokens: string[] = [];
  let run: string[] = [];
  let foundWordSequence = false;

  const flushRun = () => {
    if (run.length >= 6) {
      foundWordSequence = true;
      outTokens.push(run.map((t) => DIGIT_WORDS[t]).join(''));
    } else if (run.length > 0) {
      outTokens.push(...run);
    }
    run = [];
  };

  for (const rawTok of tokens) {
    const clean = rawTok.toLowerCase().replace(/[^a-z]/g, '');
    if (clean && Object.prototype.hasOwnProperty.call(DIGIT_WORDS, clean)) {
      // Avoid converting casual English "and" unless we already started a numeric word run or next token is a digit word
      if (clean === 'and' && run.length === 0) {
        outTokens.push(rawTok);
      } else {
        run.push(clean);
      }
    } else {
      flushRun();
      outTokens.push(rawTok);
    }
  }
  flushRun();

  return {
    converted: outTokens.join(' '),
    foundWordSequence,
  };
}

export function normalizeObfuscatedContactForms(text: string): string {
  let out = normalizeUnicodeAndHomoglyphs(text);

  // Normalize obfuscated email markers: [at], (at), {at}, " at "
  out = out.replace(/\s*[\[\(\{]\s*at\s*[\]\)\}]\s*/gi, '@');
  out = out.replace(/\s*[\[\(\{]\s*dot\s*[\]\)\}]\s*/gi, '.');
  out = out.replace(/([a-z0-9._%+-]+)\s+at\s+([a-z0-9-]+)\s+dot\s+([a-z]{2,})/gi, '$1@$2.$3');
  out = out.replace(/([a-z0-9._%+-]+)\s*@\s*([a-z0-9-]+)\s*\.\s*([a-z]{2,})/gi, '$1@$2.$3');

  // Collapse spaced domain extensions like "gmail . com" or "wa . me /"
  out = out.replace(/\b(gmail|yahoo|outlook|hotmail|protonmail|icloud|yandex)\s*\.\s*(com|net|org|et|io)\b/gi, '$1.$2');
  out = out.replace(/\b(wa|t)\s*\.\s*(me)\s*\/\s*/gi, '$1.$2/');
  out = out.replace(/\b(zoom)\s*\.\s*(us)\b/gi, '$1.$2');
  out = out.replace(/\b(meet)\s*\.\s*(google)\s*\.\s*(com)\b/gi, '$1.$2.$3');

  return out;
}

function stripApprovedExceptions(text: string, approvedExceptions: string[]): string {
  let sanitized = text;
  // Always allow official TutorBridge internal links, support email, and internal invoice/booking tokens
  sanitized = sanitized.replace(/https?:\/\/(?:www\.)?tutorbridge\.et(?:\/[^\s]*)?/gi, ' [APPROVED_PLATFORM_LINK] ');
  sanitized = sanitized.replace(/\bsupport@tutorbridge\.et\b/gi, ' [APPROVED_SUPPORT_EMAIL] ');
  sanitized = sanitized.replace(/\bINV-CORP-\d{4}-[A-Z0-9-]+\b/gi, ' [APPROVED_INVOICE_REF] ');

  for (const exc of approvedExceptions) {
    const trimmed = exc.trim();
    if (trimmed.length < 3) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'gi');
    sanitized = sanitized.replace(rx, ' [APPROVED_EXCEPTION] ');
  }
  return sanitized;
}

function isEducationalCurriculumContext(text: string): boolean {
  return /\b(course|training|curriculum|module|lesson|workshop|syllabus|topic|learn|teach|strategy|ads|marketing|literacy|session|grade|chapter|exercise|math|physics|etb|birr)\b/i.test(
    text
  );
}

function isCurrencyOrScheduleNumber(matchSnippet: string, fullText: string): boolean {
  const escaped = matchSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const currencyRx = new RegExp(`${escaped}\\s*(etb|birr|usd|sessions?|hours?|mins?|minutes?|participants?|students?|grade)`, 'i');
  return currencyRx.test(fullText);
}

export function analyzeMessageText(
  rawText: string,
  settings: ModerationSettingsConfig = DEFAULT_MODERATION_SETTINGS,
  recentUserMessages: string[] = []
): DetectionResult {
  const normalizedBase = normalizeObfuscatedContactForms(rawText);
  const { converted: withWordsConverted, foundWordSequence } = collapseSpelledDigitWords(normalizedBase);
  const sanitized = stripApprovedExceptions(withWordsConverted, settings.approvedExceptions);

  // 1. Check external meeting links first (Zoom, Google Meet, Teams, etc.)
  if (settings.blockMeetingLinks) {
    const meetingRx = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com|discord\.gg|calendly\.com)(?:\/[^\s]*)?/gi;
    const meetingMatches = sanitized.match(meetingRx);
    if (meetingMatches && meetingMatches.length > 0) {
      return {
        verdict: 'blocked',
        violationType: 'external_meeting',
        matchedIndicators: meetingMatches.slice(0, 5),
        reason: 'External video meeting link detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }

    const meetingInviteRx = /\b(?:join\s+(?:my|our)\s+(?:zoom|google\s+meet|teams)|zoom\s+(?:id|link|passcode)|meet\s+link)\b/i;
    const inviteMatch = sanitized.match(meetingInviteRx);
    if (inviteMatch) {
      return {
        verdict: 'blocked',
        violationType: 'external_meeting',
        matchedIndicators: [inviteMatch[0]],
        reason: 'External meeting invitation phrase detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }
  }

  // 2. Check WhatsApp links & contact solicitation
  if (settings.blockWhatsApp) {
    const waLinkRx = /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\/[^\s]+/gi;
    const waLinks = sanitized.match(waLinkRx);
    if (waLinks && waLinks.length > 0) {
      return {
        verdict: 'blocked',
        violationType: 'whatsapp',
        matchedIndicators: waLinks.slice(0, 5),
        reason: 'WhatsApp link detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }

    const waSolicitRx = /\b(?:whatsapp\s+(?:me|us|number|account|chat|group)|(?:on|via|through|my|message\s+on|text\s+on|add\s+on)\s+whats?app)\b/i;
    const waSolicit = sanitized.match(waSolicitRx);
    if (waSolicit) {
      return {
        verdict: 'blocked',
        violationType: 'whatsapp',
        matchedIndicators: [waSolicit[0]],
        reason: 'WhatsApp off-platform communication solicitation detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }
  }

  // 3. Check Email addresses (direct + obfuscated)
  if (settings.blockEmails) {
    const emailRx = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
    const emails = sanitized.match(emailRx);
    if (emails && emails.length > 0) {
      return {
        verdict: 'blocked',
        violationType: 'email',
        matchedIndicators: emails.slice(0, 5),
        reason: 'Email address detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }

    // Spaced letter email provider obfuscation like "g m a i l . c o m"
    const spacedMailRx = /\b(?:g\s*m\s*a\s*i\s*l|y\s*a\s*h\s*o\s*o|h\s*o\s*t\s*m\s*a\s*i\s*l|o\s*u\s*t\s*l\s*o\s*o\s*k)\s*\.\s*c\s*o\s*m\b/i;
    const spacedMail = sanitized.match(spacedMailRx);
    if (spacedMail) {
      return {
        verdict: 'blocked',
        violationType: 'obfuscated_contact',
        matchedIndicators: [spacedMail[0]],
        reason: 'Obfuscated email provider detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }
  }

  // 4. Check Social Media links, solicitation, and @handles
  if (settings.blockSocialMedia) {
    const socialUrlRx = /(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog|facebook\.com|fb\.com|m\.me|instagram\.com|instagr\.am|tiktok\.com|linkedin\.com\/in|twitter\.com|x\.com|snapchat\.com\/add)\/[^\s]+/gi;
    const socialUrls = sanitized.match(socialUrlRx);
    if (socialUrls && socialUrls.length > 0) {
      return {
        verdict: 'blocked',
        violationType: 'social_media',
        matchedIndicators: socialUrls.slice(0, 5),
        reason: 'Social media profile or messaging link detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }

    // @username handle (excluding approved platform handle or email already checked)
    const handleRx = /(?:^|\s)(@[a-z0-9_.-]{3,32})\b/gi;
    const handles: string[] = [];
    let hMatch: RegExpExecArray | null;
    while ((hMatch = handleRx.exec(sanitized)) !== null) {
      if (hMatch[1] && hMatch[1].toLowerCase() !== '@tutorbridge') {
        handles.push(hMatch[1]);
      }
    }
    if (handles.length > 0) {
      return {
        verdict: 'blocked',
        violationType: 'social_media',
        matchedIndicators: handles.slice(0, 5),
        reason: 'External messaging or social media handle detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }

    const socialSolicitRx = /\b(?:(?:telegram|facebook|instagram|tiktok|snapchat|skype)\s+(?:me|id|username|handle|account|link)|(?:dm|message|reach|find|add|contact)\s+(?:me|us)\s+(?:on|via)\s+(?:telegram|facebook|instagram|tiktok|snapchat|fb|ig|tg)|my\s+(?:telegram|tg|facebook|fb|instagram|ig|tiktok)\s+(?:is|username|handle))\b/i;
    const socialSolicit = sanitized.match(socialSolicitRx);
    if (socialSolicit) {
      return {
        verdict: 'blocked',
        violationType: 'social_media',
        matchedIndicators: [socialSolicit[0]],
        reason: 'External social messaging solicitation detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }
  }

  // 5. Check Phone Numbers (Ethiopian +251 / 09 / 07, International, obfuscated spacing/words)
  if (settings.blockPhoneNumbers) {
    // Explicit Ethiopian & International numbers with optional separators
    const phonePatterns: RegExp[] = [
      /(?:\+|00)\s*2\s*5\s*1(?:[\s.\-()/]*\d){8,9}/g,
      /\b0[\s.\-()]*[79](?:[\s.\-()]*\d){8}\b/g,
      /\+[1-9](?:[\s.\-()]*\d){7,14}/g,
    ];
    for (const rx of phonePatterns) {
      const m = sanitized.match(rx);
      if (m && m.length > 0) {
        return {
          verdict: 'blocked',
          violationType: foundWordSequence ? 'obfuscated_contact' : 'phone_number',
          matchedIndicators: m.slice(0, 5),
          reason: foundWordSequence
            ? 'Spelled-out telephone number detected.'
            : 'Telephone number detected.',
          normalizedSample: sanitized.slice(0, 200),
        };
      }
    }

    // Compressed digit-only check on suspicious tokens or word-converted sequence
    if (foundWordSequence) {
      const digitsOnly = sanitized.replace(/\D/g, '');
      if (digitsOnly.length >= 8 && /^(?:251|09|07|9|7)/.test(digitsOnly)) {
        return {
          verdict: 'blocked',
          violationType: 'obfuscated_contact',
          matchedIndicators: ['spelled-digit-sequence'],
          reason: 'Obfuscated spelled-out telephone number detected.',
          normalizedSample: sanitized.slice(0, 200),
        };
      }
    }

    // Check ambiguous 7-10 digit runs (could be local phone missing leading 0 or math/budget)
    const digitRunRx = /\b\d[\d\s.\-]{6,14}\d\b/g;
    const digitRuns = sanitized.match(digitRunRx) ?? [];
    for (const run of digitRuns) {
      const compact = run.replace(/\D/g, '');
      if (compact.length >= 9 && compact.length <= 13 && !isCurrencyOrScheduleNumber(run, sanitized)) {
        if (/^(?:251|09|07|9\d{8}|7\d{8})/.test(compact)) {
          return {
            verdict: 'blocked',
            violationType: 'phone_number',
            matchedIndicators: [run],
            reason: 'Phone-formatted digit sequence detected.',
            normalizedSample: sanitized.slice(0, 200),
          };
        }
        // Ambiguous long number: check contact intent vs educational context
        if (/\b(?:call|phone|tel|mobile|number|reach|contact|text|ring|dial)\b/i.test(sanitized)) {
          return {
            verdict: 'blocked',
            violationType: 'phone_number',
            matchedIndicators: [run],
            reason: 'Suspected phone number shared with contact intent.',
            normalizedSample: sanitized.slice(0, 200),
          };
        }
        if (!isEducationalCurriculumContext(sanitized)) {
          return {
            verdict: 'flagged_for_review',
            violationType: 'uncertain_review',
            matchedIndicators: [run],
            reason: 'Unrecognized long numeric sequence flagged for moderator review.',
            normalizedSample: sanitized.slice(0, 200),
          };
        }
      }
    }
  }

  // 6. Check Generic External Website URLs
  if (settings.blockUrls) {
    const urlRx = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
    const urls = sanitized.match(urlRx);
    if (urls && urls.length > 0) {
      return {
        verdict: 'blocked',
        violationType: 'website_url',
        matchedIndicators: urls.slice(0, 5),
        reason: 'External website URL detected.',
        normalizedSample: sanitized.slice(0, 200),
      };
    }

    const bareDomainRx = /\b[a-z0-9-]{2,}\.(?:com|net|org|io|me|ly|gg|co|biz|info|xyz|et)(?:\/[^\s]*)?\b/gi;
    const domains = sanitized.match(bareDomainRx);
    if (domains && domains.length > 0) {
      // Allow common false-positives like "e.g." or file extensions inside curriculum sentences unless it looks like a real link
      const filteredDomains = domains.filter(
        (d) => !/\.(?:pdf|txt|csv|png|jpg|jpeg|docx)$/i.test(d)
      );
      if (filteredDomains.length > 0) {
        return {
          verdict: 'blocked',
          violationType: 'website_url',
          matchedIndicators: filteredDomains.slice(0, 5),
          reason: 'External domain link detected.',
          normalizedSample: sanitized.slice(0, 200),
        };
      }
    }
  }

  // 7. Cross-message split contact detection
  if (settings.detectSplitMessages && recentUserMessages.length > 0) {
    const combinedRaw = [...recentUserMessages.slice(-4), rawText].join(' ');
    const combinedNorm = stripApprovedExceptions(
      collapseSpelledDigitWords(normalizeObfuscatedContactForms(combinedRaw)).converted,
      settings.approvedExceptions
    );
    const combinedCompactDigits = combinedNorm.replace(/\D/g, '');
    const currentCompactDigits = sanitized.replace(/\D/g, '');

    if (
      currentCompactDigits.length >= 2 &&
      currentCompactDigits.length < 9 &&
      /(?:251|09|07)\d{7,9}/.test(combinedCompactDigits) &&
      !isEducationalCurriculumContext(sanitized)
    ) {
      return {
        verdict: 'blocked',
        violationType: 'split_contact',
        matchedIndicators: ['cross-message-phone-sequence'],
        reason: 'Attempted to split a telephone number across multiple consecutive messages.',
        normalizedSample: combinedNorm.slice(-160),
      };
    }

    const combinedEmailRx = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
    if (combinedEmailRx.test(combinedNorm) && !combinedEmailRx.test(sanitized)) {
      return {
        verdict: 'blocked',
        violationType: 'split_contact',
        matchedIndicators: ['cross-message-email'],
        reason: 'Attempted to split an email address across multiple consecutive messages.',
        normalizedSample: combinedNorm.slice(-160),
      };
    }
  }

  // 8. Uncertain solicitation keywords without explicit link (flag for admin review, do not falsely block)
  if (
    /\b(?:pay\s+(?:me\s+)?directly|cash\s+in\s+hand|avoid\s+(?:the\s+)?fee|outside\s+tutorbridge|off\s+platform)\b/i.test(
      sanitized
    )
  ) {
    const m = sanitized.match(/\b(?:pay\s+(?:me\s+)?directly|cash\s+in\s+hand|avoid\s+(?:the\s+)?fee|outside\s+tutorbridge|off\s+platform)\b/i);
    return {
      verdict: 'flagged_for_review',
      violationType: 'uncertain_review',
      matchedIndicators: m ? [m[0]] : ['off-platform-solicitation-phrase'],
      reason: 'Potential off-platform arrangement wording flagged for administrator review.',
      normalizedSample: sanitized.slice(0, 200),
    };
  }

  return {
    verdict: 'approved',
    violationType: null,
    matchedIndicators: [],
    reason: 'Clean message',
    normalizedSample: sanitized.slice(0, 200),
  };
}

const APPROVED_EXTENSIONS = new Set(['.pdf', '.txt', '.csv', '.png', '.jpg', '.jpeg', '.docx']);
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2 MB

export function scanAttachmentPayload(
  input: AttachmentScanInput,
  settings: ModerationSettingsConfig = DEFAULT_MODERATION_SETTINGS
): AttachmentScanResult {
  const lowerName = input.fileName.toLowerCase().trim();
  const dotIdx = lowerName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? lowerName.slice(dotIdx) : '';

  if (!APPROVED_EXTENSIONS.has(ext)) {
    return {
      allowed: false,
      status: 'blocked',
      violationType: 'suspicious_attachment',
      matchedIndicators: [ext || 'missing-extension'],
      scanCapability: 'filename_and_text_metadata_only',
      scanNote: 'File type is not on the approved educational document allowlist (.pdf, .txt, .csv, .png, .jpg, .jpeg, .docx).',
    };
  }

  if (input.sizeBytes > MAX_ATTACHMENT_BYTES) {
    return {
      allowed: false,
      status: 'blocked',
      violationType: 'suspicious_attachment',
      matchedIndicators: [`size:${input.sizeBytes}`],
      scanCapability: 'filename_and_text_metadata_only',
      scanNote: 'File exceeds maximum allowed 2 MB attachment size.',
    };
  }

  // Always scan the filename itself
  const fileNameCheck = analyzeMessageText(input.fileName.replace(/[_-]+/g, ' '), settings);
  if (fileNameCheck.verdict === 'blocked') {
    return {
      allowed: false,
      status: 'blocked',
      violationType: 'suspicious_attachment',
      matchedIndicators: fileNameCheck.matchedIndicators,
      scanCapability: 'filename_and_text_metadata_only',
      scanNote: `Attachment filename contains prohibited contact information (${fileNameCheck.reason}).`,
    };
  }

  const isImage = ext === '.png' || ext === '.jpg' || ext === '.jpeg';

  // Extract readable text from base64 payload or textPreview
  let extractedText = input.textPreview ?? '';
  if (input.base64Content) {
    try {
      const buf = Buffer.from(input.base64Content, 'base64');
      if (ext === '.txt' || ext === '.csv') {
        extractedText += '\n' + buf.toString('utf8');
      } else {
        // Extract printable ASCII runs (length >= 5) from PDF/DOCX/image metadata chunks
        const asciiRuns = buf.toString('latin1').match(/[\x20-\x7E]{5,}/g) ?? [];
        extractedText += '\n' + asciiRuns.slice(0, 600).join(' ');
      }
    } catch {
      // Ignore malformed base64 and fall back to textPreview/filename
    }
  }

  if (settings.scanAttachments && extractedText.trim().length > 0) {
    const contentCheck = analyzeMessageText(extractedText.slice(0, 30000), settings);
    if (contentCheck.verdict === 'blocked') {
      return {
        allowed: false,
        status: 'blocked',
        violationType: 'suspicious_attachment',
        matchedIndicators: contentCheck.matchedIndicators,
        scanCapability: isImage ? 'filename_and_text_metadata_only' : 'full_text_extract',
        scanNote: `Attachment content/metadata contains prohibited contact information (${contentCheck.reason}).`,
      };
    }
    if (contentCheck.verdict === 'flagged_for_review') {
      return {
        allowed: true,
        status: 'flagged',
        violationType: 'suspicious_attachment',
        matchedIndicators: contentCheck.matchedIndicators,
        scanCapability: isImage ? 'filename_and_text_metadata_only' : 'full_text_extract',
        scanNote: 'Attachment flagged for administrator moderation review.',
      };
    }
  }

  if (isImage) {
    const suspiciousImgName = /(?:^|[^a-z0-9])(qr|qrcode|contact|card|whatsapp|telegram|phone|call|wechat|viber)(?:[^a-z0-9]|$)/i.test(lowerName);
    if (suspiciousImgName) {
      return {
        allowed: true,
        status: 'flagged',
        violationType: 'suspicious_attachment',
        matchedIndicators: [input.fileName],
        scanCapability: 'filename_and_text_metadata_only',
        scanNote:
          'Image filename suggests potential QR or contact card; flagged for administrator review. Note: pixel OCR and QR image decoding are not performed locally.',
      };
    }
    return {
      allowed: true,
      status: 'clean',
      violationType: null,
      matchedIndicators: [],
      scanCapability: 'filename_and_text_metadata_only',
      scanNote:
        'Filename and embedded text metadata scanned cleanly. Note: full pixel OCR and QR decoding are not performed on image uploads.',
    };
  }

  return {
    allowed: true,
    status: 'clean',
    violationType: null,
    matchedIndicators: [],
    scanCapability: 'full_text_extract',
    scanNote: 'Attachment filename and extractable text scanned cleanly.',
  };
}
