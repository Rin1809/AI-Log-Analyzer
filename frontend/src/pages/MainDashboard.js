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
  Flex,
  InputGroup,
  InputLeftElement,
  Input,
  FormControl,
  FormLabel,
  Button,
  Icon,
  HStack,
  Text,
  Spacer,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Checkbox,
  Badge,
  MenuDivider
} from '@chakra-ui/react';
import { SearchIcon, RepeatIcon, TimeIcon, ChevronDownIcon } from '@chakra-ui/icons';
import PieChartDisplay from '../components/dashboard/PieChartDisplay';
import LineChartDisplay from '../components/dashboard/LineChartDisplay';
import InfoCard from '../components/dashboard/InfoCard';

const POLLING_INTERVAL = 30000;

const MainDashboard = () => {
    const { isTestMode } = useOutletContext();
    
    // --- Data State ---
    const [statusData, setStatusData] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // --- Global Filter State ---
    const [filters, setFilters] = useState({
        hostname: '',
        startDate: '',
        endDate: ''
    });

    // --- Chart Specific Filter State ---
    const [chartFilter, setChartFilter] = useState({
        startDateTime: '',
        endDateTime: ''
    });

    // // State cho viec chon host cu the de so sanh tren bieu do
    const [selectedChartHosts, setSelectedChartHosts] = useState([]);

    const isInitialLoad = useRef(true);

    // --- Styles ---
    const cardBg = useColorModeValue('gray.50', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const filterBg = useColorModeValue('white', 'gray.800');
    const inputBg = useColorModeValue('white', 'gray.700');

    // --- Fetch Data ---
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


    // --- Global Filtering Logic ---

    const filteredStatus = useMemo(() => {
        if (!filters.hostname) return statusData;
        return statusData.filter(s => 
            s.hostname.toLowerCase().includes(filters.hostname.toLowerCase())
        );
    }, [statusData, filters.hostname]);

    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            if (filters.hostname && !r.hostname.toLowerCase().includes(filters.hostname.toLowerCase())) {
                return false;
            }
            if (filters.startDate || filters.endDate) {
                const rDate = new Date(r.generated_time);
                const checkDate = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate());

                if (filters.startDate) {
                    const start = new Date(filters.startDate);
                    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                    if (checkDate < startDateOnly) return false;
                }
                if (filters.endDate) {
                    const end = new Date(filters.endDate);
                    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
                    if (checkDate > endDateOnly) return false;
                }
            }
            return true;
        });
    }, [reports, filters]);


    // --- Chart Data Calculation ---

    const hostStatusData = useMemo(() => {
        if (!filteredStatus || filteredStatus.length === 0) return [];
        const active = filteredStatus.filter(s => s.is_enabled).length;
        const inactive = filteredStatus.length - active;
        if (active === 0 && inactive === 0) return [];
        return [{ name: 'Active', value: active }, { name: 'Inactive', value: inactive }];
    }, [filteredStatus]);

    const reportTypeData = useMemo(() => {
        if (!filteredReports || filteredReports.length === 0) return [];
        const types = filteredReports.reduce((acc, report) => {
            let typeName = report.type.replace(/_/g, ' ');
            typeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
            acc[typeName] = (acc[typeName] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(types).map(([name, value]) => ({ name, value }));
    }, [filteredReports]);

    const reportsByHostData = useMemo(() => {
        if (!filteredReports || filteredReports.length === 0) return [];
        const hosts = filteredReports.reduce((acc, report) => {
            acc[report.hostname] = (acc[report.hostname] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(hosts).map(([name, value]) => ({ name, value }));
    }, [filteredReports]);


    const lineChartData = useMemo(() => {
        if (!filteredStatus || filteredStatus.length === 0) return { data: [], keys: [] };
        
        const allActiveHostnames = filteredStatus.filter(s => s.is_enabled).map(s => s.hostname);

        const targetHostnames = selectedChartHosts.length > 0 
            ? allActiveHostnames.filter(h => selectedChartHosts.includes(h))
            : allActiveHostnames;

        let chartReports = reports.filter(r => {
            if (!targetHostnames.includes(r.hostname)) return false;
            
            if (!r.summary_stats || 
                (r.summary_stats.raw_log_count === undefined && r.summary_stats.total_blocked_events === undefined)) {
                return false;
            }
      
            if (chartFilter.startDateTime || chartFilter.endDateTime) {
                const rTime = new Date(r.generated_time).getTime();
                if (chartFilter.startDateTime) {
                    const startTime = new Date(chartFilter.startDateTime).getTime();
                    if (rTime < startTime) return false;
                }
                if (chartFilter.endDateTime) {
                    const endTime = new Date(chartFilter.endDateTime).getTime();
                    if (rTime > endTime) return false;
                }
            }
            return true;
        });
        
        const timestampSet = new Set();
        const reportMap = new Map();

        chartReports.forEach(r => {
            const timestamp = new Date(r.generated_time).getTime();
            timestampSet.add(timestamp);
            
            if (!reportMap.has(timestamp)) {
                reportMap.set(timestamp, []);
            }
            reportMap.get(timestamp).push(r);
        });

        if (chartFilter.startDateTime) {
            timestampSet.add(new Date(chartFilter.startDateTime).getTime());
        }
        if (chartFilter.endDateTime) {
            timestampSet.add(new Date(chartFilter.endDateTime).getTime());
        }

        const allTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

        if (allTimestamps.length === 0 && targetHostnames.length > 0) return { data: [], keys: [] };

        // Khoi tao gia tri mac dinh
        const lastValues = targetHostnames.reduce((acc, host) => {
            acc[host] = 0;
            return acc;
        }, {});

        const finalData = allTimestamps.map(ts => {
            const reportsAtTime = reportMap.get(ts) || [];
            
            if (reportsAtTime.length > 0) {
                reportsAtTime.forEach(report => {
                    let val = 0;
                    if (report.summary_stats.raw_log_count !== undefined) val = parseInt(report.summary_stats.raw_log_count, 10);
                    else if (report.summary_stats.total_blocked_events !== "N/A") val = parseInt(report.summary_stats.total_blocked_events, 10);
                    lastValues[report.hostname] = val;
                });
            } else {
                 // Reset ve 0 neu khong co report (optional: hoac giu gia tri cu neu muon dang step-chart)
                 // O day ta reset ve 0 de the hien su vang mat cua log
                 targetHostnames.forEach(host => {
                    lastValues[host] = 0; 
                });
            }
            
            const formattedTime = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
            return { time: formattedTime, ...lastValues };
        });

        return { data: finalData, keys: targetHostnames };
    }, [reports, filteredStatus, chartFilter, selectedChartHosts]);


    // --- Handlers ---
    const handleResetGlobalFilters = () => {
        setFilters({ hostname: '', startDate: '', endDate: '' });
    };

    const handleResetChartFilter = () => {
        setChartFilter({ startDateTime: '', endDateTime: '' });
    };
    
    const toggleChartHost = (hostname) => {
        setSelectedChartHosts(prev => {
            if (prev.includes(hostname)) return prev.filter(h => h !== hostname);
            return [...prev, hostname];
        });
    };

    const clearChartHostSelection = () => setSelectedChartHosts([]);

    // --- Render ---
    if (loading) {
        return <Center h="80vh"><Spinner size="xl" /></Center>;
    }

    if (error) {
        return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
    }

    // Lay danh sach cac host dang active de hien thi trong Menu
    const activeHostnamesForMenu = filteredStatus.filter(s => s.is_enabled).map(s => s.hostname);

    return (
        <VStack spacing={6} align="stretch">
            <Box p={5} borderWidth="1px" borderColor={borderColor} borderRadius="lg" bg={filterBg} shadow="sm">
                <Flex direction={{ base: 'column', lg: 'row' }} gap={4} align={{ base: 'stretch', lg: 'flex-end' }}>
                    <FormControl flex="1">
                        <FormLabel fontSize="sm" fontWeight="normal" color="gray.500">Global Filter (Host & Broad Date)</FormLabel>
                        <InputGroup>
                            <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400" /></InputLeftElement>
                            <Input 
                                placeholder="Search Hostname..." 
                                value={filters.hostname}
                                onChange={(e) => setFilters(prev => ({ ...prev, hostname: e.target.value }))}
                                bg={inputBg}
                            />
                        </InputGroup>
                    </FormControl>
                    <FormControl w={{ base: '100%', lg: '200px' }}>
                         <FormLabel fontSize="sm" color="gray.500">From Date</FormLabel>
                         <Input type="date" value={filters.startDate} onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))} bg={inputBg} />
                    </FormControl>
                    <FormControl w={{ base: '100%', lg: '200px' }}>
                         <FormLabel fontSize="sm" color="gray.500">To Date</FormLabel>
                         <Input type="date" value={filters.endDate} onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))} bg={inputBg} />
                    </FormControl>
                    <Button leftIcon={<Icon as={RepeatIcon} />} onClick={handleResetGlobalFilters} colorScheme="gray" variant="outline" fontWeight="normal">
                        Reset
                    </Button>
                </Flex>
            </Box>

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
                <Flex align="center" wrap="wrap" gap={4}>
                    <Heading size="md" fontWeight="normal">Log Volume Analysis</Heading>
                    <Spacer />
                    
                    
                    <Menu closeOnSelect={false}>
                        <MenuButton 
                            as={Button} 
                            rightIcon={<ChevronDownIcon />} 
                            variant="outline" 
                            size="sm" 
                            bg={cardBg}
                            fontWeight="normal"
                        >
                            Compare Hosts ({selectedChartHosts.length === 0 ? 'All' : selectedChartHosts.length})
                        </MenuButton>
                        <MenuList zIndex={10} maxH="300px" overflowY="auto">
                             <MenuItem onClick={clearChartHostSelection} fontSize="sm" color="blue.500">
                                Show All
                             </MenuItem>
                             <MenuDivider />
                            {activeHostnamesForMenu.map(host => (
                                <MenuItem key={host} as={Box}>
                                    <Checkbox 
                                        isChecked={selectedChartHosts.includes(host)}
                                        onChange={() => toggleChartHost(host)}
                                        width="100%"
                                        size="sm"
                                    >
                                        <Text fontSize="sm" ml={2} isTruncated maxW="200px">{host}</Text>
                                    </Checkbox>
                                </MenuItem>
                            ))}
                            {activeHostnamesForMenu.length === 0 && (
                                <MenuItem isDisabled fontSize="sm">No active hosts</MenuItem>
                            )}
                        </MenuList>
                    </Menu>

                    {/* Time Filter for Chart */}
                    <HStack spacing={2} bg={cardBg} p={2} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                        <Icon as={TimeIcon} color="gray.500" />
                        <Text fontSize="sm" fontWeight="normal" color="gray.500" whiteSpace="nowrap">Time Range:</Text>
                        
                        <Input 
                            type="datetime-local" 
                            size="sm" 
                            w="auto" 
                            value={chartFilter.startDateTime}
                            onChange={(e) => setChartFilter(prev => ({ ...prev, startDateTime: e.target.value }))}
                            bg={inputBg}
                        />
                        <Text fontSize="sm">-</Text>
                        <Input 
                            type="datetime-local" 
                            size="sm" 
                            w="auto" 
                            value={chartFilter.endDateTime}
                            onChange={(e) => setChartFilter(prev => ({ ...prev, endDateTime: e.target.value }))}
                            bg={inputBg}
                        />
                        <Button size="sm" variant="ghost" onClick={handleResetChartFilter} title="Reset Chart Time">
                            <Icon as={RepeatIcon} />
                        </Button>
                    </HStack>
                </Flex>

                <Box p={5} borderWidth="1px" borderColor={borderColor} borderRadius="lg" bg={cardBg} h="450px">
                    <LineChartDisplay data={lineChartData.data} keys={lineChartData.keys} />
                </Box>
            </VStack>
        </VStack>
    );
};

export default MainDashboard;