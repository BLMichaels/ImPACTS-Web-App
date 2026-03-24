import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  Link as LinkIcon,
  Highlight as HighlightIcon
} from '@mui/icons-material';

interface AnnouncementRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  minEditorPx?: number;
}

const EDITOR_MIN = 220;

export const AnnouncementRichTextEditor: React.FC<AnnouncementRichTextEditorProps> = ({
  value,
  onChange,
  label = 'Message body',
  minEditorPx = EDITOR_MIN
}) => {
  const modules = useMemo(
    () => ({
      toolbar: [
        ['bold', 'italic'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        [{ background: [] }]
      ]
    }),
    []
  );

  const formats = useMemo(
    () => ['bold', 'italic', 'list', 'bullet', 'link', 'background'],
    []
  );

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ mb: 1 }}>
        {label}
      </Typography>

      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Formatting toolbar (directly above the text area)
        </Typography>
        <Typography variant="body2" component="div" sx={{ mb: 1.5 }}>
          Use the horizontal toolbar with icons for:
        </Typography>
        <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
          <Typography component="li" variant="body2">
            <strong>B</strong> / <em>I</em> — bold and italic
          </Typography>
          <Typography component="li" variant="body2">
            Numbered list and bullet list
          </Typography>
          <Typography component="li" variant="body2">
            Link — select text, then click the link icon
          </Typography>
          <Typography component="li" variant="body2">
            Highlight — background color (paint bucket) for text highlight
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5, alignItems: 'center' }}>
          <FormatBold fontSize="small" color="action" aria-hidden />
          <FormatItalic fontSize="small" color="action" aria-hidden />
          <FormatListNumbered fontSize="small" color="action" aria-hidden />
          <FormatListBulleted fontSize="small" color="action" aria-hidden />
          <LinkIcon fontSize="small" color="action" aria-hidden />
          <HighlightIcon fontSize="small" color="action" aria-hidden />
          <Typography variant="caption" color="text.secondary">
            Match these to the buttons in the toolbar
          </Typography>
        </Stack>
      </Alert>

      <Paper
        variant="outlined"
        sx={{
          p: 0,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: 'primary.main',
          bgcolor: 'background.paper'
        }}
      >
        {/*
          Quill sets .ql-container { height: 100% }; without a defined parent height the editor
          collapses and the toolbar can disappear. Fix with flex + min heights.
        */}
        <Box
          className="announcement-rich-text-editor"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 320,
            maxHeight: 520,
            '& .quill': {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 280,
              overflow: 'hidden'
            },
            '& .ql-toolbar.ql-snow': {
              flexShrink: 0,
              display: 'block',
              visibility: 'visible',
              border: 'none',
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              px: 1,
              py: 0.5
            },
            '& .ql-container.ql-snow': {
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              minHeight: minEditorPx,
              height: 'auto !important',
              border: 'none !important',
              borderTop: 'none'
            },
            '& .ql-editor': {
              flex: '1 1 auto',
              minHeight: `${minEditorPx}px`,
              maxHeight: 360,
              overflowY: 'auto',
              height: 'auto !important',
              fontFamily: 'inherit',
              fontSize: '1rem'
            }
          }}
        >
          <ReactQuill
            theme="snow"
            value={value}
            onChange={onChange}
            modules={modules}
            formats={formats}
            placeholder="Write your announcement…"
          />
        </Box>
      </Paper>
    </Box>
  );
};
