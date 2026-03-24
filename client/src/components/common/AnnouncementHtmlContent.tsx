import React from 'react';
import { Box } from '@mui/material';
import {
  isLikelyAnnouncementHtml,
  sanitizeAnnouncementHtml
} from '../../utils/sanitizeAnnouncementHtml';

interface AnnouncementHtmlContentProps {
  html: string;
}

/**
 * Renders announcement body: legacy plain text as pre-wrapped text, HTML as sanitized markup.
 */
export const AnnouncementHtmlContent: React.FC<AnnouncementHtmlContentProps> = ({ html }) => {
  if (!isLikelyAnnouncementHtml(html)) {
    return (
      <Box
        component="div"
        sx={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          mb: 2
        }}
      >
        {html}
      </Box>
    );
  }

  return (
    <Box
      component="div"
      className="announcement-html-body"
      sx={{
        mb: 2,
        wordBreak: 'break-word',
        '& p': { mb: 1 },
        '& p:last-child': { mb: 0 },
        '& ul, & ol': { pl: 2.5, my: 1 },
        '& li': { mb: 0.5 },
        '& a': { color: 'primary.main' },
        '& a:hover': { textDecoration: 'underline' }
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(html) }}
    />
  );
};
