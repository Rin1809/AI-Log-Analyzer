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
    report_directory: '',
    prompt_directory: '',
    context_directory: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const saveButtonBg = useColorModeValue('gray.800', 'white');
  const saveButtonColor = useColorModeValue('white', 'gray.800');
  const saveButtonHoverBg = useColorModeValue('black', 'gray.200');


  const fetchData = useCallback(async (testMode) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/system-settings', { params: { test_mode: testMode } });
      setSettings(response.data || { report_directory: '', prompt_directory: '', context_directory: '' }); 
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
                  name="report_directory"
                  value={settings.report_directory || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., C:/analyzer/reports"
                  isDisabled={loading || !!error || isSaving}
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
                  name="prompt_directory"
                  value={settings.prompt_directory || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., backend/prompts"
                  isDisabled={loading || !!error || isSaving}
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
                  name="context_directory"
                  value={settings.context_directory || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., backend/Bonus_context"
                  isDisabled={loading || !!error || isSaving}
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
                isDisabled={loading || !!error || isSaving}
              />
            </FormControl>
          </SettingsCard>
        </GridItem>
      </Grid>
      
      <Box pt={4}>
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          isDisabled={loading || !!error}
          leftIcon={<SettingsIcon />}
          bg={saveButtonBg}
          color={saveButtonColor}
          _hover={{ bg: saveButtonHoverBg }}
        >
          Save Settings
        </Button>
      </Box>
    </VStack>
  );
};

export default SettingsPage;