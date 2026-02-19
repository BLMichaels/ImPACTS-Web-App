import React, { useRef, useEffect } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  Link as LinkIcon,
  FormatListBulleted as FormatListBulletedIcon
} from '@mui/icons-material';

interface EducationRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  label?: string;
}

const EducationRichTextEditor: React.FC<EducationRichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  minHeight = 120,
  label
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!editorRef.current) return;
    if (lastSentRef.current === value) return;
    lastSentRef.current = value;
    editorRef.current.innerHTML = value;
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastSentRef.current = html;
      onChange(html);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleBold = () => execCommand('bold');
  const handleItalic = () => execCommand('italic');
  const handleUnderline = () => execCommand('underline');

  const handleLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const handleBulletList = () => {
    execCommand('insertUnorderedList');
  };

  return (
    <Box>
      {label && (
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          {label}
        </Typography>
      )}
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        {/* Toolbar */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          p: 0.5,
          bgcolor: 'grey.50',
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Tooltip title="Bold">
            <IconButton size="small" onClick={handleBold}>
              <FormatBoldIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Italic">
            <IconButton size="small" onClick={handleItalic}>
              <FormatItalicIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Underline">
            <IconButton size="small" onClick={handleUnderline}>
              <FormatUnderlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Insert Link">
            <IconButton size="small" onClick={handleLink}>
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Bullet List">
            <IconButton size="small" onClick={handleBulletList}>
              <FormatListBulletedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Editor - dir="ltr" and no dangerouslySetInnerHTML to prevent backwards typing / caret jump */}
        <Box
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          dir="ltr"
          style={{
            minHeight: `${minHeight}px`,
            padding: '12px',
            outline: 'none',
            overflowY: 'auto',
            direction: 'ltr',
            textAlign: 'left'
          }}
          data-placeholder={placeholder}
          sx={{
            '&:empty:before': {
              content: 'attr(data-placeholder)',
              color: 'text.disabled',
              pointerEvents: 'none'
            },
            '& ul, & ol': {
              marginLeft: '20px',
              paddingLeft: '20px'
            },
            '& a': {
              color: 'primary.main',
              textDecoration: 'underline'
            },
            '& u': {
              textDecoration: 'underline'
            }
          }}
        />
      </Box>
    </Box>
  );
};

export default EducationRichTextEditor;
