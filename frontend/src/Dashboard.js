import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  SimpleGrid,
  Spinner,
  Alert,
  AlertIcon,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Button,
  Tag,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Code,
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
  Flex,
} from '@chakra-ui/react';

// // Polling interval
const POLLING_INTERVAL = 10000; // 10 seconds

const Dashboard = () => {
  const [status, setStatus] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState({ id: null, content: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTestMode, setIsTestMode] = useState(false); // State for test mode

  const toast = useToast();
  const { isOpen: isReportModalOpen, onOpen: onReportModalOpen, onClose: onReportModalClose } = useDisclosure();
  const { isOpen: isConfigModalOpen, onOpen: onConfigModalOpen, onClose: onConfigModalClose } = useDisclosure();

  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // fetch data tu backend
  const fetchData = useCallback(async (testMode) => {
    // // tranh nhay spinner khi polling
    if (loading) setError('');
    
    try {
      const apiParams = { params: { test_mode: testMode } };
      
      const [statusRes, reportsRes] = await Promise.all([
        axios.get('/api/status', apiParams),
        axios.get('/api/reports', apiParams)
      ]);

      setStatus(statusRes.data);
      setReports(reportsRes.data);
    } catch (err) {
      console.error(err);
      setError(`Failed to connect to backend. Make sure the API server is running. Details: ${err.message}`);
    } finally {
      if (loading) setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchData(isTestMode); // fetch lan dau
    const intervalId = setInterval(() => fetchData(isTestMode), POLLING_INTERVAL); // bat dau polling
    // // quick and dirty polling, dung quen clear
    return () => clearInterval(intervalId);
  }, [fetchData, isTestMode]);

  const handleTestModeToggle = (e) => {
    const newTestMode = e.target.checked;
    setIsTestMode(newTestMode);
    setLoading(true); // show spinner while reloading data for new mode
    fetchData(newTestMode);
  };

  const handleViewReport = async (reportPath) => {
    try {
      const res = await axios.get(`/api/report-content?path=${encodeURIComponent(reportPath)}`, { params: { test_mode: isTestMode } });
      setSelectedReport({
        name: reportPath.split(/\/|\\/).pop(), // works on both windows/linux
        content: JSON.stringify(res.data, null, 2)
      });
      onReportModalOpen();
    } catch (err) {
      toast({ title: "Error", description: `Could not load report content. ${err.message}`, status: "error", duration: 5000, isClosable: true });
    }
  };

  const handleToggleStatus = async (firewallId) => {
    try {
      await axios.post(`/api/status/${firewallId}/toggle`, {}, { params: { test_mode: isTestMode } });
      toast({ title: "Success", description: `Status for ${firewallId} toggled.`, status: "success", duration: 3000, isClosable: true });
      fetchData(isTestMode); // fetch lai data ngay lap tuc
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

  const getTagColor = (type) => {
    switch (type) {
      case 'final': return 'red';
      case 'summary': return 'orange';
      case 'periodic': return 'blue';
      default: return 'gray';
    }
  };

  if (loading) {
    return <Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" />;
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  return (
    <VStack spacing={8} align="stretch">
       <Flex justify="space-between" align="center" p={4} bg={cardBg} borderRadius="md" shadow="sm" borderWidth="1px" borderColor={borderColor}>
        <Heading size="lg">Firewall Status</Heading>
        <FormControl display="flex" alignItems="center" w="auto">
          <FormLabel htmlFor="test-mode-switch" mb="0" mr={3}>
            Test Mode
          </FormLabel>
          <Switch id="test-mode-switch" isChecked={isTestMode} onChange={handleTestModeToggle} />
        </FormControl>
      </Flex>
      
      <Box>
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
                        <FormLabel htmlFor={`switch-${fw.id}`} mb="0">
                            Enabled
                        </FormLabel>
                        <Switch id={`switch-${fw.id}`} isChecked={fw.is_enabled} onChange={() => handleToggleStatus(fw.id)} />
                    </FormControl>
                    <Button size="sm" onClick={() => handleEditConfig(fw.id)}>Edit Config</Button>
                </HStack>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Box>
        <Heading size="lg" mb={4}>Generated Reports</Heading>
        <TableContainer bg={cardBg} borderRadius="md" shadow="md" borderWidth="1px" borderColor={borderColor}>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Hostname</Th>
                <Th>Filename</Th>
                <Th>Type</Th>
                <Th>Generated Time</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {reports.length > 0 ? (
                reports.map((report) => (
                  <Tr key={report.path}>
                    <Td>{report.hostname}</Td>
                    <Td>{report.filename}</Td>
                    <Td>
                      <Tag size="sm" colorScheme={getTagColor(report.type)}>{report.type.toUpperCase()}</Tag>
                    </Td>
                    <Td>{report.generated_time}</Td>
                    <Td>
                      <Button colorScheme="teal" variant="outline" size="xs" onClick={() => handleViewReport(report.path)}>
                        View
                      </Button>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={5} textAlign="center">No reports found.</Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>

      {/* // Modal de xem content report */}
      <Modal isOpen={isReportModalOpen} onClose={onReportModalClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent bg={cardBg}>
          <ModalHeader>{selectedReport?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Code display="block" whiteSpace="pre" p={4} borderRadius="md" w="100%">
                {selectedReport?.content}
            </Code>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onReportModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* // Modal de sua config */}
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

export default Dashboard;
