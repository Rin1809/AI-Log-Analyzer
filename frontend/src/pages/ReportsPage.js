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
  
  // Expanded Filters State
  const [filters, setFilters] = useState({ 
      hostname: '', 
      type: '',
      status: '',
      startDate: '',
      endDate: ''
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const toast = useToast();
  const { isOpen: isReportModalOpen, onOpen: onReportModalOpen, onClose: onReportModalClose } = useDisclosure();

  const cardBg = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const fetchData = useCallback(async (testMode) => {
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

  // --- Helper Logic for Filtering ---
  const checkStatus = (stats, filterStatus) => {
      if (!filterStatus) return true;
      
      const isError = !stats || Object.keys(stats).length === 0 || Object.values(stats).includes('N/A');
      
      if (filterStatus === 'error') return isError;
      if (filterStatus === 'success') return !isError;
      return true;
  };

  const checkDateRange = (reportDateStr, startStr, endStr) => {
      if (!startStr && !endStr) return true;
      
      const reportDate = new Date(reportDateStr);
      reportDate.setHours(0,0,0,0); // Normalize

      if (startStr) {
          const start = new Date(startStr);
          if (reportDate < start) return false;
      }
      if (endStr) {
          const end = new Date(endStr);
          if (reportDate > end) return false;
      }
      return true;
  };

  // --- Main Filtering Logic ---
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      // 1. Hostname
      const hostnameMatch = report.hostname.toLowerCase().includes(filters.hostname.toLowerCase());
      
      // 2. Type
      const typeMatch = filters.type ? report.type === filters.type : true;
      
      // 3. Status
      const statusMatch = checkStatus(report.summary_stats, filters.status);

      // 4. Date Range
      const dateMatch = checkDateRange(report.generated_time, filters.startDate, filters.endDate);

      return hostnameMatch && typeMatch && statusMatch && dateMatch;
    });
  }, [reports, filters]);

  // Extract Unique Types for Dropdown
  const uniqueTypes = useMemo(() => {
      const types = new Set(reports.map(r => r.type));
      return Array.from(types).sort();
  }, [reports]);

  useEffect(() => {
    setCurrentPage(1); // Reset page when filters change
  }, [filters]);

  const totalPages = Math.ceil(filteredReports.length / REPORTS_PER_PAGE);
  const currentReports = filteredReports.slice((currentPage - 1) * REPORTS_PER_PAGE, currentPage * REPORTS_PER_PAGE);

  // --- Action Handlers ---

  const handleViewRaw = async (reportPath) => {
    try {
      const res = await axios.get(`/api/report-content?path=${encodeURIComponent(reportPath)}`, { params: { test_mode: isTestMode } });
      setSelectedReport({
        name: reportPath.split(/\/|\\/).pop(),
        content: JSON.stringify(res.data, null, 2),
        format: 'json'
      });
      onReportModalOpen();
    } catch (err) {
      toast({ title: "Error", description: `Could not load raw content. ${err.message}`, status: "error", duration: 5000, isClosable: true });
    }
  };

  const handleViewTemplate = async (reportPath) => {
    try {
        const res = await axios.get(`/api/reports/preview?path=${encodeURIComponent(reportPath)}`, { params: { test_mode: isTestMode } });
        setSelectedReport({
            name: reportPath.split(/\/|\\/).pop(),
            content: res.data.html,
            format: 'html'
        });
        onReportModalOpen();
    } catch (err) {
        toast({ title: "Preview Error", description: `Could not generate preview. ${err.message}`, status: "error", duration: 5000 });
    }
  };

  const handleDownload = async (reportPath) => {
      // // Use raw browser navigation/link to trigger download via backend
      const url = `http://127.0.0.1:8000/api/reports/download?path=${encodeURIComponent(reportPath)}`;
      window.open(url, '_blank');
  };

  const handleDelete = async (reportPath) => {
      if (!window.confirm("Are you sure you want to delete this report? This will affect dashboard statistics.")) return;
      try {
          await axios.delete(`/api/reports?path=${encodeURIComponent(reportPath)}`);
          toast({ title: "Deleted", status: "success" });
          fetchData(isTestMode); // Refresh list
      } catch (err) {
          toast({ title: "Delete Failed", description: err.message, status: "error" });
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
      <Box p={5} borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={cardBg}>
        <Heading size="lg" fontWeight="normal" mb={6}>Generated Reports</Heading>
        
        <ReportFilters 
            filters={filters} 
            onFilterChange={setFilters} 
            uniqueTypes={uniqueTypes}
        />
        
        <ReportsTable 
            reports={currentReports} 
            onViewRaw={handleViewRaw}
            onViewTemplate={handleViewTemplate}
            onDownload={handleDownload}
            onDelete={handleDelete}
        />
        
        <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </Box>

      <ReportViewerModal isOpen={isReportModalOpen} onClose={onReportModalClose} report={selectedReport} />
    </VStack>
  );
};

export default ReportsPage;