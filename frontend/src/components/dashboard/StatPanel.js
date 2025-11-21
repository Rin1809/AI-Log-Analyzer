import React from 'react';
import {
    Box,
    Text,
    useColorModeValue,
    Stack,
    StackDivider
} from '@chakra-ui/react';
import { useLanguage } from '../../context/LanguageContext';

const formatNumber = (num) => {
    if (num === undefined || num === null) return 0;
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num;
};

const StatItem = ({ label, value, color }) => {
    return (
        <Box textAlign="center" w="full">
            <Text 
                fontSize="4xl" 
                fontWeight="normal" 
                color={color} 
                lineHeight="1.2"
                mb={1}
            >
                {formatNumber(value)}
            </Text>
            <Text 
                fontSize="sm" 
                color="gray.500" 
                fontWeight="normal" 
                textTransform="uppercase" 
                letterSpacing="wide"
            >
                {label}
            </Text>
        </Box>
    );
};

const StatPanel = ({ stats }) => {
    const bg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const dividerColor = useColorModeValue('gray.200', 'gray.600');
    const { t } = useLanguage();

    return (
        <Box
            p={6}
            shadow="sm"
            border="1px solid"
            borderColor={borderColor}
            rounded="lg"
            bg={bg}
            mb={6}
        >

            <Stack
                direction={{ base: 'column', md: 'row' }}
                divider={<StackDivider borderColor={dividerColor} />}
                spacing={{ base: 8, md: 0 }}
                align="center"
                justify="space-between"
            >
                <Box flex="1">
                    <StatItem
                        label={t('totalRawLogs')}
                        value={stats.total_raw_logs}
                        color="blue.500"
                    />
                </Box>
                
                <Box flex="1">
                    <StatItem
                        label={t('analyzedLogs')}
                        value={stats.total_analyzed_logs}
                        color="green.500"
                    />
                </Box>

                <Box flex="1">
                    <StatItem
                        label={t('apiCalls')}
                        value={stats.total_api_calls}
                        color="purple.500"
                    />
                </Box>
            </Stack>
        </Box>
    );
};

export default StatPanel;