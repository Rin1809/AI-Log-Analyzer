import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  SimpleGrid,
  Spinner,
  Alert,
  AlertIcon,
  Heading,
  useColorModeValue,
  VStack,
  HStack,
  Text,
  Icon,
  Flex // // fix: da them Flex vao day
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningTwoIcon, CopyIcon } from '@chakra-ui/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// // Polling interval
const POLLING_INTERVAL = 30000; // 30 seconds for dashboard

const StatCard = ({ title, value, icon, color }) => {
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    return (
        <Box p={5} shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={cardBg}>
            <HStack>
                <Icon as={icon} w={8} h={8} color={color} />
                <VStack align="start" spacing={0}>
                    <Text fontSize="2xl" fontWeight="bold">{value}</Text>
                    <Text fontSize="md" color="gray.500">{title}</Text>
                </VStack>
            </HStack>
        </Box>
    );
};

const MainDashboard = () => {
    const [stats, setStats] = useState({ active: 0, inactive: 0, totalReports: 0 });
    const [chartData, setChartData] = useState([]);
    const [hostKeys, setHostKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // // @todo: get this from user config or something smarter
    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const processDataForChart = (reports) => {
        // // chi lay periodic reports de ve bieu do
        const periodicReports = reports.filter(r => r.type === 'periodic');
        if (periodicReports.length === 0) return { data: [], keys: [] };

        const hostnames = [...new Set(periodicReports.map(r => r.hostname))];
        const dataMap = new Map();

        periodicReports.forEach(report => {
            try {
                // // key la thoi gian, de gom cac report cung thoi diem
                const timestamp = new Date(report.generated_time).toLocaleString();
                const hostname = report.hostname;
                // // API should probably return a number, but we parse it defensively
                const blockedEvents = parseInt(JSON.parse(report.path_placeholder.content).summary_stats.total_blocked_events, 10) || 0;

                if (!dataMap.has(timestamp)) {
                    const newPoint = { time: timestamp };
                    hostnames.forEach(hn => { newPoint[hn] = 0; }); // init voi 0
                    dataMap.set(timestamp, newPoint);
                }

                const point = dataMap.get(timestamp);
                point[hostname] = (point[hostname] || 0) + blockedEvents;
            } catch (e) {
                // // ignore bad report data
            }
        });

        const sortedData = Array.from(dataMap.values()).sort((a, b) => new Date(a.time) - new Date(b.time));
        return { data: sortedData, keys: hostnames };
    };

    const fetchData = useCallback(async () => {
        if (loading) setError('');
        
        try {
            // // For dashboard, we use production config, not test_mode
            const apiParams = { params: { test_mode: false } };
            
            const [statusRes, reportsRes] = await Promise.all([
                axios.get('/api/status', apiParams),
                // // can't use the real report content API without a path, so we fake it
                // // In a real scenario, you'd need a new API endpoint like /api/reports/content
                axios.get('/api/reports', apiParams).then(async (res) => {
                    const reportsWithContent = await Promise.all(res.data.map(async (report) => {
                         const contentRes = await axios.get(`/api/report-content?path=${encodeURIComponent(report.path)}`, apiParams);
                         return { ...report, path_placeholder: { content: JSON.stringify(contentRes.data) }};
                    }));
                    return { data: reportsWithContent };
                })
            ]);
            
            const activeHosts = statusRes.data.filter(s => s.is_enabled).length;
            const inactiveHosts = statusRes.data.length - activeHosts;

            setStats({
                active: activeHosts,
                inactive: inactiveHosts,
                totalReports: reportsRes.data.length
            });

            const { data, keys } = processDataForChart(reportsRes.data);
            setChartData(data);
            setHostKeys(keys);

        } catch (err) {
            console.error(err);
            setError(`Failed to fetch dashboard data. Details: ${err.message}`);
        } finally {
            if (loading) setLoading(false);
        }
    }, [loading]);

    useEffect(() => {
        fetchData();
        const intervalId = setInterval(fetchData, POLLING_INTERVAL);
        return () => clearInterval(intervalId);
    }, [fetchData]);

    if (loading) {
        return <Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" />;
    }

    if (error) {
        return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
    }

    return (
        <VStack spacing={8} align="stretch">
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                <StatCard title="Active Hosts" value={stats.active} icon={CheckCircleIcon} color="green.500" />
                <StatCard title="Inactive Hosts" value={stats.inactive} icon={WarningTwoIcon} color="red.500" />
                <StatCard title="Total Reports" value={stats.totalReports} icon={CopyIcon} color="blue.500" />
            </SimpleGrid>

            <Box p={5} shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={cardBg} h="400px">
                <Heading size="md" mb={4}>Blocked Events Over Time</Heading>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {hostKeys.map((key, index) => (
                                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <Flex justify="center" align="center" h="100%">
                        <Text>No periodic report data available to display chart.</Text>
                    </Flex>
                )}
            </Box>
        </VStack>
    );
};

export default MainDashboard;