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
  HStack,
  Text,
  Icon,
  Flex
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningTwoIcon, CopyIcon } from '@chakra-ui/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const POLLING_INTERVAL = 30000;

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
    const { isTestMode } = useOutletContext();
    const [statusData, setStatusData] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const isInitialLoad = useRef(true);

    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'];

    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    // // logic fix: chart lay danh sach host tu status, du lieu tu reports
    const { chartData, hostKeys } = useMemo(() => {
        // // nguon tin cay ve cac host can hien thi
        const allHostnames = statusData.filter(s => s.is_enabled).map(s => s.hostname);

        const periodicReports = reports.filter(r => r.type === 'periodic');
        
        if (periodicReports.length === 0 && allHostnames.length > 0) {
            // // van hien thi chart trong, co ten host
             const emptyData = [{ time: new Date().toLocaleString() }];
             allHostnames.forEach(hostname => {
                 emptyData[0][hostname] = 0;
             });
             return { chartData: emptyData, hostKeys: allHostnames };
        }
        
        if (allHostnames.length === 0) {
            return { chartData: [], hostKeys: [] };
        }
        
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
        
        // // dam bao moi host deu co gia tri, ke ca khi khong co report
        for (const point of dataMap.values()) {
            allHostnames.forEach(key => {
                if (point[key] === undefined) {
                    point[key] = 0;
                }
            });
        }
        
        const sortedData = Array.from(dataMap.values()).sort((a, b) => new Date(a.time) - new Date(b.time));
        
        return { chartData: sortedData, hostKeys: allHostnames };

    }, [reports, statusData]);

    const stats = useMemo(() => {
        const activeHosts = statusData.filter(s => s.is_enabled).length;
        const inactiveHosts = statusData.length - activeHosts;
        return {
            active: activeHosts,
            inactive: inactiveHosts,
            totalReports: reports.length
        };
    }, [statusData, reports]);


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
                <Heading size="md" mb={4}>Total Logs Over Time</Heading>
                {hostKeys.length > 0 ? (
                    <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {hostKeys.map((key, index) => (
                                <Line 
                                  key={key} 
                                  type="monotone" 
                                  dataKey={key} 
                                  name={`Logs: ${key}`} 
                                  stroke={COLORS[index % COLORS.length]} 
                                  strokeWidth={2} 
                                  dot={false} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <Flex justify="center" align="center" h="100%">
                        <Text>No active hosts found or no report data available.</Text>
                    </Flex>
                )}
            </Box>
        </VStack>
    );
};

export default MainDashboard;