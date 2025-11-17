import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Input,
  Select,
  IconButton, // // fix: them iconbutton vao import
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';

// // Polling interval
const POLLING_INTERVAL = 15000; // 15 seconds
const REPORTS_PER_PAGE = 10;

const Dashboard = () => {
  const [status, setStatus] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState({ id: null, content: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  
  // // state cho phan trang va filter
  const [filters, setFilters] = useState({ hostname: '', type: '' });
  const [currentPage, setCurrentPage] = useState(1);

  const toast = useToast();
  const { isOpen: isReportModalOpen, onOpen: onReportModalOpen, onClose: onReportModalClose } = useDisclosure();
  const { isOpen: isConfigModalOpen, onOpen: onConfigModalOpen, onClose: onConfigModalClose } = useDisclosure();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const inputBg = useColorModeValue('gray.50', 'gray.700');

  // fetch data tu backend
  const fetchData = useCallback(async (testMode) => {
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
    fetchData(isTestMode);
    const intervalId = setInterval(() => fetchData(isTestMode), POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchData, isTestMode]);

  // // Client-side filtering and pagination logic
  const filteredReports = useMemo(() => {
    setCurrentPage(1); // Reset page on filter change
    return reports.filter(report => {
      const hostnameMatch = report.hostname.toLowerCase().includes(filters.hostname.toLowerCase());
      const typeMatch = filters.type ? report.type === filters.type : true;
      return hostnameMatch && typeMatch;
    });
  }, [reports, filters]);

  const totalPages = Math.ceil(filteredReports.length / REPORTS_PER_PAGE);
  const currentReports = filteredReports.slice(
    (currentPage - 1) * REPORTS_PER_PAGE,
    currentPage * REPORTS_PER_PAGE
  );

  const handleTestModeToggle = (e) => {
    const newTestMode = e.target.checked;
    setIsTestMode(newTestMode);
    setLoading(true);
    fetchData(newTestMode);
  };

  const handleViewReport = async (reportPath) => {
    try {
      const res = await axios.get(`/api/report-content?path=${encodeURIComponent(reportPath)}`, { params: { test_mode: isTestMode } });
      setSelectedReport({
        name: reportPath.split(/\/|\\/).pop(),
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
        <Heading size="md">Firewall Status</Heading>
        <FormControl display="flex" alignItems="center" w="auto">
          <FormLabel htmlFor="test-mode-switch" mb="0" mr={3}>
            Test Mode
          </FormLabel>
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
                      <FormLabel htmlFor={`switch-${fw.id}`} mb="0" fontSize="sm">
                          Enabled
                      </FormLabel>
                      <Switch size="sm" id={`switch-${fw.id}`} isChecked={fw.is_enabled} onChange={() => handleToggleStatus(fw.id)} />
                  </FormControl>
                  <Button size="sm" onClick={() => handleEditConfig(fw.id)}>Edit Config</Button>
              </HStack>
            </VStack>
          </Box>
        ))}
      </SimpleGrid>

      <Box p={5} shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={cardBg}>
        <Heading size="md" mb={4}>Generated Reports</Heading>
        <HStack mb={4} spacing={4}>
          <Input 
            placeholder="Filter by Hostname"
            value={filters.hostname}
            onChange={(e) => setFilters({...filters, hostname: e.target.value})}
            bg={inputBg}
          />
          <Select 
            placeholder="Filter by Type"
            value={filters.type}
            onChange={(e) => setFilters({...filters, type: e.target.value})}
            bg={inputBg}
          >
            <option value="periodic">Periodic</option>
            <option value="summary">Summary</option>
            <option value="final">Final</option>
          </Select>
        </HStack>
        <TableContainer>
          <Table variant="simple" size="sm">
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
              {currentReports.length > 0 ? (
                currentReports.map((report) => (
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
                  <Td colSpan={5} textAlign="center">No reports found matching your criteria.</Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </TableContainer>
        {filteredReports.length > REPORTS_PER_PAGE && (
            <HStack justify="flex-end" mt={4} spacing={2}>
                <Text fontSize="sm">Page {currentPage} of {totalPages}</Text>
                <IconButton 
                    icon={<ChevronLeftIcon />} 
                    size="sm"
                    aria-label="Previous Page"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    isDisabled={currentPage === 1}
                />
                <IconButton 
                    icon={<ChevronRightIcon />} 
                    size="sm"
                    aria-label="Next Page"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    isDisabled={currentPage === totalPages}
                />
            </HStack>
        )}
      </Box>

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