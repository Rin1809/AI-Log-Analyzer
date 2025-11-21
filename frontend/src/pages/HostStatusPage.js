import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  InputGroup,
  InputLeftElement,
  Input,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Center
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, AddIcon, SearchIcon } from '@chakra-ui/icons';
import { useLanguage } from '../context/LanguageContext';

const POLLING_INTERVAL = 15000;

const ThreeDotsIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
);

const StatusBadge = ({ isEnabled }) => {
  const onlineColor = useColorModeValue('green.500', 'green.400');
  const offlineColor = useColorModeValue('red.500', 'red.400');
  const onlineBg = useColorModeValue('green.100', 'green.800');
  const offlineBg = useColorModeValue('red.100', 'red.800');
  const { t } = useLanguage();

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
        {isEnabled ? t('online') : t('disabled')}
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
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure();
  const { t } = useLanguage();

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
      setError(`${t('error')}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [status.length, t]);

  useEffect(() => {
    fetchData(isTestMode);
    const intervalId = setInterval(() => fetchData(isTestMode), POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchData, isTestMode]);

  const handleToggleStatus = async (hostId) => {
    try {
      await axios.post(`/api/status/${hostId}/toggle`, {}, { params: { test_mode: isTestMode } });
      toast({ title: t('success'), status: "success", duration: 3000, isClosable: true });
      fetchData(isTestMode);
    } catch (err) {
      toast({ title: t('error'), description: err.message, status: "error", duration: 5000, isClosable: true });
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
      toast({ title: t('success'), status: "success", duration: 3000, isClosable: true });
      fetchData(isTestMode);
    } catch (err) {
      toast({ title: t('error'), description: err.message, status: "error", duration: 5000, isClosable: true });
    } finally {
      onDeleteModalClose();
      setHostToDelete(null);
    }
  };

  const filteredStatus = useMemo(() => {
      return status.filter(host => 
          host.hostname.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [status, searchTerm]);

  if (loading) {
    return <Center h="80vh"><Spinner size="xl" /></Center>;
  }

  if (error) {
    return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
  }

  return (
    <VStack spacing={6} align="stretch">
      <Box p={5} borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={cardBg}>
        <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4}>
          <Heading size="lg" fontWeight="normal">{t('hostStatusTitle')}</Heading>
          
          <HStack spacing={3} w={{ base: '100%', md: 'auto' }}>
             <InputGroup maxW="300px">
                <InputLeftElement pointerEvents="none">
                    <SearchIcon color="gray.300" />
                </InputLeftElement>
                <Input 
                    placeholder={t('search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </InputGroup>
             <Tooltip label={t('add')} placement="top" hasArrow bg="gray.600" color="white">
                <IconButton 
                    icon={<AddIcon />} 
                    colorScheme="blue" 
                    variant="outline" 
                    aria-label="Add Host"
                    onClick={() => navigate('/status/add')}
                    size="md"
                    isRound
                />
             </Tooltip>
          </HStack>
        </Flex>
        
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>{t('hostname')}</Th>
              <Th>{t('status')}</Th>
              <Th>{t('lastRun')}</Th>
              <Th>{t('isEnabled')}</Th>
              <Th>{t('actions')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredStatus.length > 0 ? (
              filteredStatus.map((host) => (
                <Tr key={host.id}>
                  <Td fontWeight="medium">{host.hostname}</Td>
                  <Td><StatusBadge isEnabled={host.is_enabled} /></Td>
                  <Td fontSize="sm" color="gray.500">
                    {host.last_run !== 'Never' ? new Date(host.last_run).toLocaleString() : t('never')}
                  </Td>
                  <Td>
                    <Switch size="md" id={`switch-${host.id}`} isChecked={host.is_enabled} onChange={() => handleToggleStatus(host.id)} colorScheme="blue" />
                  </Td>
                  <Td>
                    <Menu>
                        <MenuButton 
                            as={IconButton} 
                            icon={<ThreeDotsIcon style={{ width: '20px', height: '20px' }} />} 
                            variant="ghost" 
                            size="sm"
                            aria-label="Options"
                        />
                        <MenuList>
                            <MenuItem icon={<EditIcon />} onClick={() => navigate(`/status/edit/${host.id}`)}>
                                {t('editConfig')}
                            </MenuItem>
                            <MenuItem icon={<DeleteIcon />} color="red.500" onClick={() => handleDeleteClick(host)}>
                                {t('deleteHost')}
                            </MenuItem>
                        </MenuList>
                    </Menu>
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr><Td colSpan={5} textAlign="center" py={4} color="gray.500">{t('noHosts')}</Td></Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t('confirmDeletion')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {t('confirmDeleteHost')} <Text as="span" fontWeight="bold">{hostToDelete?.hostname}</Text>? {t('cannotUndo')}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDeleteModalClose}>{t('cancel')}</Button>
            <Button colorScheme="red" onClick={confirmDelete}>{t('delete')}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default HostStatusPage;