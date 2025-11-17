import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Link,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  useMediaQuery,
  useTheme,
  Container,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../context/UserProfileContext';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import SearchIcon from '@mui/icons-material/Search';
import GapPlanReminderBanner from '../components/GapPlanReminderBanner';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'link' | 'pdf' | 'image';
  description?: string;
  addedAt: Date;
  tags: string[];
  category: string;
  createdAt?: string;
  updatedAt?: string;
  lastSyncAt?: string;
}

interface DepartmentContact {
  id: string;
  department: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
}

  const DashboardPage = () => {
    const { userProfile } = useUserProfile();
    const { currentUser } = useAuth();
    const { syncResources } = useSync();
    const navigate = useNavigate();
    
    // Mobile responsiveness
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    
    
    // Handle clicks outside dropdowns
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
          setShowCategoryDropdown(false);
        }
        if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
          setShowTagDropdown(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [lastResourceHash, setLastResourceHash] = useState<string>('');

  // Load resources from BigQuery and localStorage
  useEffect(() => {
    const loadResources = async () => {
      if (!currentUser) return;
      
      try {
        // Only show loading if we don't have resources yet
        if (resources.length === 0) {
          setIsLoadingResources(true);
        }
        
        // First, try to get resources from BigQuery
        const bigQueryUrl = `https://68824ab5d5fb.ngrok-free.app/api/resources/${currentUser.uid}`;
        const response = await fetch(bigQueryUrl, {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });
        const result = await response.json();
        
        let bigQueryResources: Resource[] = [];
        if (result.success && result.resources) {
          bigQueryResources = result.resources.map((resource: any) => ({
            id: resource.resource_id,
            title: resource.title,
            url: resource.url,
            type: 'link' as const,
            description: resource.description,
            addedAt: new Date(resource.created_at?.value || resource.created_at),
            tags: resource.tags || [],
            category: resource.category,
            createdAt: resource.created_at?.value || resource.created_at,
            updatedAt: resource.updated_at?.value || resource.updated_at,
            lastSyncAt: resource.last_sync_at?.value || resource.last_sync_at
          }));
        }
        
        // Get resources from localStorage
        const localResourcesKey = `dashboard_resources_${currentUser.uid}`;
        const localResourcesData = localStorage.getItem(localResourcesKey);
        let localResources: Resource[] = localResourcesData ? JSON.parse(localResourcesData) : [];
        
        // If no local resources exist, create default resources
        if (localResources.length === 0) {
          const now = new Date().toISOString();
          localResources = [
            {
              id: 'default-1-new',
              title: 'Pediatric Readiness Toolkit',
              url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/',
              type: 'link' as const,
              description: 'Comprehensive toolkit for improving pediatric readiness',
              addedAt: new Date(),
              tags: ['toolkit', 'pediatric', 'readiness'],
              category: 'Guidelines',
              createdAt: now,
              updatedAt: now,
              lastSyncAt: now
            },
            {
              id: 'default-2-new',
              title: 'PECC Role Guidelines',
              url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/readiness-toolkit-checklist/pecc/',
              type: 'link' as const,
              description: 'Guidelines for Pediatric Emergency Care Coordinators',
              addedAt: new Date(),
              tags: ['guidelines', 'pecc', 'coordination'],
              category: 'Guidelines',
              createdAt: now,
              updatedAt: now,
              lastSyncAt: now
            }
          ];
          
          // Save default resources to localStorage
          localStorage.setItem(localResourcesKey, JSON.stringify(localResources));
        }
        
        // Merge BigQuery and local resources, prioritizing BigQuery for conflicts
        const mergedResources = [...bigQueryResources];
        const bigQueryIds = new Set(bigQueryResources.map(r => r.id));
        
        // Add local resources that aren't in BigQuery
        localResources.forEach(localResource => {
          if (!bigQueryIds.has(localResource.id)) {
            mergedResources.push(localResource);
          }
        });
        
        // Create a hash of the merged resources to detect changes
        const resourceHash = JSON.stringify(mergedResources.map(r => ({ id: r.id, title: r.title, url: r.url, updatedAt: r.updatedAt })));
        
        // Only update state if resources have actually changed
        if (resourceHash !== lastResourceHash) {
          console.log('📝 Resources changed, updating state');
          setResources(mergedResources);
          setLastResourceHash(resourceHash);
        } else {
          console.log('✅ No changes detected, skipping state update');
        }
        
        // If there are local resources not in BigQuery, sync them
        const unsyncedResources = localResources.filter(localResource => !bigQueryIds.has(localResource.id));
        if (unsyncedResources.length > 0 && syncResources) {
          console.log(`🔄 Syncing ${unsyncedResources.length} unsynced resources to BigQuery`);
          await syncResources(unsyncedResources.map(resource => ({
            resource_id: resource.id,
            user_id: currentUser.uid,
            title: resource.title,
            description: resource.description || '',
            url: resource.url,
            category: resource.category,
            tags: resource.tags || [],
            is_public: false,
            created_at: resource.createdAt || new Date().toISOString(),
            updated_at: resource.updatedAt || new Date().toISOString(),
            last_sync_at: new Date().toISOString()
          })));
        }
        
      } catch (error) {
        console.error('Error loading resources:', error);
        
        // Fallback to localStorage only
        const localResourcesKey = `dashboard_resources_${currentUser.uid}`;
        const localResourcesData = localStorage.getItem(localResourcesKey);
        const localResources: Resource[] = localResourcesData ? JSON.parse(localResourcesData) : [];
        setResources(localResources);
      } finally {
        setIsLoadingResources(false);
      }
    };
    
    loadResources();
  }, [currentUser, syncResources]);

  const [departmentContacts, setDepartmentContacts] = useState<DepartmentContact[]>([
    { id: '1', department: 'Chief Nursing Officer', contactName: '', phone: '', email: '', notes: '' },
    { id: '2', department: 'Chief Medical Officer', contactName: '', phone: '', email: '', notes: '' },
    { id: '3', department: 'Trauma Coordinator', contactName: '', phone: '', email: '', notes: '' },
    { id: '4', department: 'Emergency Nursing Director', contactName: '', phone: '', email: '', notes: '' },
    { id: '5', department: 'Emergency Medical Director', contactName: '', phone: '', email: '', notes: '' },
    { id: '6', department: 'Emergency Manager(s)', contactName: '', phone: '', email: '', notes: '' },
    { id: '7', department: 'Pharmacy Director', contactName: '', phone: '', email: '', notes: '' },
    { id: '8', department: 'Respiratory Therapy Director or Educator', contactName: '', phone: '', email: '', notes: '' },
    { id: '9', department: 'Pediatric Educator', contactName: '', phone: '', email: '', notes: '' },
    { id: '10', department: 'Emergency Dept Educator', contactName: '', phone: '', email: '', notes: '' },
    { id: '11', department: 'Peds Social Worker', contactName: '', phone: '', email: '', notes: '' },
    { id: '12', department: 'PICU Manager', contactName: '', phone: '', email: '', notes: '' },
    { id: '13', department: 'Pediatric Unit Manager', contactName: '', phone: '', email: '', notes: '' },
    { id: '14', department: 'Information Systems Contact', contactName: '', phone: '', email: '', notes: '' },
    { id: '15', department: 'Pediatric Hospitalist (Point Person)', contactName: '', phone: '', email: '', notes: '' },
    { id: '16', department: 'Pediatric Intensivist (Point Person)', contactName: '', phone: '', email: '', notes: '' },
    { id: '17', department: 'Pediatric Readiness Mentor', contactName: '', phone: '', email: '', notes: '' },
    { id: '18', department: 'Pediatric and/or Emergency Clinical Nurse Specialist', contactName: '', phone: '', email: '', notes: '' },
    { id: '19', department: 'OTHER CONTACT 1', contactName: '', phone: '', email: '', notes: '' },
    { id: '20', department: 'OTHER CONTACT 2', contactName: '', phone: '', email: '', notes: '' },
    { id: '21', department: 'OTHER CONTACT 3', contactName: '', phone: '', email: '', notes: '' },
    { id: '22', department: 'OTHER CONTACT 4', contactName: '', phone: '', email: '', notes: '' },
    { id: '23', department: 'OTHER CONTACT 5', contactName: '', phone: '', email: '', notes: '' },
    { id: '24', department: 'OTHER CONTACT 6', contactName: '', phone: '', email: '', notes: '' },
    { id: '25', department: 'OTHER CONTACT 7', contactName: '', phone: '', email: '', notes: '' },
    { id: '26', department: 'OTHER CONTACT 8', contactName: '', phone: '', email: '', notes: '' },
    { id: '27', department: 'OTHER CONTACT 9', contactName: '', phone: '', email: '', notes: '' },
    { id: '28', department: 'OTHER CONTACT 10', contactName: '', phone: '', email: '', notes: '' }
  ]);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof DepartmentContact;
    direction: 'asc' | 'desc';
  } | null>(null);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    contactId: string | null;
    contactName: string;
  }>({
    open: false,
    contactId: null,
    contactName: ''
  });
  
  const [addResourceDialog, setAddResourceDialog] = useState(false);
  const [editResourceDialog, setEditResourceDialog] = useState(false);
  const [currentResource, setCurrentResource] = useState<Resource | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [resourceForm, setResourceForm] = useState({
    title: '',
    url: '',
    type: 'link' as 'link' | 'pdf' | 'image',
    description: '',
    file: null as File | null,
    tags: [] as string[],
    category: ''
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setResourceForm({ ...resourceForm, file, url: file.name });
    }
  };

  const handleContactUpdate = (id: string, field: keyof DepartmentContact, value: string) => {
    setDepartmentContacts(prev => prev.map(contact => 
      contact.id === id ? { ...contact, [field]: value } : contact
    ));
  };

  const handleSort = (key: keyof DepartmentContact) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedContacts = () => {
    if (!sortConfig) return departmentContacts;
    
    return [...departmentContacts].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const addNewContact = () => {
    const newId = (Math.max(...departmentContacts.map(c => parseInt(c.id))) + 1).toString();
    const newContact: DepartmentContact = {
      id: newId,
      department: `NEW CONTACT ${newId}`,
      contactName: '',
      phone: '',
      email: '',
      notes: ''
    };
    setDepartmentContacts([...departmentContacts, newContact]);
  };

  const deleteContact = (id: string) => {
    setDepartmentContacts(prev => prev.filter(contact => contact.id !== id));
  };

  const handleDeleteContact = (contact: DepartmentContact) => {
    setDeleteConfirmDialog({
      open: true,
      contactId: contact.id,
      contactName: contact.department
    });
  };

  const confirmDeleteContact = () => {
    if (deleteConfirmDialog.contactId) {
      deleteContact(deleteConfirmDialog.contactId);
      setDeleteConfirmDialog({
        open: false,
        contactId: null,
        contactName: ''
      });
    }
  };

  const cancelDeleteContact = () => {
    setDeleteConfirmDialog({
      open: false,
      contactId: null,
      contactName: ''
    });
  };

  const handleAddResource = async () => {
    if (resourceForm.title && (resourceForm.url || resourceForm.file)) {
      const now = new Date().toISOString();
      const newResource: Resource = {
        id: Date.now().toString(),
        title: resourceForm.title,
        url: formatResourceUrl(resourceForm.url || ''),
        type: resourceForm.type,
        description: resourceForm.description,
        addedAt: new Date(),
        tags: resourceForm.tags,
        category: resourceForm.category,
        createdAt: now,
        updatedAt: now,
        lastSyncAt: now
      };
      
      // Update local state
      const updatedResources = [...resources, newResource];
      setResources(updatedResources);
      
      // Save to localStorage
      if (currentUser) {
        const localResourcesKey = `dashboard_resources_${currentUser.uid}`;
        localStorage.setItem(localResourcesKey, JSON.stringify(updatedResources));
      }
      
      // Sync to BigQuery
      if (currentUser && syncResources) {
        try {
          await syncResources([{
            resource_id: newResource.id,
            user_id: currentUser.uid,
            title: newResource.title,
            description: newResource.description || '',
            url: newResource.url,
            category: newResource.category,
            tags: newResource.tags || [],
            is_public: false,
            created_at: newResource.createdAt,
            updated_at: newResource.updatedAt,
            last_sync_at: newResource.lastSyncAt
          }]);
        } catch (error) {
          console.error('Error syncing resource to BigQuery:', error);
        }
      }
      
      setResourceForm({
        title: '',
        url: '',
        type: 'link',
        description: '',
        file: null,
        tags: [],
        category: ''
      });
      setAddResourceDialog(false);
    }
  };

  const handleEditResource = (resource: Resource) => {
    setCurrentResource(resource);
    setResourceForm({
      title: resource.title,
      url: resource.url,
      type: resource.type,
      description: resource.description || '',
      file: null,
      tags: resource.tags || [],
      category: resource.category || ''
    });
    setEditResourceDialog(true);
  };

  const handleUpdateResource = async () => {
    if (currentResource && resourceForm.title && (resourceForm.url || resourceForm.file)) {
      const now = new Date().toISOString();
      const updatedResource = {
        ...currentResource,
        title: resourceForm.title,
        url: formatResourceUrl(resourceForm.url || ''),
        type: resourceForm.type,
        description: resourceForm.description,
        tags: resourceForm.tags,
        category: resourceForm.category,
        updatedAt: now,
        lastSyncAt: now
      };
      
      // Update local state
      const updatedResources = resources.map(resource => 
        resource.id === currentResource.id ? updatedResource : resource
      );
      setResources(updatedResources);
      
      // Save to localStorage
      if (currentUser) {
        const localResourcesKey = `dashboard_resources_${currentUser.uid}`;
        localStorage.setItem(localResourcesKey, JSON.stringify(updatedResources));
      }
      
      // Sync to BigQuery
      if (currentUser && syncResources) {
        try {
          await syncResources([{
            resource_id: updatedResource.id,
            user_id: currentUser.uid,
            title: updatedResource.title,
            description: updatedResource.description || '',
            url: updatedResource.url,
            category: updatedResource.category,
            tags: updatedResource.tags || [],
            is_public: false,
            created_at: updatedResource.createdAt || now,
            updated_at: updatedResource.updatedAt,
            last_sync_at: updatedResource.lastSyncAt
          }]);
        } catch (error) {
          console.error('Error syncing updated resource to BigQuery:', error);
        }
      }
      
      setResourceForm({
        title: '',
        url: '',
        type: 'link',
        description: '',
        file: null,
        tags: [],
        category: ''
      });
      setCurrentResource(null);
      setEditResourceDialog(false);
    }
  };

  const handleDeleteResource = async (id: string) => {
    // Update local state
    const updatedResources = resources.filter(resource => resource.id !== id);
    setResources(updatedResources);
    
    // Save to localStorage
    if (currentUser) {
      const localResourcesKey = `dashboard_resources_${currentUser.uid}`;
      localStorage.setItem(localResourcesKey, JSON.stringify(updatedResources));
    }
    
    // Note: We don't sync deletions to BigQuery immediately as BigQuery doesn't support DELETE operations
    // The resource will remain in BigQuery but won't appear in the UI
    console.log(`Resource ${id} deleted locally`);
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'link':
        return <LinkIcon />;
      case 'pdf':
        return <PictureAsPdfIcon />;
      case 'image':
        return <ImageIcon />;
      default:
        return <LinkIcon />;
    }
  };

  const getResourceColor = (type: string) => {
    switch (type) {
      case 'link':
        return 'primary';
      case 'pdf':
        return 'error';
      case 'image':
        return 'success';
      default:
        return 'primary';
    }
  };

  // Get unique categories from resources
  const getCategories = () => {
    const categories = resources.map(r => r.category).filter(Boolean);
    return ['All', ...Array.from(new Set(categories))];
  };

  // Get unique tags from resources
  const getTags = () => {
    const allTags = resources.flatMap(r => r.tags || []);
    return Array.from(new Set(allTags));
  };

  // Filter resources based on search, category, and tags
  const getFilteredResources = () => {
    return resources.filter(resource => {
      const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           resource.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           resource.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'All' || resource.category === selectedCategory;
      
      const matchesTags = selectedTags.length === 0 || 
                         selectedTags.some(tag => resource.tags.includes(tag));
      
      return matchesSearch && matchesCategory && matchesTags;
    });
  };

  // Add new category
  const handleAddCategory = () => {
    if (newCategory.trim() && !getCategories().includes(newCategory.trim())) {
      setNewCategory('');
    }
  };

  // Add new tag
  const handleAddTag = () => {
    if (newTag.trim() && !getTags().includes(newTag.trim())) {
      setNewTag('');
    }
  };

  // Get category suggestions based on input
  const getCategorySuggestions = (input: string) => {
    if (!input.trim()) return [];
    const existingCategories = getCategories().filter(cat => cat !== 'All');
    return existingCategories.filter(cat => 
      cat.toLowerCase().includes(input.toLowerCase())
    );
  };

  // Get tag suggestions based on input
  const getTagSuggestions = (input: string) => {
    if (!input.trim()) return [];
    const existingTags = getTags();
    return existingTags.filter(tag => 
      tag.toLowerCase().includes(input.toLowerCase())
    );
  };

  // Handle category selection from dropdown
  const handleCategorySelect = (category: string) => {
    setResourceForm({ ...resourceForm, category });
  };

  // Handle tag selection from dropdown
  const handleTagSelect = (tag: string) => {
    if (!resourceForm.tags.includes(tag)) {
      setResourceForm({ 
        ...resourceForm, 
        tags: [...resourceForm.tags, tag]
      });
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setResourceForm({
      ...resourceForm,
      tags: resourceForm.tags.filter(tag => tag !== tagToRemove)
    });
  };

  // Format URL to ensure it has proper protocol
  const formatResourceUrl = (url: string): string => {
    if (!url) return '';
    
    // If URL already has a protocol, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If URL starts with www., add https://
    if (url.startsWith('www.')) {
      return `https://${url}`;
    }
    
    // For other URLs, add https://
    return `https://${url}`;
  };

  // Handle resource link click
  const handleResourceClick = (url: string) => {
    const formattedUrl = formatResourceUrl(url);
    window.open(formattedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: isMobile ? 2 : 4 }}>
        <GapPlanReminderBanner />
        
        {/* Welcome Section */}
        <Box sx={{ mb: isMobile ? 3 : 4 }}>
          <Typography variant={isMobile ? "h4" : "h3"} gutterBottom color="primary">
            Welcome back, {userProfile?.firstName || 'PECC'}!
          </Typography>
          <Typography variant={isMobile ? "body1" : "h6"} color="text.secondary" sx={{ mb: 2 }}>
            Your Pediatric Readiness Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track your progress, manage resources, and coordinate with your hospital team to improve pediatric emergency care readiness.
          </Typography>
        </Box>


        {/* How This Dashboard Works Section */}
        <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: isMobile ? 3 : 4 }}>
          <Grid item xs={12}>
          <Card sx={{ p: 2 }}>
            <CardContent>
              <Typography variant="h4" gutterBottom color="primary" sx={{ mb: 2 }}>
                How This Dashboard Works
              </Typography>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.4 }}>
                Welcome to your ImPACTS PECC Tracker! This dashboard is designed to guide you through your Pediatric Emergency Care Coordinator journey. Here's how to get started:
              </Typography>
              
              <Grid container spacing={isMobile ? 1 : 2} sx={{ mt: 2 }}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      📋 Checklist
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Track your progress through 4 stages: Establish, Implement, Lead, and Sustain. Each stage has specific objectives and tasks to complete.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      📊 Assessment
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Complete your facility's Pediatric Readiness Assessment and create gap reduction plans to address identified areas for improvement.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      📝 Activities
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Log your PECC activities, simulations, and training sessions. Track your time commitment and document your impact.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      📈 Snapshot
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      View analytics, charts, and metrics from your activities, milestones, assessment, and gap plans to track your overall progress.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      🎯 Gap Plans
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage and track your gap reduction action plans. Prioritize improvements and monitor progress toward pediatric readiness goals.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2, lineHeight: 1.4 }}>
                <strong>Pro Tip:</strong> Start with the Checklist tab to understand your journey, then use the Assessment tab to identify gaps, and log your activities to track your progress. Your pediatric readiness mentor will guide you through each stage!
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Hospital Department Contacts Section */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" color="primary">
            Hospital Department Contacts
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={isEditMode ? "contained" : "outlined"}
              startIcon={<EditIcon />}
              onClick={() => setIsEditMode(!isEditMode)}
              sx={{ fontSize: '0.875rem' }}
            >
              {isEditMode ? 'Exit Edit' : 'Edit Mode'}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addNewContact}
              sx={{ fontSize: '0.875rem' }}
            >
              Add Contact
            </Button>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Click on column headers to sort departments. Click in any field to edit contact information.
        </Typography>
        <Card>
          <CardContent>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('department')}
                    >
                      Department {sortConfig?.key === 'department' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('contactName')}
                    >
                      Contact Name {sortConfig?.key === 'contactName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('phone')}
                    >
                      Phone {sortConfig?.key === 'phone' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('email')}
                    >
                      Email {sortConfig?.key === 'email' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('notes')}
                    >
                      Notes {sortConfig?.key === 'notes' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    {isEditMode && (
                      <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 'bold', width: '80px' }}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {getSortedContacts().map((contact) => (
                    <tr
                      key={contact.id}
                      style={{ 
                        borderBottom: '1px solid #ddd',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <td style={{ padding: '12px', border: '1px solid #ddd', fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                        {isEditMode ? (
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Enter department name"
                            variant="outlined"
                            value={contact.department}
                            onChange={(e) => handleContactUpdate(contact.id, 'department', e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                          />
                        ) : (
                          contact.department
                        )}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Enter name"
                          variant="outlined"
                          value={contact.contactName}
                          onChange={(e) => handleContactUpdate(contact.id, 'contactName', e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Enter phone"
                          variant="outlined"
                          value={contact.phone}
                          onChange={(e) => handleContactUpdate(contact.id, 'phone', e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Enter email"
                          variant="outlined"
                          value={contact.email}
                          onChange={(e) => handleContactUpdate(contact.id, 'email', e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Add notes"
                          variant="outlined"
                          value={contact.notes}
                          onChange={(e) => handleContactUpdate(contact.id, 'notes', e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                        />
                      </td>
                      {isEditMode && (
                        <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteContact(contact)}
                            sx={{ p: 0.5 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Resources Section */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" color="primary">
            Resources & Tools
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddResourceDialog(true)}
            sx={{ fontSize: '0.875rem' }}
          >
            Add Resource
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Quick access to essential pediatric readiness resources and tools
        </Typography>
        
        {/* Search and Filter Controls */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  label="Category"
                >
                  {getCategories().map(category => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Tags</InputLabel>
                <Select
                  multiple
                  value={selectedTags}
                  onChange={(e) => setSelectedTags(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                  label="Tags"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {getTags().map(tag => (
                    <MenuItem key={tag} value={tag}>
                      <Checkbox checked={selectedTags.indexOf(tag) > -1} />
                      <ListItemText primary={tag} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('All');
                  setSelectedTags([]);
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Box>
        
        <Grid container spacing={isMobile ? 1 : 2}>
          {isLoadingResources ? (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Loading resources...
              </Typography>
            </Grid>
          ) : getFilteredResources().length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No resources found. Add your first resource to get started!
              </Typography>
            </Grid>
          ) : (
            getFilteredResources().map((resource) => (
            <Grid item xs={12} sm={6} md={4} key={resource.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Chip
                      icon={getResourceIcon(resource.type)}
                      label={resource.type.toUpperCase()}
                      color={getResourceColor(resource.type) as any}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    {resource.category && (
                      <Chip
                        label={resource.category}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1 }}
                      />
                    )}
                    <Box sx={{ ml: 'auto' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditResource(resource)}
                        sx={{ mr: 0.5 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteResource(resource.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="h6" gutterBottom sx={{ flexGrow: 1 }}>
                    {resource.title}
                  </Typography>
                  {resource.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                      {resource.description}
                    </Typography>
                  )}
                  
                  {/* Tags */}
                  {resource.tags && resource.tags.length > 0 && (
                    <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {resource.tags.map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  )}
                  
                  <Box sx={{ mt: 'auto' }}>
                    <Tooltip
                      title={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {resource.title}
                          </Typography>
                          {resource.description && (
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              {resource.description}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            Click to open {resource.type === 'link' ? 'webpage' : resource.type}
                          </Typography>
                        </Box>
                      }
                      arrow
                      placement="top"
                    >
                      <Box
                        onClick={() => handleResourceClick(resource.url)}
                        sx={{ 
                          display: 'inline-flex', 
                          alignItems: 'center',
                          cursor: 'pointer',
                          color: 'primary.main',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        <LinkIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
                        Access Resource
                      </Box>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            ))
          )}
        </Grid>
      </Box>

      {/* Add Resource Dialog */}
      <Dialog open={addResourceDialog} onClose={() => setAddResourceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Resource</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Resource Title"
            value={resourceForm.title}
            onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="URL or File"
            value={resourceForm.url}
            onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })}
            margin="normal"
            placeholder="https://example.com or upload a file"
          />
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            style={{ marginTop: '16px' }}
          />
          <TextField
            fullWidth
            label="Description (Optional)"
            value={resourceForm.description}
            onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          
          {/* Category and Tags */}
          <Box sx={{ mt: 2 }}>
            {/* Category Field with Dropdown */}
            <Box sx={{ position: 'relative', mb: 2 }} ref={categoryDropdownRef}>
              <TextField
                fullWidth
                label="Category"
                value={resourceForm.category}
                onChange={(e) => {
                  const value = e.target.value;
                  setResourceForm({ ...resourceForm, category: value });
                  const suggestions = getCategorySuggestions(value);
                  setCategorySuggestions(suggestions);
                  setShowCategoryDropdown(suggestions.length > 0 && value.trim() !== '');
                }}
                onFocus={() => {
                  if (resourceForm.category.trim()) {
                    const suggestions = getCategorySuggestions(resourceForm.category);
                    setCategorySuggestions(suggestions);
                    setShowCategoryDropdown(suggestions.length > 0);
                  }
                }}
                margin="normal"
                placeholder="e.g., Guidelines, Tools, Training"
              />
              {showCategoryDropdown && categorySuggestions.length > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    bgcolor: 'white',
                    border: 1,
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    boxShadow: 2,
                    maxHeight: 200,
                    overflow: 'auto'
                  }}
                >
                  {categorySuggestions.map((category) => (
                    <Box
                      key={category}
                      sx={{
                        p: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'grey.100' },
                        borderBottom: 1,
                        borderColor: 'grey.200'
                      }}
                      onClick={() => {
                        handleCategorySelect(category);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Typography variant="body2">{category}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
            
            {/* Tags Field with Dropdown */}
            <Box sx={{ position: 'relative', mb: 2 }} ref={tagDropdownRef}>
              <TextField
                fullWidth
                label="Tags"
                value={newTag}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewTag(value);
                  const suggestions = getTagSuggestions(value);
                  setTagSuggestions(suggestions);
                  setShowTagDropdown(suggestions.length > 0 && value.trim() !== '');
                }}
                onFocus={() => {
                  if (newTag.trim()) {
                    const suggestions = getTagSuggestions(newTag);
                    setTagSuggestions(suggestions);
                    setShowTagDropdown(suggestions.length > 0);
                  }
                }}
                margin="normal"
                placeholder="Type to add tags..."
                helperText="Type and select from suggestions or press Enter to add new tag"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    if (!resourceForm.tags.includes(newTag.trim())) {
                      setResourceForm({
                        ...resourceForm,
                        tags: [...resourceForm.tags, newTag.trim()]
                      });
                    }
                    setNewTag('');
                    setShowTagDropdown(false);
                  }
                }}
              />
              {showTagDropdown && tagSuggestions.length > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    bgcolor: 'white',
                    border: 1,
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    boxShadow: 2,
                    maxHeight: 200,
                    overflow: 'auto'
                  }}
                >
                  {tagSuggestions.map((tag) => (
                    <Box
                      key={tag}
                      sx={{
                        p: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'grey.100' },
                        borderBottom: 1,
                        borderColor: 'grey.200'
                      }}
                      onClick={() => {
                        handleTagSelect(tag);
                        setNewTag('');
                        setShowTagDropdown(false);
                      }}
                    >
                      <Typography variant="body2">{tag}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
            
            {/* Display Selected Tags */}
            {resourceForm.tags.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Selected Tags:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {resourceForm.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      onDelete={() => handleRemoveTag(tag)}
                      sx={{ fontSize: '0.8rem' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddResourceDialog(false)}>Cancel</Button>
          <Button onClick={handleAddResource} variant="contained">Add Resource</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Resource Dialog */}
      <Dialog open={editResourceDialog} onClose={() => setEditResourceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Resource</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Resource Title"
            value={resourceForm.title}
            onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="URL"
            value={resourceForm.url}
            onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description (Optional)"
            value={resourceForm.description}
            onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          
          {/* Category and Tags */}
          <Box sx={{ mt: 2 }}>
            {/* Category Field with Dropdown */}
            <Box sx={{ position: 'relative', mb: 2 }} ref={categoryDropdownRef}>
              <TextField
                fullWidth
                label="Category"
                value={resourceForm.category}
                onChange={(e) => {
                  const value = e.target.value;
                  setResourceForm({ ...resourceForm, category: value });
                  const suggestions = getCategorySuggestions(value);
                  setCategorySuggestions(suggestions);
                  setShowCategoryDropdown(suggestions.length > 0 && value.trim() !== '');
                }}
                onFocus={() => {
                  if (resourceForm.category.trim()) {
                    const suggestions = getCategorySuggestions(resourceForm.category);
                    setCategorySuggestions(suggestions);
                    setShowCategoryDropdown(suggestions.length > 0);
                  }
                }}
                margin="normal"
                placeholder="e.g., Guidelines, Tools, Training"
              />
              {showCategoryDropdown && categorySuggestions.length > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    bgcolor: 'white',
                    border: 1,
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    boxShadow: 2,
                    maxHeight: 200,
                    overflow: 'auto'
                  }}
                >
                  {categorySuggestions.map((category) => (
                    <Box
                      key={category}
                      sx={{
                        p: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'grey.100' },
                        borderBottom: 1,
                        borderColor: 'grey.200'
                      }}
                      onClick={() => {
                        handleCategorySelect(category);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Typography variant="body2">{category}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
            
            {/* Tags Field with Dropdown */}
            <Box sx={{ position: 'relative', mb: 2 }} ref={tagDropdownRef}>
              <TextField
                fullWidth
                label="Tags"
                value={newTag}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewTag(value);
                  const suggestions = getTagSuggestions(value);
                  setTagSuggestions(suggestions);
                  setShowTagDropdown(suggestions.length > 0 && value.trim() !== '');
                }}
                onFocus={() => {
                  if (newTag.trim()) {
                    const suggestions = getTagSuggestions(newTag);
                    setTagSuggestions(suggestions);
                    setShowTagDropdown(suggestions.length > 0);
                  }
                }}
                margin="normal"
                placeholder="Type to add tags..."
                helperText="Type and select from suggestions or press Enter to add new tag"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    if (!resourceForm.tags.includes(newTag.trim())) {
                      setResourceForm({
                        ...resourceForm,
                        tags: [...resourceForm.tags, newTag.trim()]
                      });
                    }
                    setNewTag('');
                    setShowTagDropdown(false);
                  }
                }}
              />
              {showTagDropdown && tagSuggestions.length > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    bgcolor: 'white',
                    border: 1,
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    boxShadow: 2,
                    maxHeight: 200,
                    overflow: 'auto'
                  }}
                >
                  {tagSuggestions.map((tag) => (
                    <Box
                      key={tag}
                      sx={{
                        p: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'grey.100' },
                        borderBottom: 1,
                        borderColor: 'grey.200'
                      }}
                      onClick={() => {
                        handleTagSelect(tag);
                        setNewTag('');
                        setShowTagDropdown(false);
                      }}
                    >
                      <Typography variant="body2">{tag}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
            
            {/* Display Selected Tags */}
            {resourceForm.tags.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Selected Tags:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {resourceForm.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      onDelete={() => handleRemoveTag(tag)}
                      sx={{ fontSize: '0.8rem' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditResourceDialog(false)}>Cancel</Button>
          <Button onClick={handleUpdateResource} variant="contained">Update Resource</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={cancelDeleteContact}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            Are you sure you want to delete the contact for {deleteConfirmDialog.contactName}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDeleteContact} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmDeleteContact} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Container>
  );
};

export default DashboardPage;
