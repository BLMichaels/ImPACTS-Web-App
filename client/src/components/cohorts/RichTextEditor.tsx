import React, { useRef, useEffect } from 'react';
import { Box, IconButton, Tooltip, Divider } from '@mui/material';
import {
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  FormatListBulleted as FormatListBulletedIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  AttachFile as AttachFileIcon,
  Save as SaveIcon
} from '@mui/icons-material';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSaveDraft?: () => void;
  onFileUpload?: (file: File) => Promise<string | null>;
  placeholder?: string;
  minHeight?: number;
  showSaveDraft?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onSaveDraft,
  onFileUpload,
  placeholder = 'Write your message...',
  minHeight = 120,
  showSaveDraft = true
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInternalChangeRef = useRef(false);

  useEffect(() => {
    // Only update if the change came from outside (prop change, not user input)
    if (editorRef.current && !isInternalChangeRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
    isInternalChangeRef.current = false;
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChangeRef.current = true; // Mark as internal change
      onChange(editorRef.current.innerHTML);
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

  const handleBulletList = () => execCommand('insertUnorderedList');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;

    const url = await onFileUpload(file);
    if (url && editorRef.current) {
      if (file.type.startsWith('image/')) {
        execCommand('insertImage', url);
      } else {
        // For PDFs and other files, insert as link
        const link = document.createElement('a');
        link.href = url;
        link.textContent = file.name;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          selection.getRangeAt(0).insertNode(link);
          handleInput();
        }
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
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
        {onFileUpload && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Upload Image">
              <IconButton 
                size="small" 
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                  }
                }}
              >
                <ImageIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Upload File (PDF, etc.)">
              <IconButton 
                size="small" 
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = '.pdf,.doc,.docx';
                    fileInputRef.current.click();
                  }
                }}
              >
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
        {showSaveDraft && onSaveDraft && (
          <>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Save Draft">
              <IconButton size="small" onClick={onSaveDraft} color="primary">
                <SaveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Editor */}
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
          '& img': {
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 1,
            margin: '8px 0'
          },
          '& a': {
            color: 'primary.main',
            textDecoration: 'underline'
          },
          '& ul, & ol': {
            marginLeft: '20px',
            paddingLeft: '20px'
          },
          '& u': {
            textDecoration: 'underline'
          }
        }}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </Box>
  );
};

export default RichTextEditor;
