import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  SimpleGrid,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  VStack,
  Center,
  Heading,
} from '@chakra-ui/react';
import PieChartDisplay from '../components/dashboard/PieChartDisplay';
import LineChartDisplay from '../components/dashboard/LineChartDisplay';
import InfoCard from '../components/dashboard/InfoCard';

const POLLING_INTERVAL = 30000;

const MainDashboard = () => {
    const { isTestMode } = useOutletContext();
    const [statusData, setStatusData] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const isInitialLoad = useRef(true);

    const cardBg = useColorModeValue('gray.50', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const fetchData = useCallback(async (testMode) => {
        if (isInitialLoad.current) setLoading(true);
        setError('');
        try {
            const apiParams = { params: { test_mode: testMode } };
            const [statusRes, reportsRes] = await Promise.all([
                axios.get('/api/status', apiParams),
                axios.get('/api/reports', apiParams)
            ]);
            setStatusData(statusRes.data);
            setReports(reportsRes.data);
        } catch (err) {
            console.error(err);
            setError(`Failed to fetch dashboard data. Details: ${err.message}`);
        } finally {
            if (isInitialLoad.current) {
                setLoading(false);
                isInitialLoad.current = false;
            }
        }
    }, []);

    useEffect(() => {
        setStatusData([]);
        setReports([]);
        isInitialLoad.current = true;
        
        fetchData(isTestMode);
        const intervalId = setInterval(() => fetchData(isTestMode), POLLING_INTERVAL);
        return () => clearInterval(intervalId);
    }, [fetchData, isTestMode]);

    
    const hostStatusData = useMemo(() => {
        if (!statusData || statusData.length === 0) return [];
        const active = statusData.filter(s => s.is_enabled).length;
        const inactive = statusData.length - active;
        if (active === 0 && inactive === 0) return [];
        return [{ name: 'Active', value: active }, { name: 'Inactive', value: inactive }];
    }, [statusData]);

    const reportTypeData = useMemo(() => {
        if (!reports || reports.length === 0) return [];
        const types = reports.reduce((acc, report) => {
            let typeName = report.type.replace(/_/g, ' ');
            typeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
            acc[typeName] = (acc[typeName] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(types).map(([name, value]) => ({ name, value }));
    }, [reports]);

    const reportsByHostData = useMemo(() => {
        if (!reports || reports.length === 0) return [];
        const hosts = reports.reduce((acc, report) => {
            acc[report.hostname] = (acc[report.hostname] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(hosts).map(([name, value]) => ({ name, value }));
    }, [reports]);

    const lineChartData = useMemo(() => {
        if (!statusData || statusData.length === 0) return { data: [], keys: [] };
        
        const activeHostnames = statusData.filter(s => s.is_enabled).map(s => s.hostname);
        
        const logAnalysisReports = reports.filter(r => 
            r.summary_stats && 
            (r.summary_stats.raw_log_count !== undefined || r.summary_stats.total_blocked_events !== undefined)
        );
        
        if (activeHostnames.length === 0 || logAnalysisReports.length === 0) return { data: [], keys: [] };

        const reportMap = new Map();
        logAnalysisReports.forEach(r => {
            const timestamp = new Date(r.generated_time).getTime();
            if (!reportMap.has(timestamp)) {
                reportMap.set(timestamp, []);
            }
            reportMap.get(timestamp).push(r);
        });

        const allTimestamps = [...new Set(logAnalysisReports.map(r => new Date(r.generated_time).getTime()))].sort((a, b) => a - b);
        
        const lastValues = activeHostnames.reduce((acc, host) => {
            acc[host] = 0;
            return acc;
        }, {});

        const finalData = allTimestamps.map(ts => {
            const reportsAtTime = reportMap.get(ts) || [];
            reportsAtTime.forEach(report => {
                let val = 0;
                if (report.summary_stats.raw_log_count !== undefined) val = parseInt(report.summary_stats.raw_log_count, 10);
                else if (report.summary_stats.total_blocked_events !== "N/A") val = parseInt(report.summary_stats.total_blocked_events, 10);
                lastValues[report.hostname] = val;
            });
            
            const formattedTime = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
            return { time: formattedTime, ...lastValues };
        });

        return { data: finalData, keys: activeHostnames };
    }, [reports, statusData]);

    // --- Render logic ---
    if (loading) {
        return <Center h="80vh"><Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" /></Center>;
    }

    if (error) {
        return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
    }

    return (
        <VStack spacing={6} align="stretch">
            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
                <VStack align="stretch" spacing={3}>
                    <Heading size="md" fontWeight="normal" textAlign="left">Host Status</Heading>
                    <InfoCard><PieChartDisplay data={hostStatusData} /></InfoCard>
                </VStack>
                <VStack align="stretch" spacing={3}>
                    <Heading size="md" fontWeight="normal" textAlign="left">Report Types</Heading>
                    <InfoCard><PieChartDisplay data={reportTypeData} /></InfoCard>
                </VStack>
                <VStack align="stretch" spacing={3}>
                    <Heading size="md" fontWeight="normal" textAlign="left">Reports by Host</Heading>
                    <InfoCard><PieChartDisplay data={reportsByHostData} /></InfoCard>
                </VStack>
            </SimpleGrid>
            
            <VStack align="stretch" spacing={3} mt={4}>
                <Heading size="md" fontWeight="normal" textAlign="left">Log Volume Analysis</Heading>
                <Box p={5} borderWidth="1px" borderColor={borderColor} borderRadius="lg" bg={cardBg} h="400px">
                    <LineChartDisplay data={lineChartData.data} keys={lineChartData.keys} />
                </Box>
            </VStack>

        </VStack>
    );
};

export default MainDashboard;