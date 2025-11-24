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
  MenuDivider
} from '@chakra-ui/react';
import { SearchIcon, RepeatIcon, TimeIcon, ChevronDownIcon } from '@chakra-ui/icons';
import PieChartDisplay from '../components/dashboard/PieChartDisplay';
import LineChartDisplay from '../components/dashboard/LineChartDisplay';
import InfoCard from '../components/dashboard/InfoCard';
import StatPanel from '../components/dashboard/StatPanel';
import { useLanguage } from '../context/LanguageContext';

const POLLING_INTERVAL = 30000;

const MainDashboard = () => {
    const { isTestMode } = useOutletContext();
    const { t } = useLanguage();
    
    const [statusData, setStatusData] = useState([]);
    const [reports, setReports] = useState([]);
    const [dashboardStats, setDashboardStats] = useState({ 
        total_raw_logs: 0, 
        total_analyzed_logs: 0, 
        total_api_calls: 0,
        api_usage_breakdown: {} 
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [filters, setFilters] = useState({
        hostname: '',
        startDate: '',
        endDate: ''
    });

    const [chartFilter, setChartFilter] = useState({
        startDateTime: '',
        endDateTime: ''
    });

    const [selectedChartHosts, setSelectedChartHosts] = useState([]);

    const isInitialLoad = useRef(true);

    const cardBg = useColorModeValue('gray.50', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const filterBg = useColorModeValue('white', 'gray.800');
    const inputBg = useColorModeValue('white', 'gray.700');

    const fetchData = useCallback(async (testMode) => {
        if (isInitialLoad.current) setLoading(true);
        setError('');
        try {
            const apiParams = { params: { test_mode: testMode } };
            const [statusRes, reportsRes, statsRes] = await Promise.all([
                axios.get('/api/status', apiParams),
                axios.get('/api/reports', apiParams),
                axios.get('/api/dashboard-stats', apiParams)
            ]);
            setStatusData(statusRes.data);
            setReports(reportsRes.data);
            setDashboardStats(statsRes.data);
        } catch (err) {
            console.error(err);
            setError(`${t('error')}: ${err.message}`);
        } finally {
            if (isInitialLoad.current) {
                setLoading(false);
                isInitialLoad.current = false;
            }
        }
    }, [t]);

    useEffect(() => {
        setStatusData([]);
        setReports([]);
        setDashboardStats({ total_raw_logs: 0, total_analyzed_logs: 0, total_api_calls: 0, api_usage_breakdown: {} });
        isInitialLoad.current = true;
        
        fetchData(isTestMode);
        const intervalId = setInterval(() => fetchData(isTestMode), POLLING_INTERVAL);
        return () => clearInterval(intervalId);
    }, [fetchData, isTestMode]);


    const filteredStatus = useMemo(() => {
        if (!filters.hostname) return statusData;
        return statusData.filter(s => 
            s.hostname.toLowerCase().includes(filters.hostname.toLowerCase())
        );
    }, [statusData, filters.hostname]);


    const hostStatusData = useMemo(() => {
        if (!filteredStatus || filteredStatus.length === 0) return [];
        const active = filteredStatus.filter(s => s.is_enabled).length;
        const inactive = filteredStatus.length - active;
        if (active === 0 && inactive === 0) return [];
        return [{ name: t('active'), value: active }, { name: t('inactive'), value: inactive }];
    }, [filteredStatus, t]);

    // REPLACED: Report Type Data -> API Usage Data
    const apiKeyUsageData = useMemo(() => {
        const breakdown = dashboardStats.api_usage_breakdown || {};
        const entries = Object.entries(breakdown);
        if (entries.length === 0) return [];
        
        // Convert to array format for PieChart
        return entries.map(([name, value]) => ({ name, value }));
    }, [dashboardStats.api_usage_breakdown]);

    const reportsByHostData = useMemo(() => {
        if (!reports || reports.length === 0) return [];
        const hosts = reports.reduce((acc, report) => {
            acc[report.hostname] = (acc[report.hostname] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(hosts).map(([name, value]) => ({ name, value }));
    }, [reports]);


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
            if (!reportMap.has(timestamp)) reportMap.set(timestamp, []);
            reportMap.get(timestamp).push(r);
        });

        if (chartFilter.startDateTime) timestampSet.add(new Date(chartFilter.startDateTime).getTime());
        if (chartFilter.endDateTime) timestampSet.add(new Date(chartFilter.endDateTime).getTime());

        const allTimestamps = Array.from(timestampSet).sort((a, b) => a - b);
        if (allTimestamps.length === 0 && targetHostnames.length > 0) return { data: [], keys: [] };

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
                 targetHostnames.forEach(host => lastValues[host] = 0);
            }
            const formattedTime = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
            return { time: formattedTime, ...lastValues };
        });

        return { data: finalData, keys: targetHostnames };
    }, [reports, filteredStatus, chartFilter, selectedChartHosts]);


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

    if (loading) {
        return <Center h="80vh"><Spinner size="xl" /></Center>;
    }

    if (error) {
        return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>;
    }

    const activeHostnamesForMenu = filteredStatus.filter(s => s.is_enabled).map(s => s.hostname);

    return (
        <VStack spacing={6} align="stretch">
            <StatPanel stats={dashboardStats} />

            <Box p={5} borderWidth="1px" borderColor={borderColor} borderRadius="lg" bg={filterBg} shadow="sm">
                <Flex direction={{ base: 'column', lg: 'row' }} gap={4} align={{ base: 'stretch', lg: 'flex-end' }}>
                    <FormControl flex="1">
                        <FormLabel fontSize="sm" fontWeight="normal" color="gray.500">{t('globalFilter')}</FormLabel>
                        <InputGroup>
                            <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400" /></InputLeftElement>
                            <Input 
                                placeholder={t('search')}
                                value={filters.hostname}
                                onChange={(e) => setFilters(prev => ({ ...prev, hostname: e.target.value }))}
                                bg={inputBg}
                            />
                        </InputGroup>
                    </FormControl>
                    <FormControl w={{ base: '100%', lg: '200px' }}>
                         <FormLabel fontSize="sm" color="gray.500">{t('fromDate')}</FormLabel>
                         <Input type="date" value={filters.startDate} onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))} bg={inputBg} />
                    </FormControl>
                    <FormControl w={{ base: '100%', lg: '200px' }}>
                         <FormLabel fontSize="sm" color="gray.500">{t('toDate')}</FormLabel>
                         <Input type="date" value={filters.endDate} onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))} bg={inputBg} />
                    </FormControl>
                    <Button leftIcon={<Icon as={RepeatIcon} />} onClick={handleResetGlobalFilters} colorScheme="gray" variant="outline" fontWeight="normal">
                        {t('reset')}
                    </Button>
                </Flex>
            </Box>

            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
                <VStack align="stretch" spacing={3}>
                    <Heading size="md" fontWeight="normal" textAlign="left">{t('hostStatusTitle')}</Heading>
                    <InfoCard><PieChartDisplay data={hostStatusData} /></InfoCard>
                </VStack>
                <VStack align="stretch" spacing={3}>
                    {/* CHANGED: Title updated */}
                    <Heading size="md" fontWeight="normal" textAlign="left">{t('apiKeyUsage')}</Heading>
                    <InfoCard><PieChartDisplay data={apiKeyUsageData} /></InfoCard>
                </VStack>
                <VStack align="stretch" spacing={3}>
                    <Heading size="md" fontWeight="normal" textAlign="left">{t('reportsByHost')}</Heading>
                    <InfoCard><PieChartDisplay data={reportsByHostData} /></InfoCard>
                </VStack>
            </SimpleGrid>
            
            <VStack align="stretch" spacing={3} mt={4}>
                <Flex align="center" wrap="wrap" gap={4}>
                    <Heading size="md" fontWeight="normal">{t('logVolume')}</Heading>
                    <Spacer />
                    
                    <Menu closeOnSelect={false}>
                        <MenuButton as={Button} rightIcon={<ChevronDownIcon />} variant="outline" size="sm" bg={cardBg} fontWeight="normal">
                            {t('compareHosts')} ({selectedChartHosts.length === 0 ? 'All' : selectedChartHosts.length})
                        </MenuButton>
                        <MenuList zIndex={10} maxH="300px" overflowY="auto">
                             <MenuItem onClick={clearChartHostSelection} fontSize="sm" color="blue.500">{t('showAll')}</MenuItem>
                             <MenuDivider />
                            {activeHostnamesForMenu.map(host => (
                                <MenuItem key={host} as={Box}>
                                    <Checkbox isChecked={selectedChartHosts.includes(host)} onChange={() => toggleChartHost(host)} width="100%" size="sm">
                                        <Text fontSize="sm" ml={2} isTruncated maxW="200px">{host}</Text>
                                    </Checkbox>
                                </MenuItem>
                            ))}
                            {activeHostnamesForMenu.length === 0 && (
                                <MenuItem isDisabled fontSize="sm">{t('noHosts')}</MenuItem>
                            )}
                        </MenuList>
                    </Menu>

                    <HStack spacing={2} bg={cardBg} p={2} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                        <Icon as={TimeIcon} color="gray.500" />
                        <Text fontSize="sm" fontWeight="normal" color="gray.500" whiteSpace="nowrap">{t('timeRange')}:</Text>
                        <Input type="datetime-local" size="sm" w="auto" value={chartFilter.startDateTime} onChange={(e) => setChartFilter(prev => ({ ...prev, startDateTime: e.target.value }))} bg={inputBg} />
                        <Text fontSize="sm">-</Text>
                        <Input type="datetime-local" size="sm" w="auto" value={chartFilter.endDateTime} onChange={(e) => setChartFilter(prev => ({ ...prev, endDateTime: e.target.value }))} bg={inputBg} />
                        <Button size="sm" variant="ghost" onClick={handleResetChartFilter} title="Reset Chart Time"><Icon as={RepeatIcon} /></Button>
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