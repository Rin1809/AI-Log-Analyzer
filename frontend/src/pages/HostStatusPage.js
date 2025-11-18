import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  SimpleGrid,
  Spinner,
  Alert,
  AlertIcon,
  Heading,
  useDisclosure,
  useToast,
  VStack,
  useColorModeValue,
  Center
} from '@chakra-ui/react';
import HostCard from '../components/hosts/HostCard';
import ConfigEditorModal from '../components/hosts/ConfigEditorModal';

const POLLING_INTERVAL = 15000;

const HostStatusPage = () => {
  const { isTestMode } = useOutletContext();
  const [status, setStatus] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState({ id: null, content: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  const { isOpen: isConfigModalOpen, onOpen: onConfigModalOpen, onClose: onConfigModalClose } = useDisclosure();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const fetchData = useCallback(async (testMode) => {
    // // logic nay de khong show spinner khi polling
    if (status.length === 0) setLoading(true); 
    setError('');

    try {
      const apiParams = { params: { test_mode: testMode } };
      const statusRes = await axios.get('/api/status', apiParams);
      setStatus(statusRes.data);
    } catch (err) {
      console.error(err);
      setError(`Failed to connect to backend. Details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [status.length]);

  useEffect(() => {
    fetchData(isTestMode);
    const intervalId = setInterval(() => fetchData(isTestMode), POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchData, isTestMode]);

  const handleToggleStatus = async (firewallId) => {
    try {
      await axios.post(`/api/status/${firewallId}/toggle`, {}, { params: { test_mode: isTestMode } });
      toast({ title: "Success", description: `Status for ${firewallId} toggled.`, status: "success", duration: 3000, isClosable: true });
      fetchData(isTestMode);
    } catch (err) {
      toast({ title: "Error", description: `Failed to toggle status. ${err.message}`, status: "error", duration: 5000, isClosable: true });
    }
  };

  const handleEditConfig = async (firewallId) => {
    try {
      const res = await axios.get(`/api/config/${firewallId}`, { params: { test_mode: isTestMode } });
      setSelectedConfig({ id: firewallId, content: res.data.content });
      onConfigModalOpen();
    } catch (err) {
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
    return <Center h="80vh"><Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" /></Center>;
  }

  if (error) {
    return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
  }

  return (
    <VStack spacing={8} align="stretch">
      <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" borderWidth="1px" borderColor={borderColor}>
        <Heading size="md">Host Status</Heading>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        {status.map((fw) => (
          <HostCard
            key={fw.id}
            fw={fw}
            onToggleStatus={handleToggleStatus}
            onEditConfig={handleEditConfig}
          />
        ))}
      </SimpleGrid>

      <ConfigEditorModal
        isOpen={isConfigModalOpen}
        onClose={onConfigModalClose}
        selectedConfig={selectedConfig}
        setSelectedConfig={setSelectedConfig}
        onSave={handleSaveConfig}
      />
    </VStack>
  );
};

export default HostStatusPage;