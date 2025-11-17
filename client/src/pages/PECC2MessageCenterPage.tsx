import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Message as MessageIcon,
  Send as SendIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

interface Message {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
}

const PECC2MessageCenterPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'Dr. Sarah Johnson',
      recipient: 'PECC2 Team',
      subject: 'Welcome to PECC2 Message Center',
      content: 'Welcome to the PECC2 Message Center! This is where you can communicate with your team members, mentors, and other PECC2 coordinators.',
      timestamp: new Date('2024-01-15T10:30:00'),
      isRead: false,
      priority: 'high'
    },
    {
      id: '2',
      sender: 'PECC2 Mentor',
      recipient: 'PECC2 Team',
      subject: 'Monthly Check-in Reminder',
      content: 'Don\'t forget about our monthly check-in meeting scheduled for next week. Please prepare your progress reports.',
      timestamp: new Date('2024-01-14T14:20:00'),
      isRead: true,
      priority: 'medium'
    },
    {
      id: '3',
      sender: 'Emergency Department',
      recipient: 'PECC2 Team',
      subject: 'New Pediatric Protocols',
      content: 'We have updated our pediatric emergency protocols. Please review the attached documents and provide feedback.',
      timestamp: new Date('2024-01-13T09:15:00'),
      isRead: true,
      priority: 'low'
    }
  ]);

  const [newMessageDialog, setNewMessageDialog] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [newMessage, setNewMessage] = useState({
    recipient: '',
    subject: '',
    content: ''
  });

  const handleSendMessage = () => {
    if (newMessage.recipient && newMessage.subject && newMessage.content) {
      const message: Message = {
        id: Date.now().toString(),
        sender: 'PECC2 User',
        recipient: newMessage.recipient,
        subject: newMessage.subject,
        content: newMessage.content,
        timestamp: new Date(),
        isRead: false,
        priority: 'medium'
      };
      
      setMessages([message, ...messages]);
      setNewMessage({ recipient: '', subject: '', content: '' });
      setNewMessageDialog(false);
    }
  };

  const handleMessageClick = (message: Message) => {
    setSelectedMessage(message);
    // Mark as read
    setMessages(messages.map(m => 
      m.id === message.id ? { ...m, isRead: true } : m
    ));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: isMobile ? 2 : 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant={isMobile ? "h4" : "h3"} gutterBottom color="primary">
              PECC2 Message Center
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Communicate with your team and mentors
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewMessageDialog(true)}
            sx={{ fontSize: '0.875rem' }}
          >
            New Message
          </Button>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {messages.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Messages
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error">
                  {unreadCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Unread Messages
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {messages.filter(m => m.priority === 'high').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  High Priority
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Messages List */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Messages
            </Typography>
            {messages.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <MessageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No messages yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start a conversation by sending your first message
                </Typography>
              </Box>
            ) : (
              <List>
                {messages.map((message) => (
                  <ListItem
                    key={message.id}
                    button
                    onClick={() => handleMessageClick(message)}
                    sx={{
                      backgroundColor: message.isRead ? 'transparent' : 'action.hover',
                      borderRadius: 1,
                      mb: 1,
                      '&:hover': {
                        backgroundColor: 'action.selected'
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: message.isRead ? 'normal' : 'bold' }}>
                            {message.subject}
                          </Typography>
                          <Chip
                            label={message.priority.toUpperCase()}
                            size="small"
                            color={getPriorityColor(message.priority) as any}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            From: {message.sender} • To: {message.recipient}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {message.content.length > 100 
                              ? `${message.content.substring(0, 100)}...` 
                              : message.content
                            }
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <ScheduleIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {message.timestamp.toLocaleDateString()} at {message.timestamp.toLocaleTimeString()}
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* New Message Dialog */}
        <Dialog open={newMessageDialog} onClose={() => setNewMessageDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Send New Message</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Recipient"
              value={newMessage.recipient}
              onChange={(e) => setNewMessage({ ...newMessage, recipient: e.target.value })}
              margin="normal"
              placeholder="Enter recipient name or email"
            />
            <TextField
              fullWidth
              label="Subject"
              value={newMessage.subject}
              onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
              margin="normal"
              placeholder="Enter message subject"
            />
            <TextField
              fullWidth
              label="Message"
              value={newMessage.content}
              onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
              margin="normal"
              multiline
              rows={4}
              placeholder="Type your message here..."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewMessageDialog(false)}>Cancel</Button>
            <Button onClick={handleSendMessage} variant="contained" startIcon={<SendIcon />}>
              Send Message
            </Button>
          </DialogActions>
        </Dialog>

        {/* Message Detail Dialog */}
        <Dialog open={!!selectedMessage} onClose={() => setSelectedMessage(null)} maxWidth="md" fullWidth>
          {selectedMessage && (
            <>
              <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6">{selectedMessage.subject}</Typography>
                  <Chip
                    label={selectedMessage.priority.toUpperCase()}
                    size="small"
                    color={getPriorityColor(selectedMessage.priority) as any}
                  />
                </Box>
              </DialogTitle>
              <DialogContent>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    From: {selectedMessage.sender}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    To: {selectedMessage.recipient}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Date: {selectedMessage.timestamp.toLocaleDateString()} at {selectedMessage.timestamp.toLocaleTimeString()}
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedMessage.content}
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setSelectedMessage(null)}>Close</Button>
                <Button variant="contained" startIcon={<SendIcon />}>
                  Reply
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </Container>
  );
};

export default PECC2MessageCenterPage;
