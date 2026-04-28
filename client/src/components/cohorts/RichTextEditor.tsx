import React, { useRef, useEffect, useCallback } from 'react';
import {
  Box,
  ButtonGroup,
  IconButton,
  Tooltip,
  Chip
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import LinkIcon from '@mui/icons-material/Link';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import AttachFileIcon from '@mui/icons-material/AttachFile';

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'span', 'ul', 'ol', 'li'];
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel', 'data-storage-bucket', 'data-storage-path']
};

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.includes(tag)) return Array.from(node.childNodes).map(walk).join('');
    const attrs = ALLOWED_ATTRS[tag];
    let attrStr = '';
    if (attrs && el.hasAttributes()) {
      attrs.forEach((a) => {
        let v = el.getAttribute(a);
        if (v) {
          if (a === 'href') {
            const lower = v.trim().toLowerCase();
            // Reject script-like schemes (no-script-url: we block these, not use them)
            const bad = /^(javascript|data|vbscript):/i;
            if (bad.test(lower)) v = '#';
          }
          attrStr += ` ${a}="${v.replace(/"/g, '&quot;')}"`;
        }
      });
    }
    const inner = Array.from(node.childNodes).map(walk).join('');
    if (tag === 'a') return `<a${attrStr} target="_blank" rel="noopener noreferrer">${inner}</a>`;
    return `<${tag}${attrStr}>${inner}</${tag}>`;
  };
  return walk(doc.body).trim() || '';
}

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').trim();
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minRows?: number;
  disabled?: boolean;
  onAttach?: (files: File[]) => void;
  attachAccept?: string;
  attachments?: Array<{ name: string; url: string; type: string; size?: number }>;
  onRemoveAttachment?: (index: number) => void;
}

const editableSx = {
  minHeight: 120,
  maxHeight: 280,
  overflowY: 'auto' as const,
  padding: '14px',
  border: '1px solid rgba(0, 0, 0, 0.23)',
  borderRadius: 1,
  outline: 'none',
  '&:focus': {
    borderColor: 'primary.main',
    borderWidth: 2,
    padding: '13px'
  },
  '& a': {
    color: 'primary.main',
    textDecoration: 'underline'
  },
  '& ul': { paddingLeft: 24, margin: '0.25em 0' },
  '& ol': { paddingLeft: 24, margin: '0.25em 0' },
  '& li': { display: 'list-item', marginBottom: 2 }
};

function getSelectionOffsets(root: Node): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  let current = 0;
  let start = -1;
  let end = -1;
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (node === range.startContainer) start = current + range.startOffset;
      if (node === range.endContainer) end = current + range.endOffset;
      current += len;
      return;
    }
    for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
  };
  walk(root);
  if (start < 0) start = current;
  if (end < 0) end = current;
  return { start, end };
}

function setSelectionOffsets(root: Node, start: number, end: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  let cur = 0;
  let startNode: Node | null = null;
  let startOff = 0;
  let endNode: Node | null = null;
  let endOff = 0;
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (startNode == null && cur + len >= start) {
        startNode = node;
        startOff = Math.min(start - cur, len);
      }
      if (endNode == null && cur + len >= end) {
        endNode = node;
        endOff = Math.min(end - cur, len);
        return;
      }
      cur += len;
      return;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i]);
      if (endNode) return;
    }
  };
  walk(root);
  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your message...',
  minRows = 3,
  disabled,
  onAttach,
  attachAccept,
  attachments = [],
  onRemoveAttachment
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || value === lastValueRef.current) return;
    lastValueRef.current = value;
    const saved = getSelectionOffsets(el);
    el.innerHTML = value || '';
    if (saved) {
      requestAnimationFrame(() => setSelectionOffsets(el, saved.start, saved.end));
    }
  }, [value]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const newVal = sanitizeHtml(el.innerHTML);
    lastValueRef.current = newVal;
    onChange(newVal);
  }, [onChange]);

  const exec = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  const handleBold = () => exec('bold');
  const handleItalic = () => exec('italic');
  const handleLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) exec('createLink', url);
  };
  const handleBulletList = () => exec('insertUnorderedList');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length && onAttach) onAttach(Array.from(files));
    e.target.value = '';
  };

  return (
    <Box>
      <ButtonGroup size="small" sx={{ mb: 0.5 }}>
        <Tooltip title="Bold">
          <IconButton onClick={handleBold} disabled={disabled} aria-label="Bold">
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic">
          <IconButton onClick={handleItalic} disabled={disabled} aria-label="Italic">
            <FormatItalicIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Insert link">
          <IconButton onClick={handleLink} disabled={disabled} aria-label="Insert link">
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Bullet list">
          <IconButton onClick={handleBulletList} disabled={disabled} aria-label="Bullet list">
            <FormatListBulletedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {onAttach && (
          <Tooltip title="Attach file">
            <IconButton component="label" disabled={disabled} aria-label="Attach file">
              <AttachFileIcon fontSize="small" />
              <input type="file" hidden multiple accept={attachAccept} onChange={handleFileChange} />
            </IconButton>
          </Tooltip>
        )}
      </ButtonGroup>
      <Box
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onPaste={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        sx={{
          ...editableSx,
          minHeight: minRows * 24,
          bgcolor: disabled ? 'action.hover' : undefined
        }}
      />
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: rgba(0,0,0,0.38);
        }
      `}</style>
      {attachments.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {attachments.map((att, i) => (
            <Chip
              key={i}
              size="small"
              label={att.name}
              onDelete={onRemoveAttachment ? () => onRemoveAttachment(i) : undefined}
              component="a"
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              clickable
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default RichTextEditor;
