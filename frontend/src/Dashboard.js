import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
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
} from '@chakra-ui/react';

const Dashboard = () => {
  const [status, setStatus] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { isOpen, onOpen, onClose } = useDisclosure();

  // fetch data tu backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const statusRes = await axios.get('/api/status');
        const reportsRes = await axios.get('/api/reports');
        setStatus(statusRes.data);
        setReports(reportsRes.data);
      } catch (err) {
        console.error(err);
        setError(`Failed to connect to backend. Make sure the API server is running. Details: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleViewReport = async (reportPath) => {
    try {
        const res = await axios.get(`/api/report-content?path=${encodeURIComponent(reportPath)}`);
        setSelectedReport({
            name: reportPath.split('/').pop(),
            content: JSON.stringify(res.data, null, 2) // pretty print JSON
        });
        onOpen();
    } catch(err) {
        console.error("Failed to fetch report content", err);
        setError(`Could not load report content. Details: ${err.message}`);
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
    return (
      <Alert status="error">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Heading size="md" mb={4}>Firewall Status</Heading>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6} mb={8}>
        {status.map((fw) => (
          <Stat key={fw.id} p={5} shadow="md" border="1px" borderColor="gray.200" borderRadius="md" bg="white">
            <StatLabel>{fw.hostname}</StatLabel>
            <StatNumber color={fw.status === 'Online' ? 'green.500' : 'red.500'}>
              {fw.status}
            </StatNumber>
            <StatHelpText>Last run: {fw.last_run !== 'Never' ? new Date(fw.last_run).toLocaleString() : 'Never'}</StatHelpText>
          </Stat>
        ))}
      </SimpleGrid>

      <Heading size="md" mb={4}>Generated Reports</Heading>
      <TableContainer bg="white" borderRadius="md" shadow="md" border="1px" borderColor="gray.200">
        <Table variant="simple">
          <Thead>
            <Tr>
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
                  <Td>{report.filename}</Td>
                  <Td>
                    <Tag size="sm" colorScheme={getTagColor(report.type)}>{report.type.toUpperCase()}</Tag>
                  </Td>
                  <Td>{report.generated_time}</Td>
                  <Td>
                    <Button colorScheme="teal" size="xs" onClick={() => handleViewReport(report.path)}>
                      View
                    </Button>
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={4} textAlign="center">No reports found.</Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>

      {/* // Modal de xem content */}
      <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedReport?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Code display="block" whiteSpace="pre" p={4} borderRadius="md" bg="gray.50">
                {selectedReport?.content}
            </Code>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default Dashboard;