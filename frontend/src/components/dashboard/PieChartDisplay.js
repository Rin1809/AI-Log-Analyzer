import React, { useState } from 'react';
import { 
    Box, 
    Center, 
    Text, 
    VStack, 
    HStack, 
    useColorModeValue, 
    Flex, 
    IconButton,
    Spacer
} from '@chakra-ui/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';

//  20 mau 
const COLORS = [
    '#3182CE', // Blue
    '#805AD5', // Purple
    '#D69E2E', // Mustard
    '#38A169', // Green
    '#DD6B20', // Orange
    '#00A3C4', // Cyan
    '#D53F8C', // Pink
    '#E53E3E', // Red
    '#319795', // Teal
    '#5A67D8', // Indigo
    '#718096', // Gray
    '#F6AD55', // Light Orange
    '#68D391', // Light Green
    '#63B3ED', // Light Blue
    '#B794F4', // Light Purple
    '#F687B3', // Light Pink
    '#FC8181', // Light Red
    '#4FD1C5', // Light Teal
    '#ECC94B', // Yellow
    '#A0AEC0'  // Cool Gray
];

const ITEMS_PER_PAGE = 5;

const PieChartDisplay = ({ data }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const textColor = useColorModeValue('gray.600', 'gray.400');
    const tooltipBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    if (!data || data.length === 0) {
        return <Center h="100%"><Text color="gray.500">No data to display.</Text></Center>;
    }

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    
    const handlePrev = () => setCurrentPage((prev) => Math.max(prev - 1, 0));
    const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));

    const currentLegendData = data.slice(
        currentPage * ITEMS_PER_PAGE,
        (currentPage + 1) * ITEMS_PER_PAGE
    );

    return (
        <Flex 
            h="100%" 
            direction={{ base: 'column', md: 'row' }} 
            align="center" 
            justify="space-between" 
            px={2}
            py={{ base: 2, md: 0 }}
        >
            <Box w={{ base: '100%', md: '50%' }} h={{ base: '200px', md: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius="60%" 
                            outerRadius="80%" 
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: tooltipBg, borderRadius: '8px', border: `1px solid ${borderColor}` }}
                            itemStyle={{ color: textColor }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </Box>

     
            <VStack 
                w={{ base: '100%', md: '50%' }} 
                align="stretch" 
                spacing={1} 
                pl={{ base: 0, md: 4 }}
                mt={{ base: 2, md: 0 }} 
            >
                {currentLegendData.map((entry, idx) => {
                    const realIndex = (currentPage * ITEMS_PER_PAGE) + idx;
                    return (
                        <HStack key={`legend-${realIndex}`} spacing={3} p={1} borderRadius="md" _hover={{ bg: "blackAlpha.50" }}>
                            <Box 
                                boxSize="10px" 
                                borderRadius="full" 
                                bg={COLORS[realIndex % COLORS.length]} 
                                flexShrink={0}
                            />
                            <Flex justify="space-between" w="100%" align="center">
                                <Text fontSize="xs" color={textColor} fontWeight="medium" isTruncated maxW="120px" title={entry.name}>
                                    {entry.name}
                                </Text>
                                <Text fontSize="xs" fontWeight="bold" color={textColor}>
                                    {entry.value}
                                </Text>
                            </Flex>
                        </HStack>
                    );
                })}

                <Spacer />
                
                {totalPages > 1 && (
                    <Flex justify="flex-end" align="center" pt={2} borderTop="1px dashed" borderColor={borderColor}>
                        <Text fontSize="10px" color="gray.500" mr={2}>
                            Page {currentPage + 1}/{totalPages}
                        </Text>
                        <HStack spacing={1}>
                            <IconButton 
                                icon={<ChevronLeftIcon />} 
                                size="xs" 
                                onClick={handlePrev} 
                                isDisabled={currentPage === 0}
                                aria-label="Previous page"
                                variant="ghost"
                            />
                            <IconButton 
                                icon={<ChevronRightIcon />} 
                                size="xs" 
                                onClick={handleNext} 
                                isDisabled={currentPage === totalPages - 1}
                                aria-label="Next page"
                                variant="ghost"
                            />
                        </HStack>
                    </Flex>
                )}
            </VStack>
        </Flex>
    );
};

export default PieChartDisplay;