import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Spinner,
  Alert,
  AlertIcon,
  Heading,
  useDisclosure,
  useToast,
  VStack,
  Center,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Switch,
  IconButton,
  Tooltip,
  useColorModeValue,
  HStack,
  Flex,
  Text,
} from '@chakra-ui/react';
import { EditIcon } from '@chakra-ui/icons';
import ConfigEditorModal from '../components/hosts/ConfigEditorModal';

const POLLING_INTERVAL = 15000;

// // component con de render status badge cho gon
const StatusBadge = ({ isEnabled }) => {
  const onlineColor = useColorModeValue('green.500', 'green.400');
  const offlineColor = useColorModeValue('red.500', 'red.400');
  const onlineBg = useColorModeValue('green.100', 'green.800');
  const offlineBg = useColorModeValue('red.100', 'red.800');

  return (
    <Flex
      alignItems="center"
      bg={isEnabled ? onlineBg : offlineBg}
      color={isEnabled ? onlineColor : offlineColor}
      borderRadius="full"
      px={3}
      py={1}
      w="fit-content"
    >
      <Box
        w="8px"
        h="8px"
        borderRadius="full"
        bg={isEnabled ? onlineColor : offlineColor}
        mr={2}
      />
      <Text fontSize="sm" fontWeight="medium" lineHeight="1">
        {isEnabled ? 'Online' : 'Disabled'}
      </Text>
    </Flex>
  );
};

const HostStatusPage = () => {
  const { isTestMode } = useOutletContext();
  const [status, setStatus] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState({ id: null, content: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  const { isOpen: isConfigModalOpen, onOpen: onConfigModalOpen, onClose: onConfigModalClose } = useDisclosure();

  const cardBg = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const fetchData = useCallback(async (testMode) => {
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
    <VStack spacing={6} align="stretch">
      <Box p={5} borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={cardBg}>
        <Heading size="lg" fontWeight="normal" mb={4}>Host Status</Heading>
        
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Hostname</Th>
              <Th>Status</Th>
              <Th>Last Run</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {status.length > 0 ? (
              status.map((fw) => (
                <Tr key={fw.id}>
                  <Td fontWeight="medium">{fw.hostname}</Td>
                  <Td>
                    <StatusBadge isEnabled={fw.is_enabled} />
                  </Td>
                  <Td fontSize="sm" color="gray.500">
                    {fw.last_run !== 'Never' ? new Date(fw.last_run).toLocaleString() : 'Never'}
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <Switch 
                        size="md" 
                        id={`switch-${fw.id}`} 
                        isChecked={fw.is_enabled} 
                        onChange={() => handleToggleStatus(fw.id)} 
                        colorScheme="blue" 
                      />
                      {/* // fix: them bg va color de tooltip luon doc duoc */}
                      <Tooltip 
                        label="Edit Config" 
                        placement="top"
                        hasArrow
                        bg="gray.600"
                        color="white"
                      >
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={<EditIcon />}
                          onClick={() => handleEditConfig(fw.id)}
                          aria-label="Edit configuration"
                        />
                      </Tooltip>
                    </HStack>
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={4} textAlign="center">
                  No hosts configured.
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

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