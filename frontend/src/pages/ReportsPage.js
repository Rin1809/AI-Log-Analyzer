import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
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
  useColorModeValue,
  Input,
  Select,
  IconButton,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';

const POLLING_INTERVAL = 15000;
const REPORTS_PER_PAGE = 10;

const ReportsPage = () => {
  const { isTestMode } = useOutletContext(); // // Lay state global
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [filters, setFilters] = useState({ hostname: '', type: '' });
  const [currentPage, setCurrentPage] = useState(1);

  const toast = useToast();
  const { isOpen: isReportModalOpen, onOpen: onReportModalOpen, onClose: onReportModalClose } = useDisclosure();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const inputBg = useColorModeValue('gray.50', 'gray.700');

  const fetchData = useCallback(async (testMode) => {
    setLoading(true);
    setError('');
    try {
      const apiParams = { params: { test_mode: testMode } };
      const reportsRes = await axios.get('/api/reports', apiParams);
      setReports(reportsRes.data);
    } catch (err) {
      console.error(err);
      setError(`Failed to connect to backend. Details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(isTestMode);
    const intervalId = setInterval(() => fetchData(isTestMode), POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchData, isTestMode]);

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const hostnameMatch = report.hostname.toLowerCase().includes(filters.hostname.toLowerCase());
      const typeMatch = filters.type ? report.type === filters.type : true;
      return hostnameMatch && typeMatch;
    });
  }, [reports, filters]);

  useEffect(() => {
    setCurrentPage(1); // Reset page when filters change
  }, [filters]);


  const totalPages = Math.ceil(filteredReports.length / REPORTS_PER_PAGE);
  const currentReports = filteredReports.slice(
    (currentPage - 1) * REPORTS_PER_PAGE,
    currentPage * REPORTS_PER_PAGE
  );

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
    return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
  }

  return (
    <VStack spacing={8} align="stretch">
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
            <option value="">All Types</option>
            <option value="periodic">Periodic</option>
            <option value="summary">Summary</option>
            <option value="final">Final</option>
          </Select>
        </HStack>
        <TableContainer>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr><Th>Hostname</Th><Th>Filename</Th><Th>Type</Th><Th>Generated Time</Th><Th>Actions</Th></Tr>
            </Thead>
            <Tbody>
              {currentReports.length > 0 ? (
                currentReports.map((report) => (
                  <Tr key={report.path}>
                    <Td>{report.hostname}</Td>
                    <Td>{report.filename}</Td>
                    <Td><Tag size="sm" colorScheme={getTagColor(report.type)}>{report.type.toUpperCase()}</Tag></Td>
                    <Td>{report.generated_time}</Td>
                    <Td>
                      <Button colorScheme="teal" variant="outline" size="xs" onClick={() => handleViewReport(report.path)}>View</Button>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr><Td colSpan={5} textAlign="center">No reports found matching your criteria.</Td></Tr>
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
            <Code display="block" whiteSpace="pre" p={4} borderRadius="md" w="100%">{selectedReport?.content}</Code>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onReportModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default ReportsPage;