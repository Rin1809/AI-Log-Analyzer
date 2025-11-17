import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  SimpleGrid,
  Spinner,
  Alert,
  AlertIcon,
  Heading,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  VStack,
  HStack,
  Text,
  Switch,
  FormControl,
  FormLabel,
  Textarea,
  useColorModeValue,
  Badge,
  Flex
} from '@chakra-ui/react';

const POLLING_INTERVAL = 15000; // 15 seconds

const FirewallStatusPage = () => {
  const [status, setStatus] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState({ id: null, content: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  const toast = useToast();
  const { isOpen: isConfigModalOpen, onOpen: onConfigModalOpen, onClose: onConfigModalClose } = useDisclosure();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const fetchData = useCallback(async (testMode) => {
    if (loading) setError('');
    
    try {
      const apiParams = { params: { test_mode: testMode } };
      const statusRes = await axios.get('/api/status', apiParams);
      setStatus(statusRes.data);
    } catch (err) {
      console.error(err);
      setError(`Failed to connect to backend. Make sure the API server is running. Details: ${err.message}`);
    } finally {
      if (loading) setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchData(isTestMode);
    const intervalId = setInterval(() => fetchData(isTestMode), POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchData, isTestMode]);

  const handleTestModeToggle = (e) => {
    const newTestMode = e.target.checked;
    setIsTestMode(newTestMode);
    setLoading(true);
    fetchData(newTestMode);
  };

  const handleToggleStatus = async (firewallId) => {
    try {
      await axios.post(`/api/status/${firewallId}/toggle`, {}, { params: { test_mode: isTestMode } });
      toast({ title: "Success", description: `Status for ${firewallId} toggled.`, status: "success", duration: 3000, isClosable: true });
      fetchData(isTestMode); // fetch immediately after toggle
    } catch (err) {
      toast({ title: "Error", description: `Failed to toggle status. ${err.message}`, status: "error", duration: 5000, isClosable: true });
    }
  };

  const handleEditConfig = async (firewallId) => {
    try {
      const res = await axios.get(`/api/config/${firewallId}`, { params: { test_mode: isTestMode } });
      setSelectedConfig({ id: firewallId, content: res.data.content });
      onConfigModalOpen();
    } catch(err) {
       toast({ title: "Error", description: `Failed to load config. ${err.message}`, status: "error", duration: 5000, isClosable: true });
    }
  }

  const handleSaveConfig = async () => {
    if (!selectedConfig.id) return;
    try {
        await axios.post(`/api/config/${selectedConfig.id}`, 
          { content: selectedConfig.content }, 
          { params: { test_mode: isTestMode } }
        );
        toast({ title: "Success", description: `Config for ${selectedConfig.id} saved.`, status: "success", duration: 3000, isClosable: true });
        onConfigModalClose();
    } catch (err) {
        toast({ title: "Error", description: `Failed to save config. ${err.message}`, status: "error", duration: 5000, isClosable: true });
    }
  }

  if (loading) {
    return <Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" />;
  }

  if (error) {
    return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
  }

  return (
    <VStack spacing={8} align="stretch">
       <Flex justify="space-between" align="center" p={4} bg={cardBg} borderRadius="md" shadow="sm" borderWidth="1px" borderColor={borderColor}>
        <Heading size="md">Firewall Status</Heading>
        <FormControl display="flex" alignItems="center" w="auto">
          <FormLabel htmlFor="test-mode-switch" mb="0" mr={3}>Test Mode</FormLabel>
          <Switch colorScheme="blue" id="test-mode-switch" isChecked={isTestMode} onChange={handleTestModeToggle} />
        </FormControl>
      </Flex>
      
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        {status.map((fw) => (
          <Box key={fw.id} p={5} shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={cardBg}>
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between">
                 <Heading size="md" isTruncated title={fw.hostname}>{fw.hostname}</Heading>
                 <Badge colorScheme={fw.is_enabled ? 'green' : 'red'}>{fw.status}</Badge>
              </HStack>
              <Text fontSize="sm" color="gray.500">
                Last run: {fw.last_run !== 'Never' ? new Date(fw.last_run).toLocaleString() : 'Never'}
              </Text>
              <HStack justify="space-between">
                  <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor={`switch-${fw.id}`} mb="0" fontSize="sm">Enabled</FormLabel>
                      <Switch size="sm" id={`switch-${fw.id}`} isChecked={fw.is_enabled} onChange={() => handleToggleStatus(fw.id)} />
                  </FormControl>
                  <Button size="sm" onClick={() => handleEditConfig(fw.id)}>Edit Config</Button>
              </HStack>
            </VStack>
          </Box>
        ))}
      </SimpleGrid>

      <Modal isOpen={isConfigModalOpen} onClose={onConfigModalClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent bg={cardBg}>
          <ModalHeader>Edit Config: {selectedConfig.id}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Textarea 
                value={selectedConfig.content}
                onChange={(e) => setSelectedConfig({...selectedConfig, content: e.target.value})}
                fontFamily="monospace"
                height="60vh"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onConfigModalClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSaveConfig}>Save Changes</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </VStack>
  );
};

export default FirewallStatusPage;