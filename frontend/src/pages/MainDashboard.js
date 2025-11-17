import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  SimpleGrid,
  Spinner,
  Alert,
  AlertIcon,
  Heading,
  useColorModeValue,
  VStack,
  Text,
  Flex,
  Center,
  HStack,
} from '@chakra-ui/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const POLLING_INTERVAL = 30000;
const COLORS = ['#3182CE', '#805AD5', '#D69E2E', '#38A169', '#DD6B20', '#00A3C4'];

const ChartCard = ({ title, children }) => {
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    return (
        <Box
            p={5}
            shadow="md"
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="lg"
            bg={cardBg}
            h="350px"
            transition="all 0.2s"
            _hover={{ shadow: 'lg' }}
        >
            <Heading size="sm" mb={4} textAlign="center" fontWeight="semibold">
                {title}
            </Heading>
            {children}
        </Box>
    );
};

const CustomLegend = ({ payload }) => {
    const textColor = useColorModeValue('gray.600', 'gray.300');

    if (!payload || payload.length === 0) {
        return null;
    }

    return (
        <VStack align="start" justify="center" h="100%" spacing={3}>
            {payload.map((entry, index) => (
                <HStack key={`item-${index}`} spacing={3}>
                    <Box boxSize="12px" borderRadius="full" bg={entry.color} />
                    <Text fontSize="sm" color={textColor}>
                        {entry.value} ({entry.payload.payload.value})
                    </Text>
                </HStack>
            ))}
        </VStack>
    );
};

const MainDashboard = () => {
    const { isTestMode } = useOutletContext();
    const [statusData, setStatusData] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const isInitialLoad = useRef(true);

    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const lineChartColor = useColorModeValue('gray.800', 'white');
    const gridStrokeColor = useColorModeValue('gray.200', 'gray.700');
    const tooltipBgColor = useColorModeValue('white', 'gray.800');
    const cardBg = useColorModeValue('white', 'gray.800');

    const fetchData = useCallback(async (testMode) => {
        if (isInitialLoad.current) {
            setLoading(true);
        }
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
        return [
            { name: 'Active', value: active },
            { name: 'Inactive', value: inactive },
        ];
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
        const allHostnames = statusData.filter(s => s.is_enabled).map(s => s.hostname);
        const periodicReports = reports.filter(r => r.type === 'periodic');
        if (allHostnames.length === 0) return { data: [], keys: [] };

        const dataMap = new Map();
        periodicReports.forEach(report => {
            const timestamp = new Date(report.generated_time).toLocaleString();
            const hostname = report.hostname;
            const logCount = parseInt(report.summary_stats?.raw_log_count, 10) || 0;
            if (!dataMap.has(timestamp)) {
                dataMap.set(timestamp, { time: timestamp });
            }
            const point = dataMap.get(timestamp);
            point[hostname] = (point[hostname] || 0) + logCount;
        });

        for (const point of dataMap.values()) {
            allHostnames.forEach(key => {
                if (point[key] === undefined) point[key] = 0;
            });
        }

        const sortedData = Array.from(dataMap.values()).sort((a, b) => new Date(a.time) - new Date(b.time));
        return { data: sortedData.slice(-20), keys: allHostnames };
    }, [reports, statusData]);

    // --- Render logic ---
    if (loading) {
        return <Center h="80vh"><Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" /></Center>;
    }

    if (error) {
        return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
    }

    const renderPieChart = (data) => {
        if (!data || data.length === 0) {
            return <Center h="100%"><Text color="gray.500">No data to display.</Text></Center>;
        }

        return (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        innerRadius="60%"
                        outerRadius="80%"
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Legend
                        content={CustomLegend}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                    />
                </PieChart>
            </ResponsiveContainer>
        );
    };

    return (
        <VStack spacing={6} align="stretch">
            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
                <ChartCard title="Host Status">{renderPieChart(hostStatusData)}</ChartCard>
                <ChartCard title="Report Types">{renderPieChart(reportTypeData)}</ChartCard>
                <ChartCard title="Reports by Host">{renderPieChart(reportsByHostData)}</ChartCard>
            </SimpleGrid>

            <Box p={5} shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius="lg" bg={cardBg} h="400px">
                <Heading size="md" mb={4} fontWeight="semibold">Total Logs Over Time</Heading>
                {lineChartData.data.length > 0 && lineChartData.keys.length > 0 ? (
                    <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={lineChartData.data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStrokeColor} />
                            <XAxis dataKey="time" tick={{ fontSize: 12, fill: lineChartColor }} />
                            <YAxis tick={{ fontSize: 12, fill: lineChartColor }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: tooltipBgColor,
                                    borderColor: borderColor
                                }}
                            />
                            <Legend />
                            {lineChartData.keys.map((key, index) => (
                                <Line key={key} type="monotone" dataKey={key} name={`${key}`} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <Flex justify="center" align="center" h="100%" pb={10}>
                        <Text color="gray.500">No periodic report data available to display chart.</Text>
                    </Flex>
                )}
            </Box>
        </VStack>
    );
};

export default MainDashboard;