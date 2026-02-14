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
import AttachFileIcon from '@mui/icons-material/AttachFile';

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'span', 'ul', 'ol', 'li'];
const ALLOWED_ATTRS: Record<string, string[]> = { a: ['href', 'target', 'rel'] };

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
        const v = el.getAttribute(a);
        if (v) attrStr += ` ${a}="${v.replace(/"/g, '&quot;')}"`;
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
  attachments?: Array<{ name: string; url: string; type: string; size?: number }>;
  onRemoveAttachment?: (index: number) => void;
}

const editableSx = {
  minHeight: 120,
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
  }
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your message...',
  minRows = 3,
  disabled,
  onAttach,
  attachments = [],
  onRemoveAttachment
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (el) onChange(sanitizeHtml(el.innerHTML));
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
        {onAttach && (
          <Tooltip title="Attach file">
            <IconButton component="label" disabled={disabled} aria-label="Attach file">
              <AttachFileIcon fontSize="small" />
              <input type="file" hidden multiple onChange={handleFileChange} />
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
