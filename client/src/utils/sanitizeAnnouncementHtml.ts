import sanitizeHtml from 'sanitize-html';

/** Quill / stored HTML that looks like markup (legacy plain text will not match). */
export function isLikelyAnnouncementHtml(content: string): boolean {
  const t = content.trim();
  if (!t) return false;
  return /<\s*(p|div|ul|ol|li|br|strong|em|b|i|span|a|h[1-6]|blockquote)\b/i.test(t);
}

export function escapeHtmlForQuillPlainText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap legacy plain-text body for the rich editor. */
export function plainTextToQuillHtml(text: string): string {
  const escaped = escapeHtmlForQuillPlainText(text);
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'a',
    'ul',
    'ol',
    'li',
    'span',
    'h1',
    'h2',
    'h3',
    'blockquote',
    'pre',
    'code'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    span: ['style', 'class'],
    '*': ['class']
  },
  allowedStyles: {
    '*': {
      'background-color': [/^rgb\(/, /^rgba\(/, /^#[0-9a-fA-F]{3,8}$/],
      color: [/^rgb\(/, /^rgba\(/, /^#[0-9a-fA-F]{3,8}$/]
    }
  },
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer'
      }
    })
  }
};

export function sanitizeAnnouncementHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/** True when there is no meaningful text (empty editor or only blank paragraphs). */
export function announcementHtmlIsEffectivelyEmpty(html: string): boolean {
  const plain = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return plain.replace(/\s|&nbsp;/g, '').length === 0;
}
