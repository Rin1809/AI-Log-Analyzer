import React from 'react';
import { Box, Center, Text, VStack, HStack, useColorModeValue } from '@chakra-ui/react';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from 'recharts';

// Extended palette: 20 distinct colors (Synced with LineChart)
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

const CustomLegend = ({ payload }) => {
    const textColor = useColorModeValue('gray.600', 'gray.300');
    if (!payload || payload.length === 0) return null;
    return (
        <VStack align="start" justify="center" h="100%" spacing={3} pl={4}>
            {payload.map((entry, index) => (
                <HStack key={`item-${index}`} spacing={3}>
                    <Box boxSize="12px" borderRadius="sm" bg={entry.color} />
                    <Text fontSize="sm" color={textColor}>
                        {entry.value} ({entry.payload.payload.value})
                    </Text>
                </HStack>
            ))}
        </VStack>
    );
};

const PieChartDisplay = ({ data }) => {
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
                    outerRadius="80%"
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Legend
                    content={<CustomLegend />}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                />
            </PieChart>
        </ResponsiveContainer>
    );
};

export default PieChartDisplay;