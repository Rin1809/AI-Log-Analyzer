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
} from '@chakra-ui/react';
import { SettingsIcon, AttachmentIcon } from '@chakra-ui/icons';

const SettingsCard = ({ title, children }) => {
  const cardBg = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  return (
    <Box
      p={6}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      bg={cardBg}
    >
      <Heading size="md" fontWeight="normal" mb={5}>{title}</Heading>
      <VStack spacing={4} align="stretch">
        {children}
      </VStack>
    </Box>
  );
};

const SettingsPage = () => {
  const { isTestMode, setIsTestMode } = useOutletContext();
  const [settings, setSettings] = useState({
    ReportDirectory: '',
    PromptDirectory: '',
    ContextDirectory: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async (testMode) => {
    setLoading(true);
    setError('');
    try {
      // // fix: them param test_mode vao API call
      const response = await axios.get('/api/system-settings', { params: { test_mode: testMode } });
      setSettings(prev => ({ ...prev, ...response.data }));
    } catch (err) {
      console.error(err);
      setError(`Failed to load system settings. Details: ${err.message}`);
      toast({
        title: "Error Loading Settings",
        description: err.message,
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // // effect nay se chay khi component mount va khi isTestMode thay doi
  useEffect(() => {
    fetchData(isTestMode);
  }, [fetchData, isTestMode]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // // fix: them param test_mode khi luu
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
      toast({
        title: "Save Failed",
        description: `Could not save settings. ${err.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <Center h="80vh"><Spinner size="xl" /></Center>;
  }

  return (
    <VStack spacing={6} align="stretch">
      <Heading size="lg">System Settings</Heading>
      
      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      )}

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
        <GridItem>
          <SettingsCard title="Default Paths">
            <FormControl>
              <FormLabel fontSize="sm">Report Directory</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <Icon as={AttachmentIcon} color="gray.500" />
                </InputLeftElement>
                <Input
                  name="ReportDirectory"
                  value={settings.ReportDirectory || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., C:/analyzer/reports"
                  isDisabled={loading || !!error}
                />
              </InputGroup>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Prompt Directory</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <Icon as={AttachmentIcon} color="gray.500" />
                </InputLeftElement>
                <Input
                  name="PromptDirectory"
                  value={settings.PromptDirectory || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., backend/prompts"
                  isDisabled={loading || !!error}
                />
              </InputGroup>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Bonus Context Directory</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <Icon as={AttachmentIcon} color="gray.500" />
                </InputLeftElement>
                <Input
                  name="ContextDirectory"
                  value={settings.ContextDirectory || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., backend/Bonus_context"
                  isDisabled={loading || !!error}
                />
              </InputGroup>
            </FormControl>
          </SettingsCard>
        </GridItem>
        <GridItem>
          <SettingsCard title="General">
            <FormControl display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <FormLabel htmlFor="test-mode-switch" mb="0">
                  Test Mode
                </FormLabel>
                <Text fontSize="xs" color="gray.500">Use test configuration and assets.</Text>
              </Box>
              <Switch
                id="test-mode-switch"
                colorScheme="blue"
                isChecked={isTestMode}
                onChange={(e) => setIsTestMode(e.target.checked)}
                isDisabled={loading || !!error}
              />
            </FormControl>
          </SettingsCard>
        </GridItem>
      </Grid>
      
      <Box pt={4}>
        <Button
          colorScheme="blue"
          onClick={handleSave}
          isLoading={isSaving}
          isDisabled={loading || !!error}
          leftIcon={<SettingsIcon />}
        >
          Save Settings
        </Button>
      </Box>
    </VStack>
  );
};

export default SettingsPage;