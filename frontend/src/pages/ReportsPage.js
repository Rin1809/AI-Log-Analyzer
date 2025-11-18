import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  useColorModeValue,
  Center,
} from '@chakra-ui/react';
import ReportFilters from '../components/reports/ReportFilters';
import ReportsTable from '../components/reports/ReportsTable';
import PaginationControls from '../components/reports/PaginationControls';
import ReportViewerModal from '../components/reports/ReportViewerModal';

const POLLING_INTERVAL = 15000;
const REPORTS_PER_PAGE = 10;

const ReportsPage = () => {
  const { isTestMode } = useOutletContext();
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

  const fetchData = useCallback(async (testMode) => {
    // // chi hien spinner khi load lan dau
    if (reports.length === 0) setLoading(true);
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
  }, [reports.length]);

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
  const currentReports = filteredReports.slice((currentPage - 1) * REPORTS_PER_PAGE, currentPage * REPORTS_PER_PAGE);

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

  if (loading) {
    return <Center h="80vh"><Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" /></Center>;
  }

  if (error) {
    return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
  }

  return (
    <VStack spacing={8} align="stretch">
      <Box p={5} shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={cardBg}>
        <Heading size="md" mb={4}>Generated Reports</Heading>
        <ReportFilters filters={filters} onFilterChange={setFilters} />
        <ReportsTable reports={currentReports} onViewReport={handleViewReport} />
        <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </Box>

      <ReportViewerModal isOpen={isReportModalOpen} onClose={onReportModalClose} report={selectedReport} />
    </VStack>
  );
};

export default ReportsPage;