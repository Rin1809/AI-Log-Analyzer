import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Heading,
  VStack,
  Spinner,
  Alert,
  AlertIcon,
  useToast,
  useColorModeValue,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  Grid,
  GridItem,
  Text,
  InputGroup,
  InputLeftElement,
  Icon,
  Center,
  Flex,
  Select,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  HStack,
  useDisclosure,
  Tag,
  TagLabel,
  TagRightIcon,
  Wrap,
  WrapItem
} from '@chakra-ui/react';
import { SettingsIcon, AttachmentIcon, AddIcon, DeleteIcon, StarIcon} from '@chakra-ui/icons';
import SmtpProfileModal from '../components/settings/SmtpProfileModal';
import ApiKeyManagerModal from '../components/hosts/ApiKeyManagerModal'; // Reused here

const SettingsCard = ({ title, children, actions }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  return (
    <Box p={6} borderWidth="1px" borderColor={borderColor} borderRadius="lg" bg={cardBg} h="100%">
      <Flex justify="space-between" align="center" mb={5}>
        <Heading size="md" fontWeight="normal">{title}</Heading>
        {actions && <Box>{actions}</Box>}
      </Flex>
      <VStack spacing={4} align="stretch">
        {children}
      </VStack>
    </Box>
  );
};

const SettingsPage = () => {
  const { isTestMode, setIsTestMode } = useOutletContext();
  const [settings, setSettings] = useState({
    report_directory: '',
    prompt_directory: '',
    context_directory: '',
    smtp_profiles: {},
    active_smtp_profile: '',
    attach_context_files: false,
    scheduler_check_interval_seconds: 60,
    gemini_profiles: {}
  });
  
  const [schedulerType, setSchedulerType] = useState('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  
  // Key Modal State
  const { isOpen: isKeyModalOpen, onOpen: onKeyModalOpen, onClose: onKeyModalClose } = useDisclosure();

  const toast = useToast();
  const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  
  const saveButtonBg = useColorModeValue('gray.800', 'white');
  const saveButtonColor = useColorModeValue('white', 'gray.800');
  const saveButtonHoverBg = useColorModeValue('black', 'gray.200');

  const fetchData = useCallback(async (testMode) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/system-settings', { params: { test_mode: testMode } });
      const data = response.data || {};
      setSettings({
        report_directory: data.report_directory || '',
        prompt_directory: data.prompt_directory || '',
        context_directory: data.context_directory || '',
        smtp_profiles: data.smtp_profiles || {},
        active_smtp_profile: data.active_smtp_profile || '',
        attach_context_files: data.attach_context_files || false,
        scheduler_check_interval_seconds: data.scheduler_check_interval_seconds || 60,
        gemini_profiles: data.gemini_profiles || {}
      });
      setSchedulerType(data.scheduler_check_interval_seconds === 60 ? 'default' : 'custom');
    } catch (err) {
      console.error(err);
      setError(`Failed to load system settings. Details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(isTestMode);
  }, [fetchData, isTestMode]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setSettings(prev => ({ ...prev, [name]: val }));
  };
  
  const handleSchedulerIntervalChange = (val) => {
    setSchedulerType(val);
    if (val === 'default') {
      setSettings(prev => ({ ...prev, scheduler_check_interval_seconds: 60 }));
    }
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.post('/api/system-settings', settings, { params: { test_mode: isTestMode } });
      toast({
        title: "Settings Saved",
        description: "Your changes have been saved successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Save Failed", description: `Could not save settings. ${err.message}`, status: "error", duration: 5000, isClosable: true });
    } finally {
      setIsSaving(false);
    }
  };

  // --- SMTP Profile Logic ---
  const handleAddProfile = () => {
    setCurrentProfile(null);
    onModalOpen();
  };
  const handleDeleteProfile = () => {
    if (!settings.active_smtp_profile) return;
    const newProfiles = { ...settings.smtp_profiles };
    delete newProfiles[settings.active_smtp_profile];
    setSettings(prev => ({
        ...prev,
        smtp_profiles: newProfiles,
        active_smtp_profile: Object.keys(newProfiles)[0] || ''
    }));
  };
  const handleSaveProfile = (profile) => {
    setSettings(prev => ({
      ...prev,
      smtp_profiles: { ...prev.smtp_profiles, [profile.profile_name]: profile },
      active_smtp_profile: prev.active_smtp_profile || profile.profile_name, 
    }));
  };

  // --- Key Manager Callbacks ---
  const handleKeysChanged = (newProfiles) => {
      setSettings(prev => ({ ...prev, gemini_profiles: newProfiles }));
  }

  if (loading) {
    return <Center h="80vh"><Spinner size="xl" /></Center>;
  }

  return (
    <VStack spacing={6} align="stretch">
      <Heading size="lg" fontWeight="normal">System Settings</Heading>
      
      {error && <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>}

      {/* Change layout to equal columns (1fr 1fr) */}
      <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6}>
        <GridItem>
          <SettingsCard title="Default Paths">
            {['report_directory', 'prompt_directory', 'context_directory'].map(key => (
              <FormControl key={key}>
                <FormLabel fontSize="sm" textTransform="capitalize">{key.replace('_', ' ')}</FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none"><Icon as={AttachmentIcon} color="gray.500" /></InputLeftElement>
                  <Input name={key} value={settings[key] || ''} onChange={handleInputChange} isDisabled={loading || !!error || isSaving} />
                </InputGroup>
              </FormControl>
            ))}
          </SettingsCard>
        </GridItem>

        <GridItem>
          <SettingsCard title="Email Server (SMTP)">
              <FormControl>
                <FormLabel fontSize="sm">Active SMTP Profile</FormLabel>
                <HStack>
                    <Select
                        name="active_smtp_profile"
                        value={settings.active_smtp_profile}
                        onChange={handleInputChange}
                        placeholder="None"
                    >
                        {Object.keys(settings.smtp_profiles).map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </Select>
                    <IconButton icon={<AddIcon />} aria-label="Add Profile" onClick={handleAddProfile} />
                    <IconButton icon={<DeleteIcon />} aria-label="Delete Selected Profile" onClick={handleDeleteProfile} isDisabled={!settings.active_smtp_profile} />
                </HStack>
              </FormControl>
              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <FormLabel htmlFor="attach-files-switch" mb="0" fontSize="sm">Attach Context Files</FormLabel>
                  <Text fontSize="xs" color="gray.500">Attach context files to periodic emails.</Text>
                </Box>
                <Switch id="attach-files-switch" colorScheme="blue" name="attach_context_files" isChecked={settings.attach_context_files} onChange={handleInputChange} />
              </FormControl>
          </SettingsCard>
        </GridItem>

        <GridItem>
            <SettingsCard 
                title="Gemini API Key Profiles" 
                actions={<Button size="xs" fontWeight="normal" leftIcon={<SettingsIcon />} onClick={onKeyModalOpen}>Manage Keys</Button>}
            >
                <Wrap spacing={3}>
                    {Object.keys(settings.gemini_profiles).length === 0 ? (
                        <Text fontSize="sm" color="gray.500" fontStyle="italic">No profiles configured.</Text>
                    ) : (
                        Object.keys(settings.gemini_profiles).map(name => (
                            <WrapItem key={name}>
                                <Tag size="md" borderRadius="full" variant="subtle" colorScheme="blue">
                                    <TagLabel>{name}</TagLabel>
                                    <TagRightIcon as={StarIcon} />
                                </Tag>
                            </WrapItem>
                        ))
                    )}
                </Wrap>
                <Text fontSize="xs" color="gray.400" mt={2}>
                    Manage API keys centrally. Select a profile when configuring a host.
                </Text>
            </SettingsCard>
        </GridItem>

        <GridItem>
            <SettingsCard title="General">
                 <VStack spacing={6} align="stretch">
                    <FormControl>
                        <FormLabel fontSize="sm">Scheduler Interval</FormLabel>
                        <RadioGroup onChange={handleSchedulerIntervalChange} value={schedulerType}>
                            <Stack direction="row" spacing={5}>
                                <Radio value="default">Default (60s)</Radio>
                                <Radio value="custom">Custom</Radio>
                            </Stack>
                        </RadioGroup>
                        {schedulerType === 'custom' && (
                            <Input
                                mt={2}
                                type="number"
                                name="scheduler_check_interval_seconds"
                                value={settings.scheduler_check_interval_seconds}
                                onChange={handleInputChange}
                                width="120px"
                                size="sm"
                            />
                        )}
                    </FormControl>
                    <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                            <FormLabel htmlFor="test-mode-switch" mb="0">Test Mode</FormLabel>
                            <Text fontSize="xs" color="gray.500">Use test configuration and assets.</Text>
                        </Box>
                        <Switch id="test-mode-switch" colorScheme="blue" isChecked={isTestMode} onChange={(e) => setIsTestMode(e.target.checked)} />
                    </FormControl>
                 </VStack>
            </SettingsCard>
        </GridItem>
      </Grid>
      
      <Box pt={4}>
        <Button fontWeight="normal" onClick={handleSave} isLoading={isSaving} isDisabled={loading || !!error} leftIcon={<SettingsIcon />} bg={saveButtonBg} color={saveButtonColor} _hover={{ bg: saveButtonHoverBg }}>
          Save
        </Button>
      </Box>

      <SmtpProfileModal isOpen={isModalOpen} onClose={onModalClose} onSave={handleSaveProfile} profileData={currentProfile} />
      
      <ApiKeyManagerModal 
          isOpen={isKeyModalOpen} 
          onClose={onKeyModalClose} 
          isTestMode={isTestMode}
          onProfilesChange={handleKeysChanged}
      />

    </VStack>
  );
};

export default SettingsPage;