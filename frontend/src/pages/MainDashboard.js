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

    const cardBg = useColorModeValue('white', 'gray.800');
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
        isInitialLoad.current = true;
        fetchData(isTestMode);
        const intervalId = setInterval(() => fetchData(isTestMode), POLLING_INTERVAL);
        return () => clearInterval(intervalId);
    }, [fetchData, isTestMode]);

    // --- Memoized data for charts ---
    const hostStatusData = useMemo(() => {
        const active = statusData.filter(s => s.is_enabled).length;
        const inactive = statusData.length - active;
        if (active === 0 && inactive === 0) return [];
        return [{ name: 'Active', value: active }, { name: 'Inactive', value: inactive }];
    }, [statusData]);

    const reportTypeData = useMemo(() => {
        if (reports.length === 0) return [];
        const types = reports.reduce((acc, report) => {
            acc[report.type] = (acc[report.type] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(types).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
    }, [reports]);

    const reportsByHostData = useMemo(() => {
        if (reports.length === 0) return [];
        const hosts = reports.reduce((acc, report) => {
            acc[report.hostname] = (acc[report.hostname] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(hosts).map(([name, value]) => ({ name, value }));
    }, [reports]);

    const lineChartData = useMemo(() => {
        const activeHostnames = statusData.filter(s => s.is_enabled).map(s => s.hostname);
        const periodicReports = reports.filter(r => r.type === 'periodic');
        if (activeHostnames.length === 0 || periodicReports.length === 0) return { data: [], keys: [] };

        // // logic fix: tao data lien tuc
        const reportMap = new Map();
        periodicReports.forEach(r => {
            const timestamp = new Date(r.generated_time).getTime();
            if (!reportMap.has(timestamp)) {
                reportMap.set(timestamp, []);
            }
            reportMap.get(timestamp).push(r);
        });

        const allTimestamps = [...new Set(periodicReports.map(r => new Date(r.generated_time).getTime()))].sort((a, b) => a - b);
        
        const lastValues = activeHostnames.reduce((acc, host) => {
            acc[host] = 0;
            return acc;
        }, {});

        const finalData = allTimestamps.map(ts => {
            const reportsAtTime = reportMap.get(ts) || [];
            reportsAtTime.forEach(report => {
                const logCount = parseInt(report.summary_stats?.raw_log_count, 10) || 0;
                lastValues[report.hostname] = logCount;
            });
            
            const formattedTime = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                <InfoCard title="Host Status"><PieChartDisplay data={hostStatusData} /></InfoCard>
                <InfoCard title="Report Types"><PieChartDisplay data={reportTypeData} /></InfoCard>
                <InfoCard title="Reports by Host"><PieChartDisplay data={reportsByHostData} /></InfoCard>
            </SimpleGrid>

            <Box p={5} shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius="lg" bg={cardBg} h="400px">
                <LineChartDisplay data={lineChartData.data} keys={lineChartData.keys} />
            </Box>
        </VStack>
    );
};

export default MainDashboard;