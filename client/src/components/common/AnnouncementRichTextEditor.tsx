import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Box, Typography } from '@mui/material';

interface AnnouncementRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  minHeightPx?: number;
}

const DEFAULT_MIN = 200;

export const AnnouncementRichTextEditor: React.FC<AnnouncementRichTextEditorProps> = ({
  value,
  onChange,
  label = 'Content',
  minHeightPx = DEFAULT_MIN
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
        Bold, italic, lists, links, and highlight (background color). Links open in a new tab.
      </Typography>
      <Box
        className="announcement-rich-text-editor"
        sx={{
          '& .ql-toolbar': {
            borderTopLeftRadius: 1,
            borderTopRightRadius: 1,
            borderColor: 'divider'
          },
          '& .ql-container': {
            borderBottomLeftRadius: 1,
            borderBottomRightRadius: 1,
            borderColor: 'divider',
            fontFamily: 'inherit',
            fontSize: '1rem'
          },
          '& .ql-editor': {
            minHeight: minHeightPx,
            maxHeight: 360,
            overflowY: 'auto'
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
    </Box>
  );
};
