import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Box,
  Spinner,
  Alert,
  AlertIcon,
  Heading,
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
  Button,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, AddIcon } from '@chakra-ui/icons';

const POLLING_INTERVAL = 15000;

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
      <Box w="8px" h="8px" borderRadius="full" bg={isEnabled ? onlineColor : offlineColor} mr={2} />
      <Text fontSize="sm" fontWeight="medium" lineHeight="1">
        {isEnabled ? 'Online' : 'Disabled'}
      </Text>
    </Flex>
  );
};

const HostStatusPage = () => {
  const { isTestMode } = useOutletContext();
  const navigate = useNavigate();
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hostToDelete, setHostToDelete] = useState(null);
  const toast = useToast();
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure();

  const cardBg = useColorModeValue('white', 'gray.800');
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
  
  const handleDeleteClick = (host) => {
    setHostToDelete(host);
    onDeleteModalOpen();
  };

  const confirmDelete = async () => {
    if (!hostToDelete) return;
    try {
      await axios.delete(`/api/hosts/${hostToDelete.id}`, { params: { test_mode: isTestMode }});
      toast({ title: "Host Deleted", description: `${hostToDelete.hostname} has been deleted.`, status: "success", duration: 3000, isClosable: true });
      fetchData(isTestMode);
    } catch (err) {
      toast({ title: "Error", description: `Failed to delete host. ${err.message}`, status: "error", duration: 5000, isClosable: true });
    } finally {
      onDeleteModalClose();
      setHostToDelete(null);
    }
  };

  if (loading) {
    return <Center h="80vh"><Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" /></Center>;
  }

  if (error) {
    return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
  }

  return (
    <VStack spacing={6} align="stretch">
      <Box p={5} borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={cardBg}>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="lg" fontWeight="normal">Host Status</Heading>
          <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={() => navigate('/status/add')}>
            Add Host
          </Button>
        </Flex>
        
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Hostname</Th>
              <Th>Status</Th>
              <Th>Last Run</Th>
              <Th>Enabled</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {status.length > 0 ? (
              status.map((fw) => (
                <Tr key={fw.id}>
                  <Td fontWeight="medium">{fw.hostname}</Td>
                  <Td><StatusBadge isEnabled={fw.is_enabled} /></Td>
                  <Td fontSize="sm" color="gray.500">
                    {fw.last_run !== 'Never' ? new Date(fw.last_run).toLocaleString() : 'Never'}
                  </Td>
                  <Td>
                    <Switch size="md" id={`switch-${fw.id}`} isChecked={fw.is_enabled} onChange={() => handleToggleStatus(fw.id)} colorScheme="blue" />
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <Tooltip label="Edit Host" placement="top" hasArrow bg="gray.600" color="white">
                        <IconButton size="sm" variant="ghost" icon={<EditIcon />} onClick={() => navigate(`/status/edit/${fw.id}`)} />
                      </Tooltip>
                      <Tooltip label="Delete Host" placement="top" hasArrow bg="gray.600" color="white">
                        <IconButton size="sm" variant="ghost" colorScheme="red" icon={<DeleteIcon />} onClick={() => handleDeleteClick(fw)} />
                      </Tooltip>
                    </HStack>
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr><Td colSpan={5} textAlign="center">No hosts configured.</Td></Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm Deletion</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Are you sure you want to delete the host{' '}
            <Text as="span" fontWeight="bold">{hostToDelete?.hostname}</Text>? This action cannot be undone.
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDeleteModalClose}>Cancel</Button>
            <Button colorScheme="red" onClick={confirmDelete}>Delete</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default HostStatusPage;